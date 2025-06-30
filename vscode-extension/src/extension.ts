import * as vscode from 'vscode';
import { GitDiffProvider } from './gitDiffProvider';
import { ReviewPanel } from './reviewPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('[ReviewIt] Extension is now active!');

  // Output channel for debugging
  const outputChannel = vscode.window.createOutputChannel('ReviewIt');
  outputChannel.appendLine('[ReviewIt] Extension activated');

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('reviewit.showDiff', async () => {
      const commitish = await vscode.window.showInputBox({
        prompt: 'Enter commit hash, branch name, or special keyword (working, staged, .)',
        placeHolder: 'HEAD, main, working, staged, .',
        value: 'HEAD',
      });

      if (commitish) {
        ReviewPanel.createOrShow(context.extensionUri, commitish);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('reviewit.showCommit', async () => {
      const commitish = await vscode.window.showInputBox({
        prompt: 'Enter commit hash or reference',
        placeHolder: 'HEAD, main, abc123...',
        value: 'HEAD',
      });

      if (commitish) {
        ReviewPanel.createOrShow(context.extensionUri, commitish);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('reviewit.showWorking', () => {
      ReviewPanel.createOrShow(context.extensionUri, 'working');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('reviewit.showStaged', () => {
      ReviewPanel.createOrShow(context.extensionUri, 'staged');
    })
  );

  // Register file explorer context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('reviewit.showFileHistory', async (uri: vscode.Uri) => {
      if (uri) {
        // Show file history in ReviewIt panel
        ReviewPanel.createOrShow(context.extensionUri, 'HEAD', uri.fsPath);
      }
    })
  );

  // Register tree data provider for SCM view
  const provider = new GitDiffProvider(vscode.workspace.rootPath || '');
  vscode.window.registerTreeDataProvider('reviewit.filesView', provider);
  vscode.commands.registerCommand('reviewit.refreshFiles', () => provider.refresh());
}

export function deactivate() {}
