# Store screenshots

Flathub will not accept a submission without at least one screenshot, and the
AppStream metainfo in `packaging/flatpak/` points at this directory by tag:

    https://raw.githubusercontent.com/aschoube/whatsapp-unofficial/v0.1.0/docs/screenshots/<name>.png

Expected files:

| File                | Shows                                    |
| ------------------- | ---------------------------------------- |
| `conversation.png`  | A conversation open in the desktop window |
| `tray.png`          | The unread badge on the tray icon         |

Requirements:

- PNG, at least 620px wide; 16:9-ish framing reads best in the store.
- Capture the window only, without the desktop behind it.
- **Use a test account.** These are published permanently and publicly, so
  real contact names, phone numbers and message previews must not appear.
- Re-tag or update the URLs in
  `packaging/flatpak/io.github.aschoube.whatsapp-unofficial.metainfo.xml`
  if the files land on a different ref.

Validate after adding them:

    appstreamcli validate --pedantic \
      packaging/flatpak/io.github.aschoube.whatsapp-unofficial.metainfo.xml
