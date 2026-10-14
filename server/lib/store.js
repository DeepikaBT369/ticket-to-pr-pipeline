// In-memory ticket run state, keyed by ticket id. Tracks where each ticket
// is in the pipeline (status) plus whatever each stage produced, so the
// dashboard can show real "extracted / in progress / solved / in queue"
// numbers instead of a single hardcoded ticket.
//
// A real system would persist this (a DB row per ticket run); for this
// project an in-memory store is enough since there's one server process.

const STATUS = {
  QUEUED: 'queued', // ticket exists, pipeline hasn't touched it yet
  LOCATED: 'located', // Locator has run
  FIXED: 'fixed', // Fixer has run and picked a winner
  GATED: 'gated', // Gate has re-verified the winner and it passed
  GATE_FAILED: 'gate_failed', // Gate re-verified the winner and it FAILED
  PR_READY: 'pr_ready', // PR Agent has built the diff/explanation
  APPROVED: 'approved', // Human approved; fix written to disk
};

const runs = {}; // ticketId -> { status, files, candidates, winner, gate, pr, approvedAt, ... }

function ensure(ticketId) {
  if (!runs[ticketId]) {
    runs[ticketId] = { status: STATUS.QUEUED, history: [{ status: STATUS.QUEUED, at: Date.now() }] };
  }
  return runs[ticketId];
}

function setStatus(ticketId, status, extra = {}) {
  const run = ensure(ticketId);
  // Once a ticket is approved, its run is frozen. Revisiting an earlier stage
  // on screen must not push the ticket back to "gated" or overwrite its results.
  if (run.status === STATUS.APPROVED && status !== STATUS.APPROVED) return run;
  Object.assign(run, extra, { status });
  run.history.push({ status, at: Date.now() });
  return run;
}

function get(ticketId) {
  return runs[ticketId];
}

// Seeds every known ticket id into the store as QUEUED so stats are correct
// even before any pipeline stage has run for it.
function seed(ticketIds) {
  ticketIds.forEach((id) => ensure(id));
}

function stats(ticketIds) {
  seed(ticketIds); // make sure every ticket has at least a QUEUED entry
  const byStatus = {};
  Object.values(STATUS).forEach((s) => {
    byStatus[s] = 0;
  });

  ticketIds.forEach((id) => {
    const run = ensure(id);
    byStatus[run.status] = (byStatus[run.status] || 0) + 1;
  });

  const total = ticketIds.length;
  const solved = byStatus[STATUS.APPROVED];
  const queued = byStatus[STATUS.QUEUED];
  const inProgress = total - solved - queued;

  // Avg. time-in-pipeline: for each APPROVED ticket, how long it took from
  // its first QUEUED entry to its APPROVED entry. Real elapsed time, read
  // straight from each ticket's own history, not a guessed/hardcoded number.
  const resolutionTimesMs = ticketIds
    .map((id) => ensure(id))
    .filter((run) => run.status === STATUS.APPROVED)
    .map((run) => {
      const queuedAt = run.history.find((h) => h.status === STATUS.QUEUED)?.at;
      const approvedAt = run.history.find((h) => h.status === STATUS.APPROVED)?.at;
      return queuedAt && approvedAt ? approvedAt - queuedAt : null;
    })
    .filter((ms) => ms !== null);

  const avgResolutionMs = resolutionTimesMs.length
    ? resolutionTimesMs.reduce((a, b) => a + b, 0) / resolutionTimesMs.length
    : null;

  return {
    total,
    queued,
    inProgress,
    solved,
    byStatus,
    avgResolutionMs,
    avgResolutionSeconds: avgResolutionMs !== null ? Math.round(avgResolutionMs / 1000) : null,
  };
}

// Clears every ticket back to QUEUED. Used by the "Reset demo" button so each
// tester starts from a clean slate.
function reset(ticketIds) {
  Object.keys(runs).forEach((id) => delete runs[id]);
  seed(ticketIds);
}

module.exports = { STATUS, ensure, setStatus, get, seed, reset, stats, runs };
