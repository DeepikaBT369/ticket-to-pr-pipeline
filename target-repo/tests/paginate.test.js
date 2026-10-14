const test = require('node:test');
const assert = require('node:assert');
const { paginate } = require('../src/utils/paginate');

const items = ['a', 'b', 'c', 'd', 'e'];

// FAIL_TO_PASS: this is the bug. Fails on the original code, must pass after the fix.
test('page beyond the last page returns an empty array instead of throwing', () => {
  assert.doesNotThrow(() => paginate(items, 5, 2));
  assert.deepStrictEqual(paginate(items, 5, 2), []);
});

// PASS_TO_PASS: must keep passing.
test('valid page returns the correct slice', () => {
  assert.deepStrictEqual(paginate(items, 2, 2), ['c', 'd']);
});

// PASS_TO_PASS: must keep passing.
test('first page returns items from the start', () => {
  assert.deepStrictEqual(paginate(items, 1, 2), ['a', 'b']);
});
