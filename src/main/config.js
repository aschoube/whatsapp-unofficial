'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  // Partition names are a frozen public API: renaming one logs that account
  // out permanently, with no recovery path. Never rewrite an existing id.
  accounts: [{ id: 'account-1', name: 'Account 1' }],
  prefs: {
    closeToTray: true,
    startMinimized: false,
    askDownloadLocation: false,
    spellcheckLanguages: ['en-US'],
    locale: null
  },
  window: { width: 1100, height: 760, x: null, y: null, maximized: false }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(defaults, stored) {
  if (Array.isArray(defaults)) return Array.isArray(stored) ? stored : clone(defaults);
  if (defaults && typeof defaults === 'object') {
    const out = {};
    for (const key of Object.keys(defaults)) {
      out[key] = merge(defaults[key], stored ? stored[key] : undefined);
    }
    return out;
  }
  return stored === undefined ? defaults : stored;
}

class Config {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'config.json');
    this.data = clone(DEFAULTS);
    this.load();
  }

  load() {
    try {
      this.data = merge(DEFAULTS, JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch {
      // Missing or corrupt config is not an error worth bothering the user
      // about -- fall back to defaults and rewrite on the next save.
      this.data = clone(DEFAULTS);
    }
  }

  save() {
    // Write-then-rename, so a crash mid-write cannot leave a truncated config
    // that would reset every account on next launch.
    const tmp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch {
      /* best effort */
    }
  }

  get(dotted) {
    return dotted.split('.').reduce((node, key) => (node == null ? undefined : node[key]), this.data);
  }

  set(dotted, value) {
    const keys = dotted.split('.');
    const last = keys.pop();
    const target = keys.reduce((node, key) => {
      if (node[key] == null || typeof node[key] !== 'object') node[key] = {};
      return node[key];
    }, this.data);
    target[last] = value;
    this.save();
  }

  get accounts() {
    return this.data.accounts;
  }

  addAccount(name) {
    // Derive the next id from the highest existing one rather than the array
    // length, so removing account-2 then adding one cannot resurrect its
    // partition and hand a stranger's session to a new account.
    const highest = this.data.accounts.reduce((max, account) => {
      const n = parseInt(String(account.id).replace('account-', ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    const account = { id: `account-${highest + 1}`, name: name || `Account ${highest + 1}` };
    this.data.accounts.push(account);
    this.save();
    return account;
  }

  removeAccount(id) {
    this.data.accounts = this.data.accounts.filter((account) => account.id !== id);
    if (this.data.accounts.length === 0) this.data.accounts = clone(DEFAULTS.accounts);
    this.save();
  }

  renameAccount(id, name) {
    const account = this.data.accounts.find((entry) => entry.id === id);
    if (account) {
      account.name = name;
      this.save();
    }
  }
}

module.exports = { Config };
