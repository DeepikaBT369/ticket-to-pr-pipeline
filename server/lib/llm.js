// Generates candidate patches with Claude (Anthropic Messages API).
//
// Needs ANTHROPIC_API_KEY in the environment (set it in your hosting
// dashboard; never commit it). If the key is missing or the call fails for
// any reason, the caller falls back to the pre-written candidates in
// tickets.js, so the demo never breaks.

const API_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const TIMEOUT_MS = 90_000;

function buildPrompt(ticket, originalCode, testCode) {
  return `You are fixing a bug in a small JavaScript (CommonJS, Node) codebase.

TICKET: ${ticket.title}

${ticket.description}

FILE TO FIX: ${ticket.targetFile}
\`\`\`js
${originalCode}
\`\`\`

THE TEST FILE THAT MUST PASS: ${ticket.testFile}
\`\`\`js
${testCode}
\`\`\`

Propose exactly 3 DIFFERENT candidate fixes, each a complete replacement for ${ticket.targetFile}:
1. the smallest, most minimal fix
2. a more defensive fix that handles more edge cases
3. a fix that takes a different approach from the first two

Rules:
- Each "content" is the FULL new contents of ${ticket.targetFile}, valid CommonJS.
- Keep every existing export name and function signature unchanged.
- Do not add console.log or any other debug output.
- "title" is under 8 words. "description" is one or two plain sentences saying what the fix does and why.

Reply with ONLY a JSON array (no markdown fences, no commentary) of 3 objects:
[{"title": "...", "description": "...", "content": "..."}, ...]`;
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('model reply contained no JSON array');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function generateCandidates(ticket, originalCode, testCode) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');

  const t0 = Date.now();
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: buildPrompt(ticket, originalCode, testCode) }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const parsed = extractJson(text);

  const valid = parsed.filter((c) => c && typeof c.content === 'string' && c.content.trim());
  if (valid.length === 0) throw new Error('model returned no usable candidates');

  const ids = ['FIX-A', 'FIX-B', 'FIX-C'];
  const candidates = valid.slice(0, 3).map((c, i) => ({
    id: ids[i],
    title: String(c.title || `Candidate ${i + 1}`).slice(0, 80),
    description: String(c.description || ''),
    content: c.content.endsWith('\n') ? c.content : c.content + '\n',
  }));

  return {
    candidates,
    meta: {
      source: 'llm',
      model: data.model || MODEL,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
      ms: Date.now() - t0,
    },
  };
}

module.exports = { generateCandidates, MODEL };
