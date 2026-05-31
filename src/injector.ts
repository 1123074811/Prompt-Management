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

  // 优先级 1：已知支持传参直接填入的官方命令
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

  // 优先级 2：动态搜寻当前 IDE 的 AI / Chat 面板打开及聚焦命令
  // 我们过滤出包含 windsurf, codeium, trae, aichat, copilot, cascade 等关键字的命令
  const dynamicFocusCommands = allCommands.filter(cmd => {
    const c = cmd.toLowerCase();
    return (
      // Windsurf & Codeium 专属
      (c.includes('windsurf') && (c.includes('chat') || c.includes('codemap') || c.includes('cascade'))) ||
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
      // 很多打开命令可能也接受字符串作为初始 query，我们尝试把 text 传进去
      await vscode.commands.executeCommand(cmd, text);
      return { success: true, message: '已自动打开 Chat 面板，请按 Ctrl+V 粘贴' };
    } catch {
      try {
        // 如果带参数执行失败，尝试无参执行（纯打开/聚焦）
        await vscode.commands.executeCommand(cmd);
        return { success: true, message: '已自动打开 Chat 面板，请按 Ctrl+V 粘贴' };
      } catch {
        // 继续尝试下一个命令
      }
    }
  }

  // 优先级 3：完全保底聚焦
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
