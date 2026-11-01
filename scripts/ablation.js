// Ablation: does asking for more candidate fixes (N = 1, 2, 3) resolve more
// tickets, and what does each extra candidate cost?
//
// For every built-in demo ticket and every N, it asks the model for N
// candidates, runs each against the ticket's real test file, and counts the
// ticket as RESOLVED if the best candidate passes every test. Tokens come from
// the API's own usage numbers; dollars use your COST_* prices.
//
// Usage (from the project folder):
//   export ANTHROPIC_API_KEY=...  COST_INPUT_PER_MTOK=...  COST_OUTPUT_PER_MTOK=...
//   npm run ablation              # asks for confirmation after printing an estimate
//   npm run ablation -- --trials=2 --yes
//
// Results go to server/data/ablation.json, which the Cost stage displays.
// Each call can take 20 to 60 seconds, so a full run takes several minutes.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const tickets = require('../server/tickets');
const { generateCandidates } = require('../server/lib/llm');
const { tryCandidate } = require('../server/lib/fixer');
const cost = require('../server/lib/cost');

const REPO_ROOT = path.join(__dirname, '..', 'target-repo');
const OUT = path.join(__dirname, '..', 'server', 'data', 'ablation.json');
const NS = [1, 2, 3];

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const trials = Math.max(1, parseInt(flag('trials') || '1', 10));
const autoYes = args.includes('--yes');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim().toLowerCase()); }));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Set it in this terminal first (see the usage notes at the top of this file).');
    process.exit(1);
  }
  const p = cost.pricing();
  const ids = Object.keys(tickets);
  const calls = ids.length * NS.length * trials;

  // Rough estimate from the sizes seen in real runs: about 1,500 input tokens
  // per call and about 1,300 output tokens per candidate.
  const estIn = calls * 1500;
  const estOut = trials * ids.length * NS.reduce((sum, n) => sum + n * 1300, 0);
  console.log(`Tickets: ${ids.length}   N values: ${NS.join(', ')}   trials: ${trials}   AI calls: ${calls}`);
  console.log(
    p.configured
      ? `Rough cost estimate: about $${cost.dollars(estIn, estOut, p).toFixed(2)} (estimate only; real usage is measured and reported at the end)`
      : 'COST_* prices are not set, so no dollar estimate. Tokens will still be measured.'
  );
  if (!autoYes && (await ask('Run it? (y/N) ')) !== 'y') {
    console.log('Cancelled. Nothing was called.');
    return;
  }

  // Safety check: the bug must still be present, otherwise "resolved" would be meaningless.
  const prepared = [];
  for (const id of ids) {
    const t = tickets[id];
    const target = path.join(REPO_ROOT, t.targetFile);
    const test = path.join(REPO_ROOT, t.testFile);
    const original = fs.readFileSync(target, 'utf8');
    const base = tryCandidate(target, original, test);
    if (base.total > 0 && base.passed === base.total) {
      console.error(`${id}: its tests already pass on the current file, so the bug is not present. Run "git checkout target-repo" and try again.`);
      process.exit(1);
    }
    prepared.push({ id, t, target, test, original, testCode: fs.readFileSync(test, 'utf8') });
  }

  const results = []; // { id, n, trial, resolved, bestPassed, total, inputTokens, outputTokens, ms } or { error }
  for (let trial = 1; trial <= trials; trial++) {
    for (const item of prepared) {
      for (const n of NS) {
        const label = `${item.id}  N=${n}  trial ${trial}`;
        try {
          const gen = await generateCandidates(item.t, item.original, item.testCode, null, { count: n });
          const runs = gen.candidates.map((c) => tryCandidate(item.target, c.content, item.test));
          const best = runs.reduce((b, r) => (r.passed > b.passed ? r : b), runs[0]);
          const resolved = best.total > 0 && best.passed === best.total;
          results.push({
            id: item.id, n, trial, resolved, bestPassed: best.passed, total: best.total,
            inputTokens: gen.meta.inputTokens ?? 0, outputTokens: gen.meta.outputTokens ?? 0, ms: gen.meta.ms,
          });
          console.log(`${label}: ${resolved ? 'resolved' : 'not resolved'} (best ${best.passed}/${best.total}), ${gen.meta.inputTokens}+${gen.meta.outputTokens} tokens`);
        } catch (err) {
          results.push({ id: item.id, n, trial, error: err.message });
          console.log(`${label}: ERROR ${err.message}`);
        }
      }
    }
  }

  // Put every target file back exactly as it was.
  prepared.forEach((i) => fs.writeFileSync(i.target, i.original));

  const rows = NS.map((n) => {
    const ok = results.filter((r) => r.n === n && !r.error);
    const tokens = ok.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
    const dollars = ok.reduce((s, r) => s + (cost.dollars(r.inputTokens, r.outputTokens, p) ?? 0), 0);
    return {
      n,
      resolved: ok.filter((r) => r.resolved).length,
      total: ok.length,
      avgDollars: p.configured && ok.length ? dollars / ok.length : null,
      avgTokens: ok.length ? Math.round(tokens / ok.length) : 0,
    };
  });
  const errors = results.filter((r) => r.error);
  const out = {
    ranAt: new Date().toISOString(),
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    tickets: ids.length,
    trials,
    pricing: p,
    errors: errors.length,
    rows,
    detail: results,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  console.log('\nN   resolved     avg cost/ticket   avg tokens');
  rows.forEach((r) =>
    console.log(`${r.n}   ${String(r.resolved).padStart(2)} of ${String(r.total).padEnd(2)}     ${r.avgDollars == null ? 'n/a'.padEnd(15) : ('$' + r.avgDollars.toFixed(4)).padEnd(15)}   ${r.avgTokens}`)
  );
  if (errors.length) console.log(`\n${errors.length} call(s) failed and are left out of the table. See "detail" in ${OUT}.`);
  console.log(`\nSaved to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
