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

app.post('/api/reset', (req, res) => {
  Object.entries(originalFiles).forEach(([rel, content]) => {
    fs.writeFileSync(path.join(REPO_ROOT, rel), content);
  });
  store.reset(TICKET_IDS);
  res.json({ reset: true });
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

  const targetFile = path.join(REPO_ROOT, ticket.targetFile);
  const testFile = path.join(REPO_ROOT, ticket.testFile);
  const gateResults = runGate(targetFile, testFile, run.winner.content);

  const passed = gateResults.syntax.ok && gateResults.tests.ok && gateResults.staticScan.ok;
  store.setStatus(req.params.id, passed ? store.STATUS.GATED : store.STATUS.GATE_FAILED, {
    gate: gateResults,
  });
  res.json(gateResults);
});

app.get('/api/pipeline/:id/pr', (req, res) => {
  const ticket = tickets[req.params.id];
  const run = store.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  if (!run || !run.winner) return res.status(400).json({ error: 'run the fixer stage first' });

  const targetFile = path.join(REPO_ROOT, ticket.targetFile);
  const original = fs.readFileSync(targetFile, 'utf8');
  const diff = buildDiff(original, run.winner.content, ticket.targetFile);
  const prPayload = {
    diff,
    explanation: explanation(run.winner),
    commitMessage: commitMessage(req.params.id, run.winner),
  };

  store.setStatus(req.params.id, store.STATUS.PR_READY, { pr: prPayload });
  res.json(prPayload);
});

app.post('/api/pipeline/:id/approve', (req, res) => {
  const ticket = tickets[req.params.id];
  const run = store.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  if (!run || !run.winner) return res.status(400).json({ error: 'run the fixer stage first' });

  const targetFile = path.join(REPO_ROOT, ticket.targetFile);
  fs.writeFileSync(targetFile, run.winner.content);

  store.setStatus(req.params.id, store.STATUS.APPROVED, { approvedAt: Date.now() });
  res.json({ merged: true, file: ticket.targetFile, winner: run.winner.id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ticket-to-PR pipeline server running at http://localhost:${PORT}`);
});
