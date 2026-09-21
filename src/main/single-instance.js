'use strict';

const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

// Electron's built-in single-instance lock keeps its socket under /tmp, and
// Flatpak gives every instance a private /tmp. The lock is therefore invisible
// between `flatpak run` invocations, so each launch starts another copy on the
// same Chromium profile -- and several Chromium processes sharing one profile
// corrupt it, which surfaces as being silently logged out.
//
// $XDG_RUNTIME_DIR/app/$FLATPAK_ID is bind-mounted into every instance of the
// same Flatpak app, so a socket placed there really is shared.
//
// Unix socket paths are limited to about 107 bytes, well under what a profile
// path can reach, so the socket is named from a digest of the profile rather
// than placed inside it. One lock per profile, short enough to always bind.
function socketPath() {
  const flatpakId = process.env.FLATPAK_ID;
  const runtimeDir = process.env.XDG_RUNTIME_DIR;

  const base = flatpakId && runtimeDir
    ? path.join(runtimeDir, 'app', flatpakId)
    : (runtimeDir || os.tmpdir());

  const digest = crypto.createHash('sha1').update(app.getPath('userData')).digest('hex').slice(0, 12);
  return path.join(base, `wa-unofficial-${digest}.sock`);
}

// Resolves true if this process is the primary instance. Resolves false if
// another instance is already running, having asked it to surface first.
function acquireSingleInstance(onActivate) {
  let socket;
  try {
    socket = socketPath();
    fs.mkdirSync(path.dirname(socket), { recursive: true });
  } catch {
    return Promise.resolve(true);
  }

  if (Buffer.byteLength(socket) > 100) {
    // Cannot bind a path this long; running unlocked beats refusing to start.
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;

      // Only the primary owns the socket, so only the primary removes it.
      // A secondary that cleaned up here would strand the primary's lock.
      if (value === true) {
        app.on('before-quit', () => {
          try {
            server.close();
            fs.unlinkSync(socket);
          } catch {
            /* best effort */
          }
        });
      }
      resolve(value);
    };

    const server = net.createServer((connection) => {
      connection.on('data', () => onActivate());
      connection.on('error', () => {});
      connection.end();
    });

    server.on('error', (error) => {
      if (error.code !== 'EADDRINUSE') {
        settle(true);
        return;
      }

      // The socket file exists, but it may be a leftover from a crash rather
      // than a live instance. Connecting is the only way to tell them apart.
      const probe = net.connect(socket);
      probe.on('connect', () => {
        probe.end('activate');
        settle(false);
      });
      probe.on('error', () => {
        try {
          fs.unlinkSync(socket);
        } catch {
          /* raced with another starting instance */
        }
        server.listen(socket, () => settle(true));
      });
    });

    server.listen(socket, () => settle(true));
  });
}

module.exports = { acquireSingleInstance };
