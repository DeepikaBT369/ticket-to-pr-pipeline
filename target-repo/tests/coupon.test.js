const test = require('node:test');
const assert = require('node:assert');
const { isCouponValid, couponDiscount } = require('../src/pricing/coupon');

const coupon = { code: 'SAVE10', percent: 10, expires: '2026-11-30', minSubtotal: 50 };

// FAIL_TO_PASS: the bug. It must still work late on the expiry day.
test('a coupon is still valid at 18:00 UTC on its expiry day', () => {
  assert.strictEqual(isCouponValid(coupon, new Date('2026-11-30T18:00:00Z')), true);
});

// PASS_TO_PASS
test('a coupon is valid before its expiry day', () => {
  assert.strictEqual(isCouponValid(coupon, new Date('2026-11-10T09:00:00Z')), true);
});

test('a coupon is invalid the day after expiry', () => {
  assert.strictEqual(isCouponValid(coupon, new Date('2026-12-01T00:00:01Z')), false);
});

test('a coupon without an expiry never expires', () => {
  assert.strictEqual(isCouponValid({ code: 'X', percent: 5 }, new Date('2030-01-01T00:00:00Z')), true);
});

test('discount is percent of subtotal when valid', () => {
  assert.strictEqual(couponDiscount(coupon, 200, new Date('2026-11-10T09:00:00Z')), 20);
});

test('no discount below the minimum subtotal', () => {
  assert.strictEqual(couponDiscount(coupon, 20, new Date('2026-11-10T09:00:00Z')), 0);
});
