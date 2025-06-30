(function () {
  const vscode = window.vscode;
  let currentDiffData = null;
  let selectedFile = null;
  let comments = {};

  // Listen for messages from the extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
      case 'diffData':
        currentDiffData = message.data;
        renderDiffViewer();
        break;
      case 'comments':
        comments = message.comments.reduce((acc, comment) => {
          const key = `${comment.file}:${comment.line}`;
          acc[key] = comment;
          return acc;
        }, {});
        if (selectedFile) {
          renderDiffContent(selectedFile);
        }
        break;
      case 'commentSaved':
        const comment = message.comment;
        const key = `${comment.file}:${comment.line}`;
        comments[key] = comment;
        if (selectedFile) {
          renderDiffContent(selectedFile);
        }
        break;
    }
  });

  function renderDiffViewer() {
    const root = document.getElementById('root');
    if (!currentDiffData) {
      root.innerHTML = '<div class="loading">Loading diff...</div>';
      return;
    }

    root.innerHTML = `
            <div class="diff-viewer">
                <div class="file-list">
                    ${renderFileList()}
                </div>
                <div class="diff-content">
                    <div class="no-file-selected">Select a file to view changes</div>
                </div>
            </div>
        `;

    // Add click handlers to file items
    document.querySelectorAll('.file-item').forEach((item) => {
      item.addEventListener('click', () => {
        const filePath = item.dataset.path;
        selectFile(filePath);
      });
    });
  }

  function renderFileList() {
    return currentDiffData.files
      .map((file) => {
        const statusClass = file.status;
        const statusText = file.status.charAt(0).toUpperCase();
        return `
                <div class="file-item" data-path="${file.path}">
                    <span class="file-status ${statusClass}">${statusText}</span>
                    <span class="file-name">${file.path}</span>
                    <span class="file-stats">+${file.additions} -${file.deletions}</span>
                </div>
            `;
      })
      .join('');
  }

  function selectFile(filePath) {
    const file = currentDiffData.files.find((f) => f.path === filePath);
    if (!file) return;

    selectedFile = file;

    // Update selected state
    document.querySelectorAll('.file-item').forEach((item) => {
      item.classList.toggle('selected', item.dataset.path === filePath);
    });

    renderDiffContent(file);
  }

  function renderDiffContent(file) {
    const diffContent = document.querySelector('.diff-content');

    diffContent.innerHTML = `
            <div class="diff-header">
                <h2>${file.path}</h2>
                <div class="commit-info">
                    ${currentDiffData.commit} | 
                    ${file.status} | 
                    +${file.additions} -${file.deletions}
                </div>
            </div>
            <div class="diff-chunks">
                ${renderChunks(file)}
            </div>
        `;

    // Add comment buttons handlers
    addCommentHandlers(file);
  }

  function renderChunks(file) {
    return file.chunks
      .map((chunk) => {
        const lines = chunk.lines
          .map((line) => {
            const lineKey = `${file.path}:${line.newLineNumber || line.oldLineNumber}`;
            const comment = comments[lineKey];
            const lineClass = line.type === 'add' ? 'add' : line.type === 'delete' ? 'delete' : '';

            return `
                    <div class="diff-line ${lineClass}" data-line="${line.newLineNumber || line.oldLineNumber}">
                        <span class="line-number">${line.oldLineNumber || ''}</span>
                        <span class="line-number">${line.newLineNumber || ''}</span>
                        <span class="line-content">${escapeHtml(line.content)}</span>
                        ${line.type !== 'delete' ? `<button class="comment-button" data-line="${line.newLineNumber}">+</button>` : ''}
                    </div>
                    ${comment ? renderComment(comment) : ''}
                `;
          })
          .join('');

        return `
                <div class="diff-chunk">
                    <div class="chunk-header">${escapeHtml(chunk.header)}</div>
                    ${lines}
                </div>
            `;
      })
      .join('');
  }

  function renderComment(comment) {
    return `
            <div class="comment-box" data-comment-id="${comment.id}">
                <div class="comment-header">${new Date(comment.timestamp).toLocaleString()}</div>
                <div class="comment-body">${escapeHtml(comment.body)}</div>
                <div class="comment-actions">
                    <button class="edit-comment" data-id="${comment.id}">Edit</button>
                    <button class="copy-prompt" data-id="${comment.id}">Copy Prompt</button>
                </div>
            </div>
        `;
  }

  function addCommentHandlers(file) {
    // Add comment button handlers
    document.querySelectorAll('.comment-button').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const lineNumber = parseInt(button.dataset.line);
        showCommentInput(file.path, lineNumber, e.target);
      });
    });

    // Edit comment handlers
    document.querySelectorAll('.edit-comment').forEach((button) => {
      button.addEventListener('click', () => {
        const commentId = button.dataset.id;
        const comment = Object.values(comments).find((c) => c.id === commentId);
        if (comment) {
          editComment(comment);
        }
      });
    });

    // Copy prompt handlers
    document.querySelectorAll('.copy-prompt').forEach((button) => {
      button.addEventListener('click', () => {
        const commentId = button.dataset.id;
        const comment = Object.values(comments).find((c) => c.id === commentId);
        if (comment) {
          copyPrompt(comment);
        }
      });
    });
  }

  function showCommentInput(filePath, lineNumber, targetElement) {
    const existingInput = document.querySelector('.comment-input-box');
    if (existingInput) {
      existingInput.remove();
    }

    const inputBox = document.createElement('div');
    inputBox.className = 'comment-box comment-input-box';
    inputBox.innerHTML = `
            <textarea class="comment-input" placeholder="Add a comment..."></textarea>
            <div class="comment-actions">
                <button class="save-comment">Save</button>
                <button class="cancel-comment">Cancel</button>
            </div>
        `;

    targetElement.parentElement.insertAdjacentElement('afterend', inputBox);

    const textarea = inputBox.querySelector('.comment-input');
    textarea.focus();

    inputBox.querySelector('.save-comment').addEventListener('click', () => {
      const body = textarea.value.trim();
      if (body) {
        saveComment(filePath, lineNumber, body);
        inputBox.remove();
      }
    });

    inputBox.querySelector('.cancel-comment').addEventListener('click', () => {
      inputBox.remove();
    });
  }

  function saveComment(filePath, lineNumber, body) {
    const comment = {
      id: `${Date.now()}-${Math.random()}`,
      file: filePath,
      line: lineNumber,
      body: body,
      timestamp: new Date().toISOString(),
    };

    vscode.postMessage({
      command: 'saveComment',
      comment: comment,
    });
  }

  function editComment(comment) {
    const commentBox = document.querySelector(`[data-comment-id="${comment.id}"]`);
    if (!commentBox) return;

    const currentBody = comment.body;
    commentBox.innerHTML = `
            <textarea class="comment-input">${escapeHtml(currentBody)}</textarea>
            <div class="comment-actions">
                <button class="save-edit">Save</button>
                <button class="cancel-edit">Cancel</button>
            </div>
        `;

    const textarea = commentBox.querySelector('.comment-input');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    commentBox.querySelector('.save-edit').addEventListener('click', () => {
      const newBody = textarea.value.trim();
      if (newBody && newBody !== currentBody) {
        comment.body = newBody;
        saveComment(comment.file, comment.line, newBody);
      }
      renderDiffContent(selectedFile);
    });

    commentBox.querySelector('.cancel-edit').addEventListener('click', () => {
      renderDiffContent(selectedFile);
    });
  }

  function copyPrompt(comment) {
    const prompt = `File: ${comment.file}
Line: ${comment.line}
Comment: ${comment.body}`;

    navigator.clipboard.writeText(prompt).then(() => {
      vscode.postMessage({
        command: 'showInfo',
        text: 'Comment prompt copied to clipboard',
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize
  renderDiffViewer();
})();
