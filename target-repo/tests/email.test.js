const test = require('node:test');
const assert = require('node:assert');
const { isValidEmail } = require('../src/utils/email');

// FAIL_TO_PASS: this is the bug. Fails on the original code, must pass after the fix.
test('address with no domain is rejected', () => {
  assert.strictEqual(isValidEmail('user@'), false);
});

// PASS_TO_PASS: must keep passing.
test('normal address is accepted', () => {
  assert.strictEqual(isValidEmail('user@example.com'), true);
});

// PASS_TO_PASS: must keep passing.
test('plus-addressing is accepted', () => {
  assert.strictEqual(isValidEmail('user+tag@example.com'), true);
});
