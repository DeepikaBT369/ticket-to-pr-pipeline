const test = require('node:test');
const assert = require('node:assert');
const { formatOrderId, parseOrderId } = require('../src/orders/orderId');

test('formats with zero padding', () => {
  assert.strictEqual(formatOrderId(42), 'ORD-000042');
});

test('parses a valid id', () => {
  assert.strictEqual(parseOrderId('ORD-000042'), 42);
});

test('rejects a malformed id', () => {
  assert.strictEqual(parseOrderId('42'), null);
});
