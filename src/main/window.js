'use strict';

const { BaseWindow, WebContentsView, screen } = require('electron');
const path = require('path');

const SIDEBAR_WIDTH = 64;

// A BaseWindow hosting one WebContentsView per account, plus a local sidebar
// view for switching between them. The sidebar is our own HTML -- WhatsApp's
// page never sees it and it never sees WhatsApp's session.
class MainWindow {
  constructor(config, accounts) {
    this.config = config;
    this.accounts = accounts;
    this.quitting = false;

    const saved = config.get('window');
    this.win = new BaseWindow({
      width: saved.width,
      height: saved.height,
      x: this.onScreen(saved) ? saved.x : undefined,
      y: this.onScreen(saved) ? saved.y : undefined,
      minWidth: 620,
      minHeight: 480,
      show: false,
      autoHideMenuBar: true,
      icon: path.join(__dirname, '..', '..', 'build', 'icon-512.png'),
      title: 'WhatsApp Unofficial'
    });

    if (saved.maximized) this.win.maximize();

    this.sidebar = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'ui.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    this.sidebar.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'sidebar.html'));
    this.win.contentView.addChildView(this.sidebar);

    accounts.attach(this.win);

    this.win.on('resize', () => this.layout());
    this.win.on('maximize', () => this.layout());
    this.win.on('unmaximize', () => this.layout());
    this.win.on('close', (event) => this.onClose(event));
  }

  // A remembered position can point at a monitor that is no longer attached,
  // which would open the window somewhere the user cannot reach it.
  onScreen(saved) {
    if (saved.x == null || saved.y == null) return false;
    return screen.getAllDisplays().some(({ workArea }) =>
      saved.x >= workArea.x &&
      saved.y >= workArea.y &&
      saved.x < workArea.x + workArea.width &&
      saved.y < workArea.y + workArea.height);
  }

  get sidebarVisible() {
    return this.accounts.list().length > 1;
  }

  layout() {
    const { width, height } = this.win.getContentBounds();
    const offset = this.sidebarVisible ? SIDEBAR_WIDTH : 0;
    this.sidebar.setBounds({ x: 0, y: 0, width: offset, height });
    this.accounts.setBounds({ x: offset, y: 0, width: Math.max(0, width - offset), height });
  }

  refreshSidebar() {
    const accounts = this.accounts.list().map((account) => ({
      ...account,
      unread: this.accounts.unreadFor(account.id),
      active: account.id === this.accounts.activeId
    }));
    if (!this.sidebar.webContents.isDestroyed()) {
      this.sidebar.webContents.send('accounts:changed', accounts);
    }
    this.layout();
  }

  onClose(event) {
    this.persistBounds();
    if (this.quitting || !this.config.get('prefs.closeToTray')) return;
    // Close means hide, not exit -- but only while a tray icon exists to get
    // the window back. Quitting from the tray sets `quitting` first, otherwise
    // the app becomes impossible to exit from its own UI.
    event.preventDefault();
    this.win.hide();
  }

  persistBounds() {
    if (this.win.isDestroyed()) return;
    const maximized = this.win.isMaximized();
    this.config.set('window.maximized', maximized);
    if (!maximized) {
      const { x, y, width, height } = this.win.getBounds();
      this.config.set('window', { x, y, width, height, maximized: false });
    }
  }

  show() {
    this.win.show();
    this.win.focus();
  }

  toggle() {
    if (this.win.isVisible() && !this.win.isMinimized()) {
      this.win.hide();
    } else {
      if (this.win.isMinimized()) this.win.restore();
      this.show();
    }
  }
}

module.exports = { MainWindow, SIDEBAR_WIDTH };
