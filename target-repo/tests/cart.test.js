const test = require('node:test');
const assert = require('node:assert');
const { addItem, removeItem, itemCount, subtotal } = require('../src/cart/cart');

test('adding the same sku twice increases quantity', () => {
  let cart = { items: [] };
  cart = addItem(cart, { sku: 'A', price: 5 });
  cart = addItem(cart, { sku: 'A', price: 5 });
  assert.strictEqual(itemCount(cart), 2);
  assert.strictEqual(cart.items.length, 1);
});

test('removeItem drops the sku', () => {
  const cart = removeItem({ items: [{ sku: 'A', price: 5, qty: 1 }] }, 'A');
  assert.strictEqual(cart.items.length, 0);
});

test('subtotal multiplies price by quantity', () => {
  assert.strictEqual(subtotal({ items: [{ sku: 'A', price: 5, qty: 3 }, { sku: 'B', price: 2, qty: 1 }] }), 17);
});
