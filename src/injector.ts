import * as vscode from 'vscode';

/**
 * 将提示词注入到 AI 对话输入框。
 *
 * 兼容 IDE：Cursor、VS Code + Copilot Chat、Trae、Windsurf、Antigravity 等
 *
 * 策略：依次尝试所有已知的 Chat 打开/填入命令，任一成功即返回；
 * 全部失败则走剪贴板兜底（复制 + 聚焦 Chat 面板）。
 */

/** 所有已知的「打开 Chat 并填入文本」命令，按优先级排列 */
const CHAT_INJECT_COMMANDS: Array<{
  command: string;
  /** 传参方式：'query-obj' = { query: text }, 'string' = 直接传字符串 */
  argStyle: 'query-obj' | 'string';
  label: string;
}> = [
  // ── VS Code 1.89+ 官方 Chat 命令 ──
  { command: 'workbench.action.chat.open', argStyle: 'query-obj', label: 'VS Code Chat' },
  // ── Cursor 专用 ──
  { command: 'workbench.action.chat.open', argStyle: 'string', label: 'Cursor Chat' },
  { command: 'cursor.chat.open', argStyle: 'string', label: 'Cursor Chat (旧版)' },
  { command: 'aipane.open', argStyle: 'string', label: 'Cursor AI Pane' },
  // ── Copilot Chat ──
  { command: 'github.copilot.chat.openChat', argStyle: 'string', label: 'Copilot Chat' },
  { command: 'workbench.action.chat.openCopilot', argStyle: 'query-obj', label: 'Copilot Chat (openCopilot)' },
  // ── Trae / Windsurf / Antigravity 等分支 ──
  { command: 'workbench.action.aichat.open', argStyle: 'string', label: 'AI Chat (分支 IDE)' },
  { command: 'workbench.action.chat.newChat', argStyle: 'query-obj', label: 'New Chat' },
];

/** 聚焦 Chat 面板的命令（剪贴板兜底时使用） */
const CHAT_FOCUS_COMMANDS = [
  'workbench.panel.chat.view.copilot.focus',
  'workbench.panel.aichat.view.focus',
  'workbench.panel.chat.view.focus',
  'cursor.chat.focus',
];

export async function injectPrompt(text: string): Promise<{ success: boolean; message: string }> {
  // 依次尝试所有注入命令
  for (const entry of CHAT_INJECT_COMMANDS) {
    try {
      const arg = entry.argStyle === 'query-obj' ? { query: text } : text;
      await vscode.commands.executeCommand(entry.command, arg);
      return { success: true, message: '已注入到 ' + entry.label + ' 输入框' };
    } catch {
      // 此命令不可用，继续尝试下一个
    }
  }

  // 全部失败 → 剪贴板兜底
  return clipboardFallback(text);
}

async function clipboardFallback(text: string): Promise<{ success: boolean; message: string }> {
  await vscode.env.clipboard.writeText(text);

  // 尝试聚焦 Chat 面板
  for (const cmd of CHAT_FOCUS_COMMANDS) {
    try {
      await vscode.commands.executeCommand(cmd);
      break;
    } catch {
      // 不可用，继续
    }
  }

  vscode.window.showInformationMessage(
    '提示词已复制到剪贴板，请按 Ctrl+V 粘贴到对话输入框'
  );
  return { success: true, message: '已复制到剪贴板 — 请按 Ctrl+V 粘贴' };
}
