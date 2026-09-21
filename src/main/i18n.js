'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'i18n');
const FALLBACK = 'en';

function available() {
  try {
    return fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => path.basename(f, '.json'));
  } catch {
    return [FALLBACK];
  }
}

function read(locale) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, `${locale}.json`), 'utf8'));
  } catch {
    return null;
  }
}

class I18n {
  constructor(preferred) {
    const locale = preferred || app.getLocale() || FALLBACK;
    this.strings = read(locale) || read(locale.split('-')[0]) || read(FALLBACK) || {};
    this.fallback = read(FALLBACK) || {};
  }

  t(key, vars) {
    const template = this.strings[key] ?? this.fallback[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_match, name) => (name in vars ? String(vars[name]) : `{${name}}`));
  }
}

module.exports = { I18n, available };
