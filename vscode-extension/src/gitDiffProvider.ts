import * as vscode from 'vscode';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import { DiffFile, DiffChunk, DiffLine, DiffResponse } from './types';

export class GitDiffProvider implements vscode.TreeDataProvider<DiffFileItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DiffFileItem | undefined | null | void> =
    new vscode.EventEmitter<DiffFileItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DiffFileItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private git: SimpleGit;
  private diffFiles: DiffFile[] = [];
  private currentCommitish = 'HEAD';

  constructor(private workspaceRoot: string) {
    this.git = simpleGit(workspaceRoot);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DiffFileItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DiffFileItem): Thenable<DiffFileItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No workspace folder open');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve([]);
    } else {
      return this.getDiffFiles();
    }
  }

  private async getDiffFiles(): Promise<DiffFileItem[]> {
    try {
      const diff = await this.parseDiff(this.currentCommitish);
      this.diffFiles = diff.files;
      return diff.files.map(
        (file) =>
          new DiffFileItem(
            file.path,
            file.status,
            file.additions,
            file.deletions,
            vscode.TreeItemCollapsibleState.None
          )
      );
    } catch (error) {
      console.error('Error getting diff files:', error);
      return [];
    }
  }

  async parseDiff(commitish: string, ignoreWhitespace = false): Promise<DiffResponse> {
    try {
      let resolvedCommit: string;
      let diffArgs: string[];

      if (commitish === '.') {
        resolvedCommit = 'Working Directory (all uncommitted changes)';
        diffArgs = ['HEAD'];
      } else if (commitish === 'working') {
        resolvedCommit = 'Working Directory (unstaged changes)';
        diffArgs = [];
      } else if (commitish === 'staged') {
        resolvedCommit = 'Staging Area (staged changes)';
        diffArgs = ['--cached'];
      } else {
        const fullHash = await this.git.revparse([commitish]);
        const shortHash = fullHash.substring(0, 7);
        const parentHash = await this.git.revparse([`${commitish}^`]);
        const shortParentHash = parentHash.substring(0, 7);
        resolvedCommit = `${shortParentHash}..${shortHash}`;
        diffArgs = [`${commitish}^`, commitish];
      }

      if (ignoreWhitespace) {
        diffArgs.push('-w');
      }

      const diffSummary = await this.git.diffSummary(diffArgs);
      const diffRaw = await this.git.diff(['--color=never', ...diffArgs]);

      const files = this.parseUnifiedDiff(diffRaw, diffSummary.files);

      return {
        commit: resolvedCommit,
        files,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse diff for ${commitish}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseUnifiedDiff(diffText: string, summary: any[]): DiffFile[] {
    const files: DiffFile[] = [];
    const fileBlocks = diffText.split(/^diff --git /m).slice(1);

    for (let i = 0; i < fileBlocks.length; i++) {
      const block = `diff --git ${fileBlocks[i]}`;
      const summaryItem = summary[i];

      if (!summaryItem) continue;

      const file = this.parseFileBlock(block, summaryItem);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  private parseFileBlock(block: string, summary: any): DiffFile | null {
    const lines = block.split('\n');
    const headerLine = lines[0];

    const pathMatch = headerLine.match(/^diff --git [a-z]\/(.+) [a-z]\/(.+)$/);
    if (!pathMatch) return null;

    const oldPath = pathMatch[1];
    const newPath = pathMatch[2];
    const path = newPath;

    let status: DiffFile['status'] = 'modified';
    if (summary.binary) return null;

    if (oldPath !== newPath) {
      status = 'renamed';
    } else if (summary.insertions && !summary.deletions) {
      status = 'added';
    } else if (summary.deletions && !summary.insertions) {
      status = 'deleted';
    }

    const chunks = this.parseChunks(lines);

    return {
      path,
      oldPath: oldPath !== newPath ? oldPath : undefined,
      status,
      additions: summary.insertions || 0,
      deletions: summary.deletions || 0,
      chunks,
    };
  }

  private parseChunks(lines: string[]): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    let currentChunk: DiffChunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }

        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
        if (match) {
          const oldStart = parseInt(match[1]);
          const oldLines = parseInt(match[2] || '1');
          const newStart = parseInt(match[3]);
          const newLines = parseInt(match[4] || '1');

          oldLineNum = oldStart;
          newLineNum = newStart;

          currentChunk = {
            header: line,
            oldStart,
            oldLines,
            newStart,
            newLines,
            lines: [],
          };
        }
      } else if (
        currentChunk &&
        (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))
      ) {
        const type = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'delete' : 'normal';

        const diffLine: DiffLine = {
          type,
          content: line.slice(1),
          oldLineNumber: type !== 'add' ? oldLineNum : undefined,
          newLineNumber: type !== 'delete' ? newLineNum : undefined,
        };

        currentChunk.lines.push(diffLine);

        if (type !== 'add') oldLineNum++;
        if (type !== 'delete') newLineNum++;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  async setCommitish(commitish: string) {
    this.currentCommitish = commitish;
    this.refresh();
  }
}

export class DiffFileItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly status: string,
    public readonly additions: number,
    public readonly deletions: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);

    this.tooltip = `${this.label} (+${this.additions} -${this.deletions})`;
    this.description = `+${this.additions} -${this.deletions}`;

    // Set icon based on status
    switch (status) {
      case 'added':
        this.iconPath = new vscode.ThemeIcon(
          'add',
          new vscode.ThemeColor('gitDecoration.addedResourceForeground')
        );
        break;
      case 'deleted':
        this.iconPath = new vscode.ThemeIcon(
          'remove',
          new vscode.ThemeColor('gitDecoration.deletedResourceForeground')
        );
        break;
      case 'modified':
        this.iconPath = new vscode.ThemeIcon(
          'edit',
          new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')
        );
        break;
      case 'renamed':
        this.iconPath = new vscode.ThemeIcon(
          'arrow-both',
          new vscode.ThemeColor('gitDecoration.renamedResourceForeground')
        );
        break;
    }
  }
}
