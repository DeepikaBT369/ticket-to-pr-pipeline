const test = require('node:test');
const assert = require('node:assert');
const { isWeekend, addBusinessDays } = require('../src/shipping/deliveryDate');

const iso = (d) => d.toISOString().slice(0, 10);

// FAIL_TO_PASS: the bug. Friday + 1 business day is Monday, not Saturday.
test('Friday plus one business day lands on Monday', () => {
  assert.strictEqual(iso(addBusinessDays(new Date('2026-11-06T12:00:00Z'), 1)), '2026-11-09');
});

// FAIL_TO_PASS: also crosses a weekend mid-way
test('Thursday plus three business days lands on Tuesday', () => {
  assert.strictEqual(iso(addBusinessDays(new Date('2026-11-05T12:00:00Z'), 3)), '2026-11-10');
});

// PASS_TO_PASS
test('Monday plus two business days is Wednesday', () => {
  assert.strictEqual(iso(addBusinessDays(new Date('2026-11-02T12:00:00Z'), 2)), '2026-11-04');
});

test('zero days returns the same date', () => {
  assert.strictEqual(iso(addBusinessDays(new Date('2026-11-02T12:00:00Z'), 0)), '2026-11-02');
});

test('isWeekend is true for Saturday and Sunday only', () => {
  assert.strictEqual(isWeekend(new Date('2026-11-07T12:00:00Z')), true);
  assert.strictEqual(isWeekend(new Date('2026-11-08T12:00:00Z')), true);
  assert.strictEqual(isWeekend(new Date('2026-11-09T12:00:00Z')), false);
});
