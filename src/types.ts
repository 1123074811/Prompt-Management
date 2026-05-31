export interface Prompt {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface PromptStore {
  categories: Category[];
  prompts: Prompt[];
}

/** Messages from webview → extension */
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'addPrompt'; title: string; content: string; categoryId: string }
  | { type: 'editPrompt'; id: string; title: string; content: string; categoryId: string }
  | { type: 'deletePrompt'; id: string }
  | { type: 'addCategory'; name: string }
  | { type: 'renameCategory'; id: string; name: string }
  | { type: 'deleteCategory'; id: string }
  | { type: 'reorderPrompts'; categoryId: string; promptIds: string[] }
  | { type: 'movePrompt'; promptId: string; targetCategoryId: string; targetOrder: number }
  | { type: 'reorderCategories'; categoryIds: string[] }
  | { type: 'inject'; promptId: string }
  | { type: 'import' }
  | { type: 'export' }
  | { type: 'getData' };

/** Messages from extension → webview */
export type ExtensionMessage =
  | { type: 'init'; data: PromptStore }
  | { type: 'update'; data: PromptStore }
  | { type: 'injectResult'; success: boolean; message: string };
