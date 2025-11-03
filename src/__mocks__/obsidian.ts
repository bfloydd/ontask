// Mock for Obsidian types used in tests
export class TFile {
  path: string;
  name: string;
  stat: { mtime: number };

  constructor(path: string, name: string, mtime: number = Date.now()) {
    this.path = path;
    this.name = name;
    this.stat = { mtime };
  }
}

export class TFolder {
  path: string;
  name: string;

  constructor(path: string, name?: string) {
    this.path = path;
    this.name = name || path.split('/').pop() || '';
  }
}

export class App {
  vault: any;
  plugins: any;
  workspace: any;
}

export class Plugin {
  manifest: any;
}

export class WorkspaceLeaf {
  view: any;
}

export class ItemView {
  contentEl: HTMLElement;
}

export class Modal {
  titleEl: HTMLElement;
  contentEl: HTMLElement;
}

export class Setting {
  containerEl: HTMLElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }
  
  setName(name: string) { return this; }
  setDesc(desc: string) { return this; }
  addText(callback: (text: any) => void) { return this; }
  addToggle(callback: (toggle: any) => void) { return this; }
}

/**
 * Normalize a path by replacing backslashes with forward slashes
 * and removing duplicate slashes, leading/trailing slashes
 */
export function normalizePath(path: string): string {
  if (!path) return path;
  // Replace backslashes with forward slashes
  let normalized = path.replace(/\\/g, '/');
  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');
  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  // Ensure leading slash for absolute paths on Windows
  if (path.startsWith('/') && !normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return normalized;
}


