'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { parseUnread } = require('../src/main/badge');
const { chromeUserAgent } = require('../src/main/user-agent');
const { isAllowed } = require('../src/main/navigation');

test('unread count is read from the window title', () => {
  assert.equal(parseUnread('(3) WhatsApp'), 3);
  assert.equal(parseUnread('(99+) WhatsApp'), 99);
  assert.equal(parseUnread('WhatsApp'), 0);
  assert.equal(parseUnread(''), 0);
  assert.equal(parseUnread(undefined), 0);
  // A chat named "(hi)" must not register as unread.
  assert.equal(parseUnread('(hi) WhatsApp'), 0);
});

test('user agent advertises Chrome, never Electron', () => {
  const ua = chromeUserAgent('152.0.7977.130');
  assert.ok(!/Electron/i.test(ua), `UA leaked Electron: ${ua}`);
  assert.ok(!/whatsapp-unofficial/i.test(ua), `UA leaked the app name: ${ua}`);
  assert.match(ua, /Chrome\/\d+\.\d+\.\d+\.\d+ Safari\/537\.36$/);
  // Derived from the running Chromium, so it cannot go stale.
  assert.ok(ua.includes('152.0.7977.130'));
});

test('user agent falls back cleanly outside Electron', () => {
  assert.match(chromeUserAgent(undefined), /Chrome\/0\.0\.0\.0 Safari/);
});

test('only WhatsApp Web may be navigated to in-place', () => {
  assert.equal(isAllowed('https://web.whatsapp.com/'), true);
  assert.equal(isAllowed('https://web.whatsapp.com/send?phone=1'), true);

  assert.equal(isAllowed('http://web.whatsapp.com/'), false, 'plain http must not pass');
  assert.equal(isAllowed('https://whatsapp.com/'), false);
  assert.equal(isAllowed('https://web.whatsapp.com.evil.test/'), false, 'suffix attack must not pass');
  assert.equal(isAllowed('https://evil.test/'), false);
  assert.equal(isAllowed('file:///etc/passwd'), false);
  assert.equal(isAllowed('javascript:alert(1)'), false);
  assert.equal(isAllowed('not a url'), false);
});
