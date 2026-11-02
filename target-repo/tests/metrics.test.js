const test = require('node:test');
const assert = require('node:assert');
const { average, median, conversionRate } = require('../src/analytics/metrics');

test('average of numbers', () => {
  assert.strictEqual(average([2, 4, 9]), 5);
});

test('median of an even-length list is the middle pair mean', () => {
  assert.strictEqual(median([1, 9, 3, 5]), 4);
});

test('conversionRate handles zero visits', () => {
  assert.strictEqual(conversionRate(5, 0), 0);
});
