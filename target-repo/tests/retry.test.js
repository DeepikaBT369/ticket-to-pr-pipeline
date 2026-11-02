const test = require('node:test');
const assert = require('node:assert');
const { retry } = require('../src/utils/retry');

test('returns the first successful result', async () => {
  assert.strictEqual(await retry(async () => 'ok'), 'ok');
});

test('retries after a failure', async () => {
  let calls = 0;
  const result = await retry(async () => {
    calls++;
    if (calls < 3) throw new Error('flaky');
    return 'done';
  });
  assert.strictEqual(result, 'done');
});

test('throws the last error when every attempt fails', async () => {
  await assert.rejects(() => retry(async () => { throw new Error('nope'); }, 2), /nope/);
});
