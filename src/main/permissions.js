'use strict';

const { desktopCapturer, Menu } = require('electron');
const { ALLOWED_ORIGINS } = require('./constants');

// Chromium denies these by default and fails *silently* -- the microphone
// button simply does nothing, with no error anywhere. It is the single most
// common reason a WhatsApp Web wrapper feels broken.
//
// Both handlers below are required. Some Chromium code paths query permission
// state synchronously and never fire the request handler, so without a check
// handler the permission reads back as denied even once it has been granted.
const GRANTED = new Set([
  'media',                     // microphone + camera: voice notes and calls
  'notifications',
  'clipboard-read',            // paste an image straight into a chat
  'clipboard-sanitized-write',
  'fullscreen',
  'display-capture'            // screen sharing during a call
]);

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Never grant blanket permission. A redirected or injected page asking for the
// microphone must not inherit WhatsApp's grant.
function isTrusted(origin) {
  return typeof origin === 'string' && ALLOWED_ORIGINS.has(origin);
}

function pickDisplayMediaSource(sources) {
  return new Promise((resolve) => {
    if (sources.length === 0) {
      resolve(null);
      return;
    }

    let picked = null;
    const menu = Menu.buildFromTemplate(
      sources.map((source) => ({
        label: source.name.length > 60 ? `${source.name.slice(0, 57)}...` : source.name,
        click: () => {
          picked = source;
        }
      }))
    );

    // Resolve on close so cancelling the picker rejects the share instead of
    // leaving the page waiting on a callback that never fires.
    menu.on('menu-will-close', () => setImmediate(() => resolve(picked)));
    menu.popup();
  });
}

function applyPermissionPolicy(ses) {
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = originOf(details?.requestingUrl || webContents?.getURL());
    callback(isTrusted(origin) && GRANTED.has(permission));
  });

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const origin = requestingOrigin || originOf(webContents?.getURL());
    return isTrusted(origin) && GRANTED.has(permission);
  });

  // Screen sharing. `useSystemPicker` uses the desktop portal where one exists
  // (Wayland), and our own menu is the fallback everywhere else.
  ses.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          fetchWindowIcons: false
        });
        const source = await pickDisplayMediaSource(sources);
        callback(source ? { video: source } : {});
      } catch {
        callback({});
      }
    },
    { useSystemPicker: true }
  );
}

module.exports = { applyPermissionPolicy };
