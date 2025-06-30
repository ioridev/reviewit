# ReviewIt VSCode Extension Development Guide

## Setup

1. Install dependencies in both directories:

```bash
# Install main project dependencies (required for React app)
cd ..
npm install

# Install extension dependencies
cd vscode-extension
npm install
```

2. Build the extension:

```bash
# Build both TypeScript and React app
npm run build
```

## Development

1. Open the vscode-extension folder in VSCode
2. For development with hot reload:

   ```bash
   # Terminal 1: Watch TypeScript changes
   npm run watch

   # Terminal 2: Watch React app changes
   npm run dev:webview
   ```

3. Press `F5` to launch a new VSCode window with the extension loaded
4. Open a Git repository in the new window
5. Use Command Palette (`Cmd+Shift+P`) and search for "ReviewIt" commands

## Building for Distribution

1. Install vsce (Visual Studio Code Extension manager):

```bash
npm install -g vsce
```

2. Package the extension:

```bash
vsce package
```

This will create a `.vsix` file that can be installed in VSCode.

## Installing the Extension

### From VSIX file:

1. Open VSCode
2. Go to Extensions view (`Cmd+Shift+X`)
3. Click on "..." menu and select "Install from VSIX..."
4. Select the generated `.vsix` file

### For development:

1. Copy the vscode-extension folder to `~/.vscode/extensions/`
2. Restart VSCode

## Features Implemented

- ✅ Git diff parsing using simple-git
- ✅ WebView for displaying diffs with GitHub-like UI
- ✅ File list sidebar with status indicators
- ✅ Inline commenting system
- ✅ Multiple diff modes (commit, working, staged)
- ✅ SCM sidebar integration
- ✅ Syntax highlighting support (through VSCode themes)

## Architecture

```
vscode-extension/
├── src/
│   ├── extension.ts      # Main extension entry point
│   ├── gitDiffProvider.ts # Git operations and tree view
│   ├── reviewPanel.ts    # WebView panel management
│   └── types.ts         # TypeScript type definitions
├── media/
│   ├── main.js          # WebView JavaScript
│   └── style.css        # WebView styles
└── package.json         # Extension manifest
```

## Next Steps

Potential improvements:

- Add more keyboard shortcuts
- Implement side-by-side diff view
- Add support for comparing two commits
- Integrate with VSCode's built-in Git extension
- Add configuration options for UI customization
- Support for reviewing pull requests from GitHub/GitLab
