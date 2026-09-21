'use strict';

const { WebContentsView } = require('electron');
const EventEmitter = require('events');
const { sessionFor } = require('./session');
const { applyNavigationPolicy } = require('./navigation');
const { parseUnread } = require('./badge');
const { WHATSAPP_URL } = require('./constants');

// Owns one WebContentsView per account. Each view has its own persistent
// session, so accounts stay genuinely independent rather than sharing cookies.
class AccountManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.views = new Map();
    this.unread = new Map();
    this.activeId = null;
    this.win = null;
  }

  attach(win) {
    this.win = win;
  }

  list() {
    return this.config.accounts;
  }

  viewFor(id) {
    if (this.views.has(id)) return this.views.get(id);

    const ses = sessionFor(id, this.config);
    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: true
      }
    });

    const contents = view.webContents;
    applyNavigationPolicy(contents);

    contents.on('page-title-updated', (_event, title) => {
      const count = parseUnread(title);
      if (this.unread.get(id) !== count) {
        this.unread.set(id, count);
        this.emit('unread-changed', this.totalUnread());
      }
    });

    // A crashed renderer should come back on its own instead of leaving a
    // blank rectangle the user has to restart the app to clear.
    contents.on('render-process-gone', () => {
      if (!contents.isDestroyed()) contents.reload();
    });

    contents.loadURL(WHATSAPP_URL);

    this.views.set(id, view);
    this.unread.set(id, 0);
    return view;
  }

  activate(id) {
    if (!this.win) return;
    const account = this.list().find((entry) => entry.id === id) || this.list()[0];
    if (!account) return;

    const view = this.viewFor(account.id);
    const previous = this.activeId;
    this.activeId = account.id;

    if (previous && previous !== account.id && this.views.has(previous)) {
      // Detach rather than destroy: switching back should be instant and must
      // not cost a reload or a re-login.
      this.win.contentView.removeChildView(this.views.get(previous));
    }
    this.win.contentView.addChildView(view);
    this.emit('activated', account.id);
  }

  remove(id) {
    const view = this.views.get(id);
    if (view) {
      if (this.win) this.win.contentView.removeChildView(view);
      view.webContents.close();
      this.views.delete(id);
    }
    this.unread.delete(id);
    this.config.removeAccount(id);
    if (this.activeId === id) {
      this.activeId = null;
      this.activate(this.list()[0].id);
    }
    this.emit('unread-changed', this.totalUnread());
  }

  unreadFor(id) {
    return this.unread.get(id) || 0;
  }

  totalUnread() {
    let total = 0;
    for (const count of this.unread.values()) total += count;
    return total;
  }

  setBounds(bounds) {
    for (const [id, view] of this.views) {
      if (id === this.activeId) view.setBounds(bounds);
    }
  }

  reloadActive() {
    const view = this.views.get(this.activeId);
    if (view && !view.webContents.isDestroyed()) view.webContents.reload();
  }
}

module.exports = { AccountManager };
