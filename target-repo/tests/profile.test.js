const test = require('node:test');
const assert = require('node:assert');
const { normalizeName, displayName } = require('../src/users/profile');

test('normalizeName trims, collapses spaces and title-cases', () => {
  assert.strictEqual(normalizeName('  aDA   lovelace '), 'Ada Lovelace');
});

test('displayName falls back to email, then Guest', () => {
  assert.strictEqual(displayName({ email: 'a@b.com' }), 'a@b.com');
  assert.strictEqual(displayName({}), 'Guest');
});
