const test = require('node:test');
const assert = require('node:assert');
const { shippingRate, shippingCost } = require('../src/shipping/shippingRates');

// FAIL_TO_PASS: the bug. Upper bounds are inclusive: exactly 1 kg is the lowest tier.
test('a 1 kg parcel is charged the lowest rate', () => {
  assert.strictEqual(shippingRate(1), 5);
});

// PASS_TO_PASS
test('a light parcel is charged the lowest rate', () => {
  assert.strictEqual(shippingRate(0.4), 5);
});

test('a 3 kg parcel is charged the middle rate', () => {
  assert.strictEqual(shippingRate(3), 9);
});

test('a 12 kg parcel is charged the top rate', () => {
  assert.strictEqual(shippingRate(12), 15);
});

test('zero weight is rejected', () => {
  assert.throws(() => shippingRate(0));
});

test('shippingCost adds up item weights', () => {
  assert.strictEqual(shippingCost([{ weightKg: 2, qty: 2 }]), 9);
});
