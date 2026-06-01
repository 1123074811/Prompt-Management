import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 将提示词注入到 AI 对话输入框。
 *
 * 兼容 IDE：Cursor、VS Code + Copilot Chat、Trae、Windsurf、Antigravity 等
 *
 * Windsurf 的 Cascade 输入框是 webview，VS Code 原生命令无法直接写入。
 * 因此采用 OS 级别键盘模拟（VBScript SendKeys）发送 Ctrl+V 粘贴。
 */

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 通过 VBScript 模拟 Ctrl+V 粘贴（仅 Windows），比 PowerShell 快 50 倍以上 */
function simulateCtrlV(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      resolve(); // 非 Windows 暂不处理键盘模拟
      return;
    }
    const vbsPath = path.join(os.tmpdir(), 'vscode-prompt-paste.vbs');
    try {
      fs.writeFileSync(vbsPath, 'CreateObject("WScript.Shell").SendKeys "^v"');
    } catch (e) {
      reject(e);
      return;
    }

    exec(`cscript //nologo "${vbsPath}"`, { timeout: 3000 }, (err) => {
      if (err) { reject(err); } else { resolve(); }
    });
  });
}

export async function injectPrompt(text: string): Promise<{ success: boolean; message: string }> {
  // 保底：写入剪贴板
  await vscode.env.clipboard.writeText(text);

  // 获取当前 IDE 注册的所有命令
  let allCommands: string[] = [];
  try {
    allCommands = await vscode.commands.getCommands(true);
  } catch {
    // 无法获取时使用空数组
  }

  // ── Windsurf 专属注入 ──
  const isWindsurf = allCommands.some(c => c.startsWith('windsurf.'));

  if (isWindsurf) {
    // 1. 聚焦当前 Cascade 面板（不新建会话）
    const focusCmds = [
      'windsurf.cascadePanel.focus',
      'workbench.view.windsurfAgentSidebar.focus',
      'windsurf.cascadePanel.open',
    ];

    for (const cmd of focusCmds) {
      if (allCommands.includes(cmd)) {
        try {
          await vscode.commands.executeCommand(cmd);
          break;
        } catch {
          // 继续尝试下一个
        }
      }
    }

    // 2. 等待面板和输入框获得焦点 (400ms)
    await sleep(400);

    // 3. 尝试 windsurf.sendTextToChat（如果有效则不需要键盘模拟）
    if (allCommands.includes('windsurf.sendTextToChat')) {
      try {
        await vscode.commands.executeCommand('windsurf.sendTextToChat', { query: text });
      } catch {
        // 忽略
      }
    }

    // 4. OS 级别键盘模拟 Ctrl+V（最可靠的方式，能作用于 webview 输入框）
    try {
      await simulateCtrlV();
      return { success: true, message: '已自动粘贴到当前会话输入框！' };
    } catch {
      // 键盘模拟失败，走剪贴板兜底
    }

    return { success: true, message: '已聚焦当前会话，请直接按 Ctrl+V 粘贴' };
  }

  // ── 非 Windsurf IDE（Cursor / VS Code + Copilot / Trae 等）──
  const explicitInjectors = [
    { command: 'workbench.action.chat.open', arg: { query: text }, label: 'VS Code / Cursor Chat' },
    { command: 'workbench.action.chat.open', arg: text, label: 'Cursor Chat' },
    { command: 'github.copilot.chat.openChat', arg: text, label: 'Copilot Chat' },
    { command: 'cursor.chat.open', arg: text, label: 'Cursor Chat' },
  ];

  for (const entry of explicitInjectors) {
    if (allCommands.includes(entry.command)) {
      try {
        await vscode.commands.executeCommand(entry.command, entry.arg);
        return { success: true, message: `已注入到 ${entry.label} 输入框` };
      } catch {
        // 执行失败，继续尝试
      }
    }
  }

  // 动态聚焦兜底
  const fallbackFocus = [
    'workbench.panel.chat.view.copilot.focus',
    'workbench.panel.aichat.view.focus',
    'workbench.panel.chat.view.focus',
    'cursor.chat.focus',
  ];

  for (const cmd of fallbackFocus) {
    if (allCommands.includes(cmd)) {
      try {
        await vscode.commands.executeCommand(cmd);
        return { success: true, message: '已聚焦 Chat 面板，请按 Ctrl+V 粘贴' };
      } catch {
        // 忽略
      }
    }
  }

  vscode.window.showInformationMessage('提示词已复制到剪贴板，请在 AI Chat 框按 Ctrl+V 粘贴');
  return { success: true, message: '已复制到剪贴板，请按 Ctrl+V 粘贴' };
}
