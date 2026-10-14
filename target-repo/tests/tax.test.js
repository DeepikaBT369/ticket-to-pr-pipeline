const test = require('node:test');
const assert = require('node:assert');
const { calculateTax } = require('../src/pricing/tax');

// FAIL_TO_PASS: this is the bug. Fails on the original code, must pass after the fix.
test('tax is rounded to 2 decimal places (cents)', () => {
  assert.strictEqual(calculateTax(19.99, 0.0825), 1.65);
});

// PASS_TO_PASS: must keep passing.
test('whole-dollar tax is unchanged', () => {
  assert.strictEqual(calculateTax(100, 0.1), 10);
});

// PASS_TO_PASS: must keep passing.
test('zero rate gives zero tax', () => {
  assert.strictEqual(calculateTax(50, 0), 0);
});
