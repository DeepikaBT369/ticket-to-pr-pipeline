const test = require('node:test');
const assert = require('node:assert');
const { renderTemplate, orderShippedMessage } = require('../src/notifications/template');

// FAIL_TO_PASS: the bug. Every occurrence must be replaced, not just the first.
test('a placeholder used twice is replaced both times', () => {
  assert.strictEqual(renderTemplate('{{n}} and {{n}}', { n: 'Ada' }), 'Ada and Ada');
});

// PASS_TO_PASS
test('fills a single placeholder', () => {
  assert.strictEqual(renderTemplate('Hi {{n}}', { n: 'Ada' }), 'Hi Ada');
});

test('leaves unknown placeholders as they are', () => {
  assert.strictEqual(renderTemplate('Hi {{who}}', { n: 'Ada' }), 'Hi {{who}}');
});

test('orderShippedMessage names the customer and the order', () => {
  const msg = orderShippedMessage({ customerName: 'Ada', id: 'ORD-000001' });
  assert.ok(msg.includes('ORD-000001'));
  assert.ok(!msg.includes('{{'));
});
