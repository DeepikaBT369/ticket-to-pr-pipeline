const test = require('node:test');
const assert = require('node:assert');
const { processCheckout } = require('../src/checkoutFlow');

// FAIL_TO_PASS: this is the bug. Fails on the original code, must pass after the fix.
test('digital-only cart without address does not throw', () => {
  const cart = { items: [{ id: 1, price: 9.99, requiresPhysicalDelivery: false }] };
  const ctx = { address: undefined };
  assert.doesNotThrow(() => processCheckout(cart, ctx));
});

// PASS_TO_PASS: must keep passing. A physical order still needs a real address.
test('physical cart without address still throws (address required)', () => {
  const cart = { items: [{ id: 2, price: 25, requiresPhysicalDelivery: true }] };
  const ctx = { address: undefined };
  assert.throws(() => processCheckout(cart, ctx));
});

// PASS_TO_PASS: the happy path must keep working.
test('physical cart with a valid address succeeds', () => {
  const cart = { items: [{ id: 3, price: 40, requiresPhysicalDelivery: true }] };
  const ctx = { address: { country_code: 'US' } };
  assert.doesNotThrow(() => processCheckout(cart, ctx));
});
