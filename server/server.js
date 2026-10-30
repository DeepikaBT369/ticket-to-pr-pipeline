const express = require('express');
const path = require('path');
const fs = require('fs');

const tickets = require('./tickets');
const { locate } = require('./lib/locator');
const { tryCandidate } = require('./lib/fixer');
const { runGate } = require('./lib/gate');
const { buildDiff, explanation, commitMessage } = require('./lib/prAgent');
const store = require('./lib/store');
const { generateCandidates } = require('./lib/llm');
const github = require('./lib/github');

const REPO_ROOT = path.join(__dirname, '..', 'target-repo');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

const TICKET_IDS = Object.keys(tickets);
store.seed(TICKET_IDS);

// Remember each target file as it was at startup (with its bug). Approving a
// fix overwrites the file on disk, so "Reset demo" uses this snapshot to put
// the bugs back and let the next tester start clean.
const originalFiles = {};
TICKET_IDS.forEach((id) => {
  const rel = tickets[id].targetFile;
  originalFiles[rel] = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
});

app.post('/api/reset', async (req, res) => {
  Object.entries(originalFiles).forEach(([rel, content]) => {
    fs.writeFileSync(path.join(REPO_ROOT, rel), content);
  });
  store.reset(TICKET_IDS);

  // Put the GitHub repo's main branch back to the buggy baseline too.
  let githubReset = null;
  if (github.enabled()) {
    try {
      await github.resetMainToBaseline();
      githubReset = 'ok';
    } catch (err) {
      console.error(`[github] reset failed: ${err.message}`);
      githubReset = err.message;
    }
  }
  res.json({ reset: true, githubReset });
});

app.get('/api/tickets', (req, res) => {
  res.json(
    TICKET_IDS.map((id) => ({
      id,
      title: tickets[id].title,
      status: store.get(id).status,
    }))
  );
});

// Aggregate counts for the dashboard: how many tickets are queued, actively
// moving through the pipeline, or fully solved (approved).
app.get('/api/stats', (req, res) => {
  res.json(store.stats(TICKET_IDS));
});

app.get('/api/pipeline/:id/locate', (req, res) => {
  const ticket = tickets[req.params.id];
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });

  const done = store.get(req.params.id);
  if (done?.status === store.STATUS.APPROVED && done.files) {
    return res.json({
      ticket: { id: req.params.id, title: ticket.title, description: ticket.description },
      files: done.files,
    });
  }

  const files = locate(ticket, REPO_ROOT);
  store.setStatus(req.params.id, store.STATUS.LOCATED, { files });
  res.json({
    ticket: { id: req.params.id, title: ticket.title, description: ticket.description },
    files,
  });
});

app.get('/api/pipeline/:id/fix', async (req, res) => {
  const ticket = tickets[req.params.id];
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });

  // After approval the file on disk is already fixed, so re-running would give
  // different numbers. Show what was decided at the time instead.
  const done = store.get(req.params.id);
  if (done?.status === store.STATUS.APPROVED && done.candidates && done.winner) {
    return res.json({ candidates: done.candidates, winnerId: done.winner.id, meta: done.generated?.meta });
  }

  const targetFile = path.join(REPO_ROOT, ticket.targetFile);
  const testFile = path.join(REPO_ROOT, ticket.testFile);

  // Ask Claude for candidate patches once per ticket per run (the Approval
  // screen calls this endpoint again, and we don't want a second API call or
  // different candidates on different screens). Falls back to the pre-written
  // candidates if there is no API key or the call fails.
  const run = store.ensure(req.params.id);
  if (!run.generated) {
    try {
      run.generated = await generateCandidates(
        ticket,
        fs.readFileSync(targetFile, 'utf8'),
        fs.readFileSync(testFile, 'utf8')
      );
    } catch (err) {
      console.error(`[fixer] LLM failed for ${req.params.id}: ${err.message}`);
      run.generated = {
        candidates: ticket.candidates,
        meta: { source: 'fallback', reason: err.message },
      };
    }
  }
  const { candidates: sourceCandidates, meta } = run.generated;

  const candidateResults = sourceCandidates.map((c) => {
    const r = tryCandidate(targetFile, c.content, testFile);
    const coverage = r.total ? Math.round((r.passed / r.total) * 100) : 0;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      coverage,
      passed: r.passed,
      total: r.total,
      tests: r.tests,
      content: c.content,
    };
  });

  const winner = candidateResults.reduce(
    (best, c) => (c.coverage > best.coverage ? c : best),
    candidateResults[0]
  );

  store.setStatus(req.params.id, store.STATUS.FIXED, { candidates: candidateResults, winner });
  res.json({ candidates: candidateResults, winnerId: winner.id, meta });
});

app.get('/api/pipeline/:id/gate', (req, res) => {
  const ticket = tickets[req.params.id];
  const run = store.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  if (!run || !run.winner) return res.status(400).json({ error: 'run the fixer stage first' });
  if (run.status === store.STATUS.APPROVED && run.gate) return res.json(run.gate);

  const targetFile = path.join(REPO_ROOT, ticket.targetFile);
  const testFile = path.join(REPO_ROOT, ticket.testFile);
  const gateResults = runGate(targetFile, testFile, run.winner.content);

  const passed = gateResults.syntax.ok && gateResults.tests.ok && gateResults.staticScan.ok;
  store.setStatus(req.params.id, passed ? store.STATUS.GATED : store.STATUS.GATE_FAILED, {
    gate: gateResults,
  });
  res.json(gateResults);
});

// What the reviewer sees BEFORE deciding: the real diff, the explanation and
// the commit message. Nothing is sent to GitHub here. The result is stored so
// the PR Agent opens exactly what the human reviewed.
function buildReview(id, ticket, run) {
  if (run.review) return run.review;
  const targetFile = path.join(REPO_ROOT, ticket.targetFile);
  const original = fs.readFileSync(targetFile, 'utf8');
  run.review = {
    diff: buildDiff(original, run.winner.content, ticket.targetFile),
    explanation: explanation(run.winner),
    commitMessage: commitMessage(id, run.winner),
  };
  return run.review;
}

app.get('/api/pipeline/:id/review', (req, res) => {
  const ticket = tickets[req.params.id];
  const run = store.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  if (!run || !run.winner) return res.status(400).json({ error: 'run the fixer stage first' });
  res.json(buildReview(req.params.id, ticket, run));
});

// Stage 5 (PR Agent). Runs only AFTER a human has approved. This is the first
// point where anything is created on GitHub: open the pull request, then merge
// it. If GitHub refuses (for example a merge conflict), the error is shown and
// nothing is forced.
app.get('/api/pipeline/:id/pr', async (req, res) => {
  const ticket = tickets[req.params.id];
  const run = store.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  if (!run || !run.winner) return res.status(400).json({ error: 'run the fixer stage first' });
  if (run.status !== store.STATUS.APPROVED) {
    return res.status(409).json({ error: 'A human must approve the fix before a pull request is opened.' });
  }
  if (run.pr) return res.json(run.pr);

  const prPayload = { ...run.review };

  if (github.enabled()) {
    if (!run.githubPending) {
      run.githubPending = (async () => {
        try {
          const pr = await github.openPullRequest({
            ticketId: req.params.id,
            ticket,
            candidate: run.winner,
            explanation: prPayload.explanation,
            commitMessage: prPayload.commitMessage,
            gate: run.gate,
            source: run.generated?.meta?.source === 'llm' ? `AI (${run.generated.meta.model})` : 'pre-written fallback',
          });
          run.github = { ...pr, repo: github.REPO };
          try {
            await github.mergePullRequest(pr.number);
            run.github.merged = true;
          } catch (err) {
            console.error(`[github] merge failed: ${err.message}`);
            run.github.merged = false;
            run.github.mergeError = err.message;
          }
        } catch (err) {
          console.error(`[github] open PR failed for ${req.params.id}: ${err.message}`);
          run.github = { error: err.message };
        }
      })();
    }
    await run.githubPending;
    prPayload.github = run.github;
  }

  // The run is frozen after approval, so store the PR result directly.
  run.pr = prPayload;
  res.json(prPayload);
});

// "Approve" records the human decision only. It does not touch GitHub: the PR
// Agent stage does that next. The Gate must have passed, and a ticket can only
// be approved once.
app.post('/api/pipeline/:id/approve', (req, res) => {
  const ticket = tickets[req.params.id];
  const run = store.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  if (!run || !run.winner) return res.status(400).json({ error: 'run the fixer stage first' });
  if (run.status === store.STATUS.APPROVED) {
    return res.status(409).json({ error: 'This ticket is already approved.' });
  }
  const g = run.gate;
  if (!g || !g.syntax.ok || !g.tests.ok || !g.staticScan.ok) {
    return res.status(409).json({ error: 'The Gate has not passed, so this cannot be approved.' });
  }

  buildReview(req.params.id, ticket, run); // freeze the diff the reviewer saw
  const targetFile = path.join(REPO_ROOT, ticket.targetFile);
  fs.writeFileSync(targetFile, run.winner.content);

  store.setStatus(req.params.id, store.STATUS.APPROVED, { approvedAt: Date.now() });
  res.json({ approved: true, file: ticket.targetFile, winner: run.winner.id });
});

// "Request changes" from the Approval screen. Kept in a plain array that
// Reset does NOT clear, so rejection reasons from every tester survive. Also
// printed to the server log (visible in Render's Logs tab) as a second copy.
const feedbackLog = [];

app.post('/api/pipeline/:id/request-changes', async (req, res) => {
  const ticket = tickets[req.params.id];
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  const text = String(req.body?.feedback || '').trim().slice(0, 2000);
  if (!text) return res.status(400).json({ error: 'feedback is empty' });

  const run = store.get(req.params.id);
  const entry = {
    ticketId: req.params.id,
    candidateId: run?.winner?.id || null,
    feedback: text,
    at: new Date().toISOString(),
  };
  feedbackLog.push(entry);
  console.log('[feedback]', JSON.stringify(entry));

  // Also leave the feedback as a comment on the real PR, if there is one.
  let commented = false;
  if (github.enabled() && run?.github?.number) {
    try {
      await github.commentOnPullRequest(run.github.number, `**Changes requested by reviewer**\n\n${text}`);
      commented = true;
    } catch (err) {
      console.error(`[github] comment failed: ${err.message}`);
    }
  }
  res.json({ recorded: true, commented });
});

app.get('/api/feedback', (req, res) => res.json(feedbackLog));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ticket-to-PR pipeline server running at http://localhost:${PORT}`);
});
