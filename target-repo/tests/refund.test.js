const test = require('node:test');
const assert = require('node:assert');
const { maxRefundable, partialRefund } = require('../src/orders/refund');

// FAIL_TO_PASS: the bug. A second refund must be capped at what is left.
test('a second refund is capped at the remaining amount', () => {
  const r = partialRefund(10000, 7000, 5000);
  assert.strictEqual(r.amount, 3000);
  assert.strictEqual(r.totalRefunded, 10000);
});

// PASS_TO_PASS
test('a first partial refund is paid in full', () => {
  const r = partialRefund(10000, 0, 2500);
  assert.strictEqual(r.amount, 2500);
});

test('a refund above the order total on the first request is capped', () => {
  assert.strictEqual(partialRefund(10000, 0, 99999).amount, 10000);
});

test('maxRefundable never goes below zero', () => {
  assert.strictEqual(maxRefundable(10000, 12000), 0);
});

test('a zero refund is rejected', () => {
  assert.throws(() => partialRefund(10000, 0, 0));
});
