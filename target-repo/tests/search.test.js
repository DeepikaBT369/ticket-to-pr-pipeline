const test = require('node:test');
const assert = require('node:assert');
const { rankProducts } = require('../src/search/search');

const products = [
  { id: 1, name: 'Blue Shirt' },
  { id: 2, name: 'Blue Cotton Shirt' },
  { id: 3, name: 'Red Hat' },
];

test('more matching words rank higher', () => {
  assert.deepStrictEqual(rankProducts(products, 'blue cotton').map((p) => p.id), [2, 1]);
});

test('products with no match are dropped', () => {
  assert.strictEqual(rankProducts(products, 'sandal').length, 0);
});

test('an empty query returns everything', () => {
  assert.strictEqual(rankProducts(products, '  ').length, 3);
});
