'use strict';

const { ALLOWED_ORIGINS } = require('./constants');

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isAllowed(url) {
  const origin = originOf(url);
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

function openExternal(url) {
  // Only hand http(s) to the desktop. Anything else (file:, javascript:, and
  // whatever a compromised page might invent) is dropped.
  const scheme = originOf(url) ? new URL(url).protocol : null;
  if (scheme === 'http:' || scheme === 'https:') {
    // Required lazily so this module's URL policy stays unit-testable
    // outside an Electron process.
    require('electron').shell.openExternal(url).catch(() => {});
  }
}

// We load a remote origin we do not control, so navigation is locked down:
// links leave for the user's browser and the view itself never leaves WhatsApp.
function applyNavigationPolicy(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (!isAllowed(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  // A remote page must never reach a renderer with Node available.
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

module.exports = { applyNavigationPolicy, isAllowed, openExternal };
