# Desktop Buddy

A transparent desktop widget that displays looping videos as little desktop pets!

## Download

Grab the latest **Desktop Buddy Setup.exe** from the [Releases](https://github.com/Slangnes/DesktopBuddy/releases) page. Run the installer and you're good to go.

## Features

- **Transparent window** — only your buddy is visible, no background
- **Always on top** — stays above other windows
- **Drag to move** — click and drag anywhere on your buddy
- **Scroll to resize** — mouse wheel or drag the corner handle
- **Chroma key** — remove solid-color backgrounds with eyedropper + tolerance
- **Mask painting** — manually paint away areas you don't want
- **Multiple buddies** — run as many as you like at the same time
- **Export & import** — share `.buddy` files with friends
- **Remembers state** — position, size, and settings persist between sessions

## Usage

1. Run the app — a dropzone appears
2. Drag & drop a video file (webm, mp4, gif, webp) or click to browse
3. **Click + drag** to move your buddy around
4. **Scroll wheel** to resize
5. **Shift + Right-click** to open the controls panel (chroma key, mask, opacity, export, etc.)

## Sharing Buddies

- **Export:** Open controls → Export → saves a `.buddy` file
- **Import:** Open controls → Import → select a `.buddy` file
- Share `.buddy` files with anyone who has Desktop Buddy installed!

## Uninstall

Windows Settings → Apps → Installed apps → Desktop Buddy → Uninstall

---

## Development

```bash
npm install
npm start
```

### Build installer

```bash
npm run build
```

The installer will be created in the `dist/` folder.
