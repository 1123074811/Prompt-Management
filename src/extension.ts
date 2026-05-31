import * as vscode from 'vscode';
import { PromptStoreManager } from './store';
import { PromptStore, WebviewMessage, ExtensionMessage } from './types';
import { injectPrompt } from './injector';
import { getWebviewContent } from './webview';

let storeManager: PromptStoreManager;

export function activate(context: vscode.ExtensionContext) {
  storeManager = new PromptStoreManager(context);

  // Register the webview view provider for the sidebar
  const provider = new PromptSidebarProvider(context, storeManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('prompt-manager.sidebar', provider)
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('prompt-manager.openSidebar', () => {
      vscode.commands.executeCommand('workbench.view.extension.prompt-manager');
    }),
    vscode.commands.registerCommand('prompt-manager.addPrompt', async () => {
      vscode.commands.executeCommand('workbench.view.extension.prompt-manager');
      // Webview will show the add dialog via postMessage
      provider.postMessage({ type: 'showAddPrompt' } as any);
    }),
    vscode.commands.registerCommand('prompt-manager.addCategory', async () => {
      vscode.commands.executeCommand('workbench.view.extension.prompt-manager');
      provider.postMessage({ type: 'showAddCategory' } as any);
    }),
    vscode.commands.registerCommand('prompt-manager.importPrompts', async () => {
      await handleImport(context, provider);
    }),
    vscode.commands.registerCommand('prompt-manager.exportPrompts', async () => {
      await handleExport(context);
    }),
  );
}

export function deactivate() {}

// ── Webview View Provider ──────────────────────────────────────

class PromptSidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private context: vscode.ExtensionContext,
    private store: PromptStoreManager,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };

    webviewView.webview.html = getWebviewContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      await this.handleMessage(msg);
    });

    // Send initial data once webview is ready
    webviewView.webview.postMessage({ type: 'init', data: this.store.store });
  }

  postMessage(msg: ExtensionMessage | Record<string, unknown>) {
    this._view?.webview.postMessage(msg);
  }

  private async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
      case 'getData':
        this.postMessage({ type: 'update', data: this.store.store });
        break;

      case 'addPrompt': {
        this.store.addPrompt(msg.title, msg.content, msg.categoryId);
        this.postMessage({ type: 'update', data: this.store.store });
        break;
      }

      case 'editPrompt': {
        this.store.editPrompt(msg.id, msg.title, msg.content, msg.categoryId);
        this.postMessage({ type: 'update', data: this.store.store });
        break;
      }

      case 'deletePrompt': {
        this.store.deletePrompt(msg.id);
        this.postMessage({ type: 'update', data: this.store.store });
        break;
      }

      case 'addCategory': {
        this.store.addCategory(msg.name);
        this.postMessage({ type: 'update', data: this.store.store });
        break;
      }

      case 'renameCategory': {
        this.store.renameCategory(msg.id, msg.name);
        this.postMessage({ type: 'update', data: this.store.store });
        break;
      }

      case 'deleteCategory': {
        this.store.deleteCategory(msg.id);
        this.postMessage({ type: 'update', data: this.store.store });
        break;
      }

      case 'reorderPrompts': {
        this.store.reorderPrompts(msg.categoryId, msg.promptIds);
        this.postMessage({ type: 'update', data: this.store.store });
        break;
      }

      case 'movePrompt': {
        this.store.movePrompt(msg.promptId, msg.targetCategoryId, msg.targetOrder);
        this.postMessage({ type: 'update', data: this.store.store });
        break;
      }

      case 'reorderCategories': {
        this.store.reorderCategories(msg.categoryIds);
        this.postMessage({ type: 'update', data: this.store.store });
        break;
      }

      case 'inject': {
        const prompt = this.store.store.prompts.find(p => p.id === msg.promptId);
        if (prompt) {
          const result = await injectPrompt(prompt.content);
          this.postMessage({ type: 'injectResult', success: result.success, message: result.message });
        }
        break;
      }

      case 'import': {
        await handleImport(this.context, this);
        break;
      }

      case 'export': {
        await handleExport(this.context);
        break;
      }
    }
  }
}

// ── Import / Export ────────────────────────────────────────────

async function handleImport(
  context: vscode.ExtensionContext,
  provider: PromptSidebarProvider,
): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: '导入提示词',
    filters: { JSON: ['json'] },
  });
  if (!uris || uris.length === 0) { return; }

  try {
    const bytes = await vscode.workspace.fs.readFile(uris[0]);
    const text = Buffer.from(bytes).toString('utf-8');
    const data = JSON.parse(text) as PromptStore;

    if (!data.categories || !data.prompts) {
      vscode.window.showErrorMessage('无效的提示词文件：缺少分类或提示词数据。');
      return;
    }

    const action = await vscode.window.showWarningMessage(
      '导入将替换所有现有提示词，是否继续？',
      '替换',
      '取消'
    );
    if (action !== '替换') { return; }

    storeManager.importData(data);
    provider.postMessage({ type: 'update', data: storeManager.store });
    vscode.window.showInformationMessage('提示词导入成功！');
  } catch (e) {
    vscode.window.showErrorMessage('导入失败：' + (e as Error).message);
  }
}

async function handleExport(context: vscode.ExtensionContext): Promise<void> {
  const uri = await vscode.window.showSaveDialog({
    saveLabel: '导出提示词',
    filters: { JSON: ['json'] },
    defaultUri: vscode.Uri.file('prompts-export.json'),
  });
  if (!uri) { return; }

  try {
    const text = JSON.stringify(storeManager.store, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf-8'));
    vscode.window.showInformationMessage('提示词已导出到 ' + uri.fsPath);
  } catch (e) {
    vscode.window.showErrorMessage('导出失败：' + (e as Error).message);
  }
}
