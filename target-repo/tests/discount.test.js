const test = require('node:test');
const assert = require('node:assert');
const { applyDiscount } = require('../src/pricing/discount');

// FAIL_TO_PASS: this is the bug. Fails on the original code, must pass after the fix.
test('discount larger than subtotal clamps to zero', () => {
  assert.strictEqual(applyDiscount(10, 15), 0);
});

// PASS_TO_PASS: must keep passing.
test('discount smaller than subtotal subtracts normally', () => {
  assert.strictEqual(applyDiscount(100, 30), 70);
});

// PASS_TO_PASS: must keep passing.
test('zero discount returns subtotal unchanged', () => {
  assert.strictEqual(applyDiscount(50, 0), 50);
});
