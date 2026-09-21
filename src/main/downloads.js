'use strict';

const { app, Notification, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// Keep the basename but avoid clobbering an existing file, the way a browser
// does: photo.jpg, photo (1).jpg, photo (2).jpg...
function uniquePath(dir, filename) {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  let candidate = path.join(dir, filename);
  let n = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem} (${n})${ext}`);
    n += 1;
  }
  return candidate;
}

function applyDownloadPolicy(ses, config) {
  ses.on('will-download', (event, item) => {
    if (!config.get('prefs.askDownloadLocation')) {
      const dir = app.getPath('downloads');
      try {
        fs.mkdirSync(dir, { recursive: true });
        item.setSavePath(uniquePath(dir, item.getFilename()));
      } catch {
        // Fall through to Chromium's own save dialog.
      }
    }

    item.once('done', (_event, state) => {
      if (state !== 'completed' || !Notification.isSupported()) return;
      const savedTo = item.getSavePath();
      const notification = new Notification({
        title: 'Download complete',
        body: path.basename(savedTo)
      });
      notification.on('click', () => shell.showItemInFolder(savedTo));
      notification.show();
    });
  });
}

module.exports = { applyDownloadPolicy };
