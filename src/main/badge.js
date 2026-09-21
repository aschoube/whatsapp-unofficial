'use strict';

// WhatsApp Web puts the unread count in the document title as "(3) WhatsApp",
// and uses "(99+)" past a hundred.
//
// We read the title rather than the DOM on purpose: WhatsApp reshuffles its
// markup constantly, so any selector we picked would break within months. The
// title format has been stable for years.
const TITLE_UNREAD = /^\((\d+)\+?\)/;

function parseUnread(title) {
  const match = TITLE_UNREAD.exec(title || '');
  if (!match) return 0;
  const count = parseInt(match[1], 10);
  return Number.isFinite(count) ? count : 0;
}

module.exports = { parseUnread };
