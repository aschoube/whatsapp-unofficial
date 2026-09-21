# Contributing

Bug reports, translations and patches are all welcome.

## Getting set up

```sh
npm install
npm start
npm test
```

## Ground rules

**Never add WhatsApp protocol code.** This project wraps `web.whatsapp.com` in
a browser view and nothing more. Clients that reimplement the protocol get
their users' accounts permanently banned — that boundary is the whole reason
this app is safe to use, and a PR that crosses it will be closed.

**Do not weaken the renderer sandbox.** `contextIsolation`, `sandbox` and
`nodeIntegration: false` stay as they are. We load a remote origin we do not
control; it must never reach Node.

**Do not scrape the DOM for state.** WhatsApp reshuffles its markup constantly.
The unread count comes from `document.title`, which has been stable for years.
If you need new state, find a similarly stable source or open an issue first.

**Never rename an existing session partition.** Partition ids in
`src/main/config.js` are a frozen public API: renaming one logs that user out
permanently with no recovery.

## Translations

Copy `src/i18n/en.json` to `src/i18n/<locale>.json` and translate the values.
Keys with `{braces}` are placeholders — leave them intact. No code changes are
needed; the locale is picked up automatically.

This currently covers the tray and the application menu. The Settings window's
strings are still hardcoded English in `src/renderer/` — moving them into the
same JSON files is a self-contained first contribution, and a wanted one.

## Commits

Describe what changed and why. Keep unrelated changes in separate commits.
