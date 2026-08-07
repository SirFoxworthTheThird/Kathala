# Installation

PlotWeave runs as a web application and as a standalone desktop app. Choose whichever suits you — the data format is the same, so you can move between them.

---

## Requirements

- A modern browser (Chrome, Edge, Firefox, or Safari), **or** Node.js 18+ if building the desktop app from source.

No account, server, or internet connection is required after the page loads. Everything is stored locally in your browser's IndexedDB.

> **Folder sync** ([World Settings](World-Settings)) uses the File System Access API, which is available on **Chrome, Edge, and the desktop app**. Everything else works everywhere.

---

## Option 1: The web app

1. Open the PlotWeave URL for your instance.
2. It loads entirely in the browser — there is no installation step.
3. Bookmark it, or add it to your home screen.

> **Important:** clearing your browser's site data deletes your worlds. [Export](Export-and-Import) regularly, or bind each world to a [sync folder](World-Settings).

---

## Option 2: The desktop app

The desktop app runs PlotWeave in a native window and avoids the browser data-clearing risk.

Download an installer from the repository's [Releases](https://github.com/SirFoxworthTheThird/PlotWeave/releases) page:

| Platform | File |
|---|---|
| Windows | `PlotWeave-*-Setup.exe` |
| macOS | `PlotWeave-*.zip` — unzip and drag to Applications. On first run, right-click → Open if macOS warns about the developer |
| Linux | `plotweave_*.deb` — `sudo dpkg -i plotweave_*.deb` |

### Building from source

```
git clone https://github.com/SirFoxworthTheThird/PlotWeave.git
cd PlotWeave
npm install
npm run electron:dev      # run in development
npm run electron:make     # build installers into out/
```

---

## Verifying

You should land on the **world selector** — the screen listing your worlds, with **New World**, **Import**, **Import Manuscript**, **Generate World from AI**, and **Library**.

An empty selector means the install worked and you're ready to [get started](Getting-Started).

---

## Where data lives

| Mode | Storage |
|---|---|
| Web app | Browser IndexedDB, per origin |
| Desktop app | The app's user-data directory |

Use [Export and Import](Export-and-Import) to move between them.

---

## Related pages

- [Getting Started](Getting-Started) · [The Library](Library) · [Export and Import](Export-and-Import)
