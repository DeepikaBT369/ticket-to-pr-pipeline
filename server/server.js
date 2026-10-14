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

app.get('/api/pipeline/:id/pr', async (req, res) => {
  const ticket = tickets[req.params.id];
  const run = store.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  if (!run || !run.winner) return res.status(400).json({ error: 'run the fixer stage first' });
  if (run.status === store.STATUS.APPROVED && run.pr) return res.json(run.pr);

  const targetFile = path.join(REPO_ROOT, ticket.targetFile);
  const original = fs.readFileSync(targetFile, 'utf8');
  const diff = buildDiff(original, run.winner.content, ticket.targetFile);
  const prPayload = {
    diff,
    explanation: explanation(run.winner),
    commitMessage: commitMessage(req.params.id, run.winner),
  };

  // Open a real pull request on GitHub (once per run). The PR exists BEFORE
  // the human decision, like a real review flow: Approve merges it, Request
  // changes comments on it.
  if (github.enabled()) {
    if (!run.githubPending) {
      run.githubPending = github
        .openPullRequest({
          ticketId: req.params.id,
          ticket,
          candidate: run.winner,
          explanation: prPayload.explanation,
          commitMessage: prPayload.commitMessage,
          gate: run.gate,
          source: run.generated?.meta?.source === 'llm' ? `AI (${run.generated.meta.model})` : 'pre-written fallback',
        })
        .then((pr) => {
          run.github = pr;
        })
        .catch((err) => {
          console.error(`[github] open PR failed for ${req.params.id}: ${err.message}`);
          run.githubError = err.message;
        });
    }
    await run.githubPending;
    if (run.github) prPayload.github = { ...run.github, repo: github.REPO };
    else prPayload.github = { error: run.githubError };
  }

  store.setStatus(req.params.id, store.STATUS.PR_READY, { pr: prPayload });
  res.json(prPayload);
});

app.post('/api/pipeline/:id/approve', async (req, res) => {
  const ticket = tickets[req.params.id];
  const run = store.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  if (!run || !run.winner) return res.status(400).json({ error: 'run the fixer stage first' });

  // If a real PR was opened, merging it is what "approve" means.
  if (run.github?.number) {
    try {
      await github.mergePullRequest(run.github.number);
    } catch (err) {
      console.error(`[github] merge failed: ${err.message}`);
      return res.status(502).json({ error: `Could not merge the pull request: ${err.message}` });
    }
  }

  const targetFile = path.join(REPO_ROOT, ticket.targetFile);
  fs.writeFileSync(targetFile, run.winner.content);

  store.setStatus(req.params.id, store.STATUS.APPROVED, { approvedAt: Date.now() });
  res.json({ merged: true, file: ticket.targetFile, winner: run.winner.id, pr: run.github || null });
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
