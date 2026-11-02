const test = require('node:test');
const assert = require('node:assert');
const { slugify } = require('../src/utils/slugify');

test('lowercases and joins words with dashes', () => {
  assert.strictEqual(slugify('Blue Cotton Shirt'), 'blue-cotton-shirt');
});

test('strips accents and punctuation', () => {
  assert.strictEqual(slugify('Crème brûlée!'), 'creme-brulee');
});
