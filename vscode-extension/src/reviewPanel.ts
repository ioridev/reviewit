import * as vscode from 'vscode';
import * as path from 'path';
import { GitDiffProvider } from './gitDiffProvider';
import { DiffResponse } from './types';

export class ReviewPanel {
  public static currentPanel: ReviewPanel | undefined;

  public static readonly viewType = 'reviewit.reviewPanel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private gitProvider: GitDiffProvider;
  private currentCommitish: string;

  public static createOrShow(extensionUri: vscode.Uri, commitish: string, filePath?: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (ReviewPanel.currentPanel) {
      ReviewPanel.currentPanel._panel.reveal(column);
      ReviewPanel.currentPanel.updateDiff(commitish, filePath);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      ReviewPanel.viewType,
      `ReviewIt: ${commitish}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'out'),
        ],
      }
    );

    ReviewPanel.currentPanel = new ReviewPanel(panel, extensionUri, commitish);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    ReviewPanel.currentPanel = new ReviewPanel(panel, extensionUri, 'HEAD');
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, commitish: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this.currentCommitish = commitish;
    this.gitProvider = new GitDiffProvider(vscode.workspace.rootPath || '');

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        console.log('[ReviewPanel] Received message:', message);
        switch (message.command) {
          case 'getDiff':
            this.sendDiffData(message.ignoreWhitespace);
            return;
          case 'refresh':
            this.refresh();
            return;
          case 'saveComment':
            this.saveComment(message.comment);
            return;
          case 'getComments':
            this.sendComments();
            return;
          case 'showFile':
            this.showFile(message.filePath);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    ReviewPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _update() {
    const webview = this._panel.webview;
    this._panel.title = `ReviewIt: ${this.currentCommitish}`;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private async updateDiff(commitish: string, filePath?: string) {
    this.currentCommitish = commitish;
    await this._update();
    this.sendDiffData();
  }

  private async sendDiffData(ignoreWhitespace = true) {
    console.log('[ReviewPanel] sendDiffData called with ignoreWhitespace:', ignoreWhitespace);
    try {
      const diffData = await this.gitProvider.parseDiff(this.currentCommitish, ignoreWhitespace);
      console.log('[ReviewPanel] Sending diffData:', diffData);
      this._panel.webview.postMessage({
        command: 'diffData',
        data: diffData,
      });
    } catch (error) {
      console.error('[ReviewPanel] Error getting diff:', error);
      vscode.window.showErrorMessage(`Failed to get diff: ${error}`);
    }
  }

  private async refresh() {
    this.sendDiffData();
  }

  private async saveComment(comment: any) {
    // Store comments in workspace state
    const comments = this.getStoredComments();
    comments[comment.id] = comment;
    await this.setStoredComments(comments);

    this._panel.webview.postMessage({
      command: 'commentSaved',
      comment: comment,
    });
  }

  private async sendComments() {
    const comments = this.getStoredComments();
    this._panel.webview.postMessage({
      command: 'comments',
      comments: Object.values(comments),
    });
  }

  private getStoredComments(): { [key: string]: any } {
    const state = vscode.workspace.getConfiguration('reviewit');
    return state.get('comments', {});
  }

  private async setStoredComments(comments: { [key: string]: any }) {
    const config = vscode.workspace.getConfiguration('reviewit');
    await config.update('comments', comments, vscode.ConfigurationTarget.Workspace);
  }

  private async showFile(filePath: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const uri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, filePath));
      await vscode.window.showTextDocument(uri);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get URIs for the built React app
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'index.css')
    );

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:; connect-src ${webview.cspSource};">
                <link href="${styleUri}" rel="stylesheet">
                <title>ReviewIt</title>
            </head>
            <body>
                <div id="root"></div>
                <script type="module" src="${scriptUri}"></script>
            </body>
            </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
