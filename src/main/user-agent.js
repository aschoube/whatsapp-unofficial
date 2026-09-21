'use strict';

// WhatsApp Web picks what to serve based on the User-Agent, and Electron's
// default carries an `Electron/<version>` token plus the app name. That can get
// us the "unsupported browser" page.
//
// We rebuild a plain desktop Chrome UA from the Chromium version Electron
// actually ships, so it stays truthful across Electron upgrades. A hardcoded
// version string would rot silently and resurface as a broken app months later.
//
// The version is a parameter so the policy can be tested outside Electron,
// where `process.versions.chrome` does not exist.
function chromeUserAgent(chromeVersion = process.versions.chrome) {
  const version = chromeVersion || '0.0.0.0';
  return (
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    `Chrome/${version} Safari/537.36`
  );
}

module.exports = { chromeUserAgent };
