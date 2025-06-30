# ReviewIt for VSCode

A VSCode extension that provides GitHub-like diff viewing for Git commits directly in your editor.

## Features

- **GitHub-like UI**: Familiar file list and diff interface within VSCode
- **Multiple View Modes**: Show commit diffs, working directory changes, or staged changes
- **Inline Comments**: Add comments to specific lines for code review
- **File Navigation**: Click on files in the diff to open them in the editor
- **SCM Integration**: View changed files in the Source Control sidebar

## Commands

- `ReviewIt: Show Diff` - Show diff for any commit or special keywords
- `ReviewIt: Show Commit Diff` - Show diff for a specific commit
- `ReviewIt: Show Working Directory Changes` - Show unstaged changes
- `ReviewIt: Show Staged Changes` - Show staged changes

## Usage

1. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
2. Type "ReviewIt" to see available commands
3. Select a command and enter a commit reference:
   - Commit hash: `abc123`
   - Branch name: `main`, `feature/branch`
   - Relative refs: `HEAD`, `HEAD~3`
   - Special keywords:
     - `working` - unstaged changes
     - `staged` - staged changes
     - `.` - all uncommitted changes

## Keyboard Shortcuts

You can add custom keyboard shortcuts for ReviewIt commands in your keybindings.json:

```json
{
  "key": "ctrl+shift+d",
  "command": "reviewit.showDiff"
}
```

## Requirements

- VSCode version 1.74.0 or higher
- Git repository

## Extension Settings

This extension contributes the following settings:

- `reviewit.comments`: Stores review comments (managed automatically)

## Development

```bash
# Install dependencies
cd vscode-extension
npm install

# Compile
npm run compile

# Watch mode
npm run watch
```

## License

MIT
