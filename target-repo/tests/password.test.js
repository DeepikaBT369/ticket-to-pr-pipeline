const test = require('node:test');
const assert = require('node:assert');
const { validatePassword } = require('../src/users/password');

// FAIL_TO_PASS: the bug. 9 is a digit.
test('a password whose only digit is 9 is accepted', () => {
  assert.strictEqual(validatePassword('Sunshine9').ok, true);
});

// PASS_TO_PASS
test('a strong password is accepted', () => {
  assert.strictEqual(validatePassword('Sunshine4').ok, true);
});

test('a password with no digit is rejected', () => {
  const r = validatePassword('Sunshine');
  assert.strictEqual(r.ok, false);
  assert.ok(r.problems.includes('a digit'));
});

test('a short password is rejected', () => {
  assert.strictEqual(validatePassword('Ab1').ok, false);
});

test('a password with no uppercase letter is rejected', () => {
  assert.strictEqual(validatePassword('sunshine4').ok, false);
});
