'use strict';

const { session } = require('electron');
const { applyPermissionPolicy } = require('./permissions');
const { applyDownloadPolicy } = require('./downloads');
const { chromeUserAgent } = require('./user-agent');

// One persistent partition per account. The `persist:` prefix is what survives
// a restart -- without it every launch means a fresh QR scan.
function sessionFor(accountId, config) {
  const ses = session.fromPartition(`persist:${accountId}`);

  ses.setUserAgent(chromeUserAgent());
  applyPermissionPolicy(ses);
  applyDownloadPolicy(ses, config);

  const languages = config.get('prefs.spellcheckLanguages');
  if (Array.isArray(languages) && languages.length > 0) {
    try {
      ses.setSpellCheckerLanguages(languages);
    } catch {
      // An unsupported locale should not take the whole session down.
    }
  }

  return ses;
}

module.exports = { sessionFor };
