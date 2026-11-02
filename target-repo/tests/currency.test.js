const test = require('node:test');
const assert = require('node:assert');
const { toCents, formatMoney, convert } = require('../src/pricing/currency');

test('toCents rounds to whole cents', () => {
  assert.strictEqual(toCents('19.99'), 1999);
});

test('formatMoney pads cents', () => {
  assert.strictEqual(formatMoney(1205), '$12.05');
});

test('formatMoney handles negative amounts', () => {
  assert.strictEqual(formatMoney(-250), '-$2.50');
});

test('convert applies the rate and rounds', () => {
  assert.strictEqual(convert(1000, 0.9), 900);
});
