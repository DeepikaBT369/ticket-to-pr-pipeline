const test = require('node:test');
const assert = require('node:assert');
const { canTransition, advance } = require('../src/orders/orderStatus');

test('a placed order can be paid', () => {
  assert.strictEqual(canTransition('placed', 'paid'), true);
});

test('a shipped order cannot be cancelled', () => {
  assert.strictEqual(canTransition('shipped', 'cancelled'), false);
});

test('advance throws on an invalid move', () => {
  assert.throws(() => advance({ status: 'placed' }, 'delivered'), /Cannot move/);
});
