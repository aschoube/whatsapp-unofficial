# WhatsApp Unofficial

An unofficial desktop client for WhatsApp Web on Linux — the thing WhatsApp
ships for Windows and macOS but not for us.

> **Not affiliated with, endorsed by, or connected to Meta Platforms, Inc. or
> WhatsApp Inc.** "WhatsApp" is their trademark; it is used here only to
> describe what this program is compatible with.
>
> This is a wrapper around `web.whatsapp.com` — it speaks no WhatsApp protocol
> of its own and reimplements nothing. Even so, using any unofficial client is
> a deviation from WhatsApp's Terms of Service. That risk is yours to weigh,
> and this README will not pretend otherwise.

## Why

WhatsApp Web in a browser tab loses itself among fifty others, has no tray, no
unread badge, no native notifications, and no way to hold two accounts at once.
This is that, fixed.

## Features

- Proper desktop window, tray icon and close-to-tray
- Native notifications and an unread badge on the tray and launcher
- **Multiple accounts** — each in its own isolated, persistent session
- Voice notes, calls and screen sharing
- Downloads routed to your XDG downloads directory
- Spell checking
- Light and dark, following your desktop
- Locked-down by default: no Node in the renderer, links open in your browser,
  and permissions granted only to WhatsApp's own origin

## Install

Download the `.deb` or `.AppImage` from
[Releases](https://github.com/aschoube/whatsapp-unofficial/releases).

```sh
sudo dpkg -i whatsapp-unofficial_*_amd64.deb
```

```sh
chmod +x WhatsApp-Unofficial-*.AppImage && ./WhatsApp-Unofficial-*.AppImage
```

### Arch

```sh
yay -S whatsapp-unofficial-bin
```

## Run from source

```sh
npm install
npm run icons     # regenerate PNGs from the vector mark
npm start
```

```sh
npm test          # UA, navigation and badge policy
npm run dist      # build .deb + .AppImage into dist/
```

## Known quirks

- **No tray icon on GNOME** — GNOME dropped tray support; install the
  AppIndicator extension. The app detects this, turns off close-to-tray and
  tells you, rather than hiding into a tray that isn't there.
- **Wayland** — launched with `--ozone-platform-hint=auto`. File an issue if
  your session still misbehaves.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Translations are the easiest place to
start: copy `src/i18n/en.json` and send it back in your language. (The tray and
menu are translatable today; the Settings window is not yet — that's a good
first issue.)

## License

[GPL-3.0-or-later](LICENSE).
