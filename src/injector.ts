import * as vscode from 'vscode';

/**
 * 将提示词注入到 AI 对话输入框。
 *
 * 兼容 IDE：Cursor、VS Code + Copilot Chat、Trae、Windsurf、Antigravity 等
 *
 * 策略（双重保险）：
 * 1. 先将提示词写入剪贴板（作为保底，确保用户随时能 Ctrl+V 粘贴）。
 * 2. 动态检索当前 IDE 注册的所有 Chat/AI 相关的命令。
 * 3. 优先尝试已知支持直接填入文本的命令（如 workbench.action.chat.open, github.copilot.chat.openChat）。
 * 4. 如果是专有 IDE（如 Windsurf、Trae），动态寻找并执行其打开/聚焦 Chat 面板的命令。
 * 5. 这样即使无法直接填入，也能自动帮用户拉起 Chat 面板并聚焦输入框，用户直接 Ctrl+V 即可，体验极佳。
 */
export async function injectPrompt(text: string): Promise<{ success: boolean; message: string }> {
  // 第一步：写入剪贴板（保底双保险）
  await vscode.env.clipboard.writeText(text);

  // 第二步：获取当前 IDE 注册的所有命令
  let allCommands: string[] = [];
  try {
    allCommands = await vscode.commands.getCommands(true);
  } catch {
    // 无法获取时使用空数组
  }

  // 优先级 1：Windsurf 专属的直接发送文本和打开 Chat 的命令（完美匹配用户的 Windsurf IDE！）
  if (allCommands.includes('windsurf.sendTextToChat') || allCommands.includes('windsurf.prioritized.chat.open')) {
    try {
      // 1. 尝试打开/聚焦 Windsurf Chat 面板
      if (allCommands.includes('windsurf.prioritized.chat.open')) {
        await vscode.commands.executeCommand('windsurf.prioritized.chat.open');
      }
      // 2. 尝试直接把提示词发送/注入到 Windsurf Chat 中
      if (allCommands.includes('windsurf.sendTextToChat')) {
        await vscode.commands.executeCommand('windsurf.sendTextToChat', text);
        return { success: true, message: '已直接注入到 Windsurf Chat 框' };
      }
      return { success: true, message: '已自动打开 Windsurf Chat，请直接 Ctrl+V' };
    } catch {
      // 如果 Windsurf 专有命令执行出错，继续尝试其他
    }
  }

  // 优先级 2：已知支持传参直接填入的其它 IDE 官方命令（如 Cursor, Copilot 等）
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

  // 优先级 3：动态搜寻当前 IDE 的 AI / Chat 面板打开及聚焦命令（精准排除无关的管理、配置、日志等命令）
  const excludedKeywords = [
    'manage', 'widget', 'annotation', 'setting', 'history', 'log', 
    'telemetry', 'dev', 'auth', 'billing', 'mcp', 'config', 'rules', 
    'doc', 'pricing', 'feedback', 'update', 'import', 'export', 'clear'
  ];

  const dynamicFocusCommands = allCommands.filter(cmd => {
    const c = cmd.toLowerCase();
    
    // 排除无关的后台、配置或辅助命令
    if (excludedKeywords.some(keyword => c.includes(keyword))) {
      return false;
    }

    return (
      // Windsurf & Codeium 专属
      (c.includes('windsurf') && (c.includes('chat') || c.includes('cascade'))) ||
      (c.includes('codeium') && c.includes('chat')) ||
      // Trae 专属
      (c.includes('trae') && c.includes('chat')) ||
      // 通用 AI Chat 命名
      c.includes('aichat.focus') ||
      c.includes('aichat.open') ||
      c.includes('copilot.chat.focus') ||
      c.includes('copilot.focus') ||
      // 各种 focus 视图命令
      (c.includes('focus') && c.includes('chat')) ||
      (c.includes('open') && c.includes('chat'))
    );
  });

  // 排序：让更具体的（如 windsurf, trae, codeium）排在前面
  dynamicFocusCommands.sort((a, b) => {
    const score = (cmd: string) => {
      const c = cmd.toLowerCase();
      if (c.includes('windsurf') || c.includes('trae') || c.includes('codeium') || c.includes('cascade')) { return 10; }
      if (c.includes('aichat') || c.includes('copilot')) { return 5; }
      return 1;
    };
    return score(b) - score(a);
  });

  // 尝试执行找到的第一个能成功运行的聚焦/打开命令
  for (const cmd of dynamicFocusCommands) {
    try {
      await vscode.commands.executeCommand(cmd, text);
      return { success: true, message: '已自动打开 Chat 面板，请按 Ctrl+V 粘贴' };
    } catch {
      try {
        await vscode.commands.executeCommand(cmd);
        return { success: true, message: '已自动打开 Chat 面板，请按 Ctrl+V 粘贴' };
      } catch {
        // 继续尝试下一个命令
      }
    }
  }

  // 优先级 4：完全保底聚焦
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

  // 如果连打开面板都失败，提示复制成功
  vscode.window.showInformationMessage('提示词已复制到剪贴板，请在 AI Chat 框按 Ctrl+V 粘贴');
  return { success: true, message: '已复制到剪贴板，请按 Ctrl+V 粘贴' };
}
