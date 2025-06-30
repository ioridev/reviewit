// VSCode WebView API adapter
interface VSCodeApi {
  postMessage(message: any): void;
  setState(state: any): void;
  getState(): any;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VSCodeApi;
  }
}

console.log('[vscode-adapter] Initializing...');
console.log(
  '[vscode-adapter] window.acquireVsCodeApi exists:',
  typeof window !== 'undefined' && !!window.acquireVsCodeApi
);
console.log('[vscode-adapter] import.meta.env.VSCODE:', import.meta.env.VSCODE);

export const vscode =
  typeof window !== 'undefined' && window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

console.log('[vscode-adapter] vscode object:', vscode);

// Message handler for receiving data from the extension
type MessageHandler = (data: any) => void;
const messageHandlers = new Map<string, MessageHandler[]>();

if (vscode) {
  window.addEventListener('message', (event) => {
    const message = event.data;
    const handlers = messageHandlers.get(message.command);
    if (handlers) {
      handlers.forEach((handler) => handler(message.data));
    }
  });
}

export function onMessage(command: string, handler: MessageHandler) {
  if (!messageHandlers.has(command)) {
    messageHandlers.set(command, []);
  }
  messageHandlers.get(command)!.push(handler);
}

// API-compatible fetch wrapper
export async function vscodeFetch(url: string, options?: RequestInit): Promise<Response> {
  if (!vscode) {
    // Fallback to regular fetch for non-VSCode environments
    return fetch(url, options);
  }

  console.log('[vscode-adapter] Intercepting fetch:', url);

  // Parse the URL to determine the command
  // Handle both relative and absolute URLs
  let pathname: string = url;
  let searchParams = new URLSearchParams();

  if (url.includes('?')) {
    const parts = url.split('?');
    pathname = parts[0] || '';
    searchParams = new URLSearchParams(parts[1] || '');
  }

  if (pathname && (pathname === '/api/diff' || pathname.endsWith('/api/diff'))) {
    const ignoreWhitespace = searchParams.get('ignoreWhitespace') === 'true';

    console.log(
      '[vscode-adapter] Sending getDiff command with ignoreWhitespace:',
      ignoreWhitespace
    );

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error('[vscode-adapter] Timeout waiting for diffData');
        reject(new Error('Timeout waiting for diff data'));
      }, 5000);

      const handler = (data: any) => {
        clearTimeout(timeoutId);
        console.log('[vscode-adapter] Received diffData:', data);
        resolve(
          new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
        // Remove handler after use
        const handlers = messageHandlers.get('diffData');
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      };

      onMessage('diffData', handler);
      vscode.postMessage({
        command: 'getDiff',
        ignoreWhitespace,
      });
    });
  }

  // For other endpoints, return a mock response
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Export a fetch replacement that works in both environments
console.log('[vscode-adapter] import.meta.env.VSCODE type:', typeof import.meta.env.VSCODE);
console.log('[vscode-adapter] import.meta.env.VSCODE value:', import.meta.env.VSCODE);
console.log(
  '[vscode-adapter] Choosing fetch implementation:',
  import.meta.env.VSCODE === 'true' ? 'vscodeFetch' : 'native fetch'
);

export const adaptedFetch = import.meta.env.VSCODE === 'true' ? vscodeFetch : fetch;

// Storage adapter for VSCode
export const storage = {
  getItem: (key: string): string | null => {
    if (!vscode) {
      return localStorage.getItem(key);
    }
    const state = vscode.getState() || {};
    return state[key] || null;
  },

  setItem: (key: string, value: string): void => {
    if (!vscode) {
      localStorage.setItem(key, value);
      return;
    }
    const state = vscode.getState() || {};
    state[key] = value;
    vscode.setState(state);
  },

  removeItem: (key: string): void => {
    if (!vscode) {
      localStorage.removeItem(key);
      return;
    }
    const state = vscode.getState() || {};
    delete state[key];
    vscode.setState(state);
  },
};
