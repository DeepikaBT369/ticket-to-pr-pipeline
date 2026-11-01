// Measured cost of the AI calls made for each ticket.
//
// Tokens and time come straight from the model API's own usage numbers, one
// entry per AI call (first generation and any revisions after "Request
// changes"). Dollars need the per-token prices, which you set yourself from
// Anthropic's pricing page for the model in use:
//   COST_INPUT_PER_MTOK   US dollars per million input tokens
//   COST_OUTPUT_PER_MTOK  US dollars per million output tokens
// If either is missing, tokens are still shown and dollars are left blank,
// never guessed.

const fs = require('fs');
const path = require('path');

function pricing() {
  const i = parseFloat(process.env.COST_INPUT_PER_MTOK);
  const o = parseFloat(process.env.COST_OUTPUT_PER_MTOK);
  if (Number.isFinite(i) && Number.isFinite(o) && i >= 0 && o >= 0) {
    return { configured: true, inputPerMTok: i, outputPerMTok: o };
  }
  return { configured: false, inputPerMTok: null, outputPerMTok: null };
}

const dollars = (inTok, outTok, p) =>
  p.configured ? (inTok / 1e6) * p.inputPerMTok + (outTok / 1e6) * p.outputPerMTok : null;

// log: [{ kind, model, inputTokens, outputTokens, ms, at }]
function summarize(log = [], p = pricing()) {
  const inputTokens = log.reduce((n, c) => n + (c.inputTokens || 0), 0);
  const outputTokens = log.reduce((n, c) => n + (c.outputTokens || 0), 0);
  return {
    calls: log.length,
    inputTokens,
    outputTokens,
    ms: log.reduce((n, c) => n + (c.ms || 0), 0),
    tokensMissing: log.some((c) => c.inputTokens == null || c.outputTokens == null),
    dollars: dollars(inputTokens, outputTokens, p),
  };
}

// Results of the ablation script (npm run ablation), if it has been run.
function readAblation() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ablation.json'), 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { pricing, dollars, summarize, readAblation };
