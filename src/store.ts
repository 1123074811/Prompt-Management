import * as vscode from 'vscode';
import { Prompt, Category, PromptStore } from './types';
import defaultData from './defaultPrompts.json';

const STORAGE_KEY = 'promptManager.store';

export class PromptStoreManager {
  private _store: PromptStore;

  constructor(private context: vscode.ExtensionContext) {
    const saved = context.globalState.get<PromptStore>(STORAGE_KEY);
    if (saved && saved.categories && saved.prompts) {
      this._store = saved;
      this.migrateToChinese();
    } else {
      this._store = this.loadDefaults();
      this.save();
    }
  }

  private migrateToChinese(): void {
    const defaultCategoryIds = new Set(['cat-code-review', 'cat-testing', 'cat-explain', 'cat-refactor', 'cat-general']);
    const defaultPromptIds = new Set([
      'prompt-review-1', 'prompt-review-2', 'prompt-review-3',
      'prompt-test-1', 'prompt-test-2',
      'prompt-explain-1', 'prompt-explain-2',
      'prompt-refactor-1', 'prompt-refactor-2',
      'prompt-general-1', 'prompt-general-2', 'prompt-general-3'
    ]);

    // Check if we need to migrate (if any default category name is in English)
    const hasEnglishDefault = this._store.categories.some(c => 
      c.id === 'cat-code-review' && c.name === 'Code Review'
    );

    if (hasEnglishDefault) {
      // 1. Keep custom categories
      const customCategories = this._store.categories.filter(c => !defaultCategoryIds.has(c.id));
      // 2. Keep custom prompts
      const customPrompts = this._store.prompts.filter(p => !defaultPromptIds.has(p.id));

      // 3. Load fresh Chinese defaults
      const defaults = this.loadDefaults();

      // 4. Merge
      this._store.categories = [
        ...defaults.categories,
        ...customCategories
      ];
      this._store.prompts = [
        ...defaults.prompts,
        ...customPrompts
      ];

      this.save();
    }
  }

  get store(): PromptStore {
    return this._store;
  }

  private loadDefaults(): PromptStore {
    return {
      categories: (defaultData.categories as Category[]).map(c => ({ ...c })),
      prompts: (defaultData.prompts as Prompt[]).map(p => ({ ...p })),
    };
  }

  private save(): void {
    this.context.globalState.update(STORAGE_KEY, this._store);
  }

  // ── Prompt CRUD ──────────────────────────────────────────────

  addPrompt(title: string, content: string, categoryId: string): Prompt {
    const catPrompts = this._store.prompts.filter(p => p.categoryId === categoryId);
    const prompt: Prompt = {
      id: this.uuid(),
      title,
      content,
      categoryId,
      order: catPrompts.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this._store.prompts.push(prompt);
    this.save();
    return prompt;
  }

  editPrompt(id: string, title: string, content: string, categoryId: string): Prompt | null {
    const idx = this._store.prompts.findIndex(p => p.id === id);
    if (idx === -1) { return null; }
    const old = this._store.prompts[idx];
    // If category changed, reorder
    if (old.categoryId !== categoryId) {
      const targetCatPrompts = this._store.prompts.filter(p => p.categoryId === categoryId);
      old.order = targetCatPrompts.length;
    }
    old.title = title;
    old.content = content;
    old.categoryId = categoryId;
    old.updatedAt = Date.now();
    this.save();
    return old;
  }

  deletePrompt(id: string): boolean {
    const idx = this._store.prompts.findIndex(p => p.id === id);
    if (idx === -1) { return false; }
    const deleted = this._store.prompts.splice(idx, 1)[0];
    // Reorder remaining prompts in same category
    this._store.prompts
      .filter(p => p.categoryId === deleted.categoryId && p.order > deleted.order)
      .forEach(p => p.order--);
    this.save();
    return true;
  }

  reorderPrompts(categoryId: string, promptIds: string[]): void {
    promptIds.forEach((id, i) => {
      const p = this._store.prompts.find(p => p.id === id);
      if (p) {
        p.categoryId = categoryId;
        p.order = i;
        p.updatedAt = Date.now();
      }
    });
    this.save();
  }

  movePrompt(promptId: string, targetCategoryId: string, targetOrder: number): void {
    const p = this._store.prompts.find(p => p.id === promptId);
    if (!p) { return; }
    const oldCatId = p.categoryId;
    p.categoryId = targetCategoryId;
    p.order = targetOrder;
    p.updatedAt = Date.now();
    // Reorder source category
    this._store.prompts
      .filter(pp => pp.categoryId === oldCatId && pp.id !== promptId)
      .sort((a, b) => a.order - b.order)
      .forEach((pp, i) => { pp.order = i; });
    // Reorder target category
    this._store.prompts
      .filter(pp => pp.categoryId === targetCategoryId && pp.id !== promptId && pp.order >= targetOrder)
      .forEach(pp => pp.order++);
    this.save();
  }

  // ── Category CRUD ────────────────────────────────────────────

  addCategory(name: string): Category {
    const cat: Category = {
      id: this.uuid(),
      name,
      order: this._store.categories.length,
    };
    this._store.categories.push(cat);
    this.save();
    return cat;
  }

  renameCategory(id: string, name: string): Category | null {
    const cat = this._store.categories.find(c => c.id === id);
    if (!cat) { return null; }
    cat.name = name;
    this.save();
    return cat;
  }

  deleteCategory(id: string): boolean {
    const idx = this._store.categories.findIndex(c => c.id === id);
    if (idx === -1) { return false; }
    this._store.categories.splice(idx, 1);
    // Remove all prompts in this category
    this._store.prompts = this._store.prompts.filter(p => p.categoryId !== id);
    // Reorder remaining categories
    this._store.categories.forEach((c, i) => { c.order = i; });
    this.save();
    return true;
  }

  reorderCategories(categoryIds: string[]): void {
    categoryIds.forEach((id, i) => {
      const c = this._store.categories.find(c => c.id === id);
      if (c) { c.order = i; }
    });
    this.save();
  }

  // ── Import / Export ──────────────────────────────────────────

  importData(data: PromptStore): void {
    this._store = data;
    this.save();
  }

  // ── Helpers ──────────────────────────────────────────────────

  private uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}
