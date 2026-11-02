const test = require('node:test');
const assert = require('node:assert');
const { reserve, release, isLow } = require('../src/inventory/stock');

test('reserve reduces stock', () => {
  assert.deepStrictEqual(reserve({ A: 10 }, 'A', 4), { A: 6 });
});

test('reserve throws when stock is insufficient', () => {
  assert.throws(() => reserve({ A: 1 }, 'A', 2), /Insufficient/);
});

test('release adds units back', () => {
  assert.deepStrictEqual(release({ A: 1 }, 'A', 2), { A: 3 });
});

test('isLow flags stock at or under the threshold', () => {
  assert.strictEqual(isLow({ A: 5 }, 'A'), true);
  assert.strictEqual(isLow({ A: 6 }, 'A'), false);
});
