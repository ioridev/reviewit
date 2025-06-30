/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VSCODE: string;
  // More env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
