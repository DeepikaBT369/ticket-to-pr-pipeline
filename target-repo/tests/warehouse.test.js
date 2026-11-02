const test = require('node:test');
const assert = require('node:assert');
const { pickWarehouse } = require('../src/inventory/warehouse');

const list = [
  { id: 'far', distanceKm: 900, stock: { A: 50 } },
  { id: 'near', distanceKm: 40, stock: { A: 3 } },
  { id: 'mid', distanceKm: 300, stock: { A: 20 } },
];

test('picks the nearest warehouse that has enough stock', () => {
  assert.strictEqual(pickWarehouse(list, 'A', 10).id, 'mid');
});

test('returns null when nobody has enough', () => {
  assert.strictEqual(pickWarehouse(list, 'A', 500), null);
});
