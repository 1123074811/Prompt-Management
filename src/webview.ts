import * as vscode from 'vscode';

export function getWebviewContent(_webview: vscode.Webview): string {
  return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 提示词管理器</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --border: var(--vscode-panel-border);
    --accent: var(--vscode-button-background);
    --accent-hover: var(--vscode-button-hoverBackground);
    --card-bg: var(--vscode-list-hoverBackground);
    --card-border: var(--vscode-list-activeSelectionBackground);
    --input-bg: var(--vscode-input-background);
    --input-fg: var(--vscode-input-foreground);
    --input-border: var(--vscode-input-border);
    --danger: #e06c75;
    --highlight: #264f78;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
    color: var(--fg);
    background: var(--bg);
    padding: 8px;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Search ─────────────────────────────────────── */
  .search-box {
    position: relative;
    margin-bottom: 8px;
  }
  .search-box input {
    width: 100%;
    padding: 6px 8px 6px 28px;
    background: var(--input-bg);
    color: var(--input-fg);
    border: 1px solid var(--input-border);
    border-radius: 4px;
    font-size: inherit;
    outline: none;
  }
  .search-box input:focus { border-color: var(--accent); }
  .search-icon {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.5;
    font-size: 14px;
  }

  /* ── Main list ──────────────────────────────────── */
  .prompt-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ── Category ───────────────────────────────────── */
  .category {
    margin-bottom: 4px;
    user-select: none;
  }
  .category-header {
    display: flex;
    align-items: center;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    gap: 4px;
    position: relative;
  }
  .category-header:hover { background: var(--card-bg); }
  .category-header .chevron {
    font-size: 10px;
    transition: transform 0.15s;
    flex-shrink: 0;
  }
  .category-header.collapsed .chevron { transform: rotate(-90deg); }
  .category-header .cat-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .category-header .cat-count {
    font-size: 11px;
    opacity: 0.5;
    font-weight: 400;
  }
  .category-header .cat-actions {
    display: none;
    gap: 2px;
  }
  .category-header:hover .cat-actions { display: flex; }
  .cat-actions button {
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    padding: 0 3px;
    font-size: 13px;
    opacity: 0.7;
    border-radius: 3px;
  }
  .cat-actions button:hover { opacity: 1; background: var(--card-bg); }
  .cat-actions button.danger:hover { color: var(--danger); }

  .category-items {
    padding-left: 8px;
  }
  .category-items.collapsed { display: none; }

  /* ── Prompt Card ────────────────────────────────── */
  .prompt-card {
    display: flex;
    align-items: center;
    padding: 6px 8px;
    margin: 2px 0;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.1s, border-color 0.1s;
    gap: 6px;
    position: relative;
  }
  .prompt-card:hover {
    background: var(--card-bg);
    border-color: var(--card-border);
  }
  .prompt-card.dragging {
    opacity: 0.4;
  }
  .prompt-card .drag-handle {
    cursor: grab;
    opacity: 0;
    font-size: 12px;
    flex-shrink: 0;
    padding: 0 2px;
  }
  .prompt-card:hover .drag-handle { opacity: 0.5; }
  .prompt-card .drag-handle:active { cursor: grabbing; }

  .prompt-card .card-body {
    flex: 1;
    overflow: hidden;
  }
  .prompt-card .card-title {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .prompt-card .card-preview {
    font-size: 11px;
    opacity: 0.6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }
  .prompt-card .card-actions {
    display: none;
    gap: 2px;
    flex-shrink: 0;
  }
  .prompt-card:hover .card-actions { display: flex; }
  .card-actions button {
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    padding: 0 3px;
    font-size: 13px;
    opacity: 0.7;
    border-radius: 3px;
  }
  .card-actions button:hover { opacity: 1; background: var(--card-bg); }
  .card-actions button.danger:hover { color: var(--danger); }

  /* ── Drag drop indicator ────────────────────────── */
  .drop-indicator {
    height: 2px;
    background: var(--accent);
    border-radius: 1px;
    margin: 1px 0;
    pointer-events: none;
  }

  /* ── Bottom bar ─────────────────────────────────── */
  .bottom-bar {
    display: flex;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    margin-top: 8px;
    flex-shrink: 0;
  }
  .bottom-bar button {
    flex: 1;
    padding: 6px 8px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  }
  .bottom-bar button:hover { background: var(--accent-hover); }
  .bottom-bar button.secondary {
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #fff);
  }
  .bottom-bar button.secondary:hover {
    background: var(--vscode-button-secondaryHoverBackground, #45494e);
  }

  /* ── Modal ──────────────────────────────────────── */
  .modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 100;
    justify-content: center;
    align-items: center;
  }
  .modal-overlay.active { display: flex; }
  .modal {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  .modal h3 { margin-bottom: 12px; font-size: 14px; }
  .modal label { display: block; font-size: 12px; opacity: 0.8; margin-bottom: 4px; margin-top: 8px; }
  .modal input, .modal select, .modal textarea {
    width: 100%;
    padding: 6px 8px;
    background: var(--input-bg);
    color: var(--input-fg);
    border: 1px solid var(--input-border);
    border-radius: 4px;
    font-size: inherit;
    font-family: inherit;
    outline: none;
  }
  .modal textarea { min-height: 120px; resize: vertical; }
  .modal input:focus, .modal select:focus, .modal textarea:focus { border-color: var(--accent); }
  .modal-buttons {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    justify-content: flex-end;
  }
  .modal-buttons button {
    padding: 6px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .modal-buttons .btn-primary { background: var(--accent); color: #fff; }
  .modal-buttons .btn-primary:hover { background: var(--accent-hover); }
  .modal-buttons .btn-cancel { background: transparent; color: var(--fg); border: 1px solid var(--border); }
  .modal-buttons .btn-cancel:hover { background: var(--card-bg); }
  .modal-buttons .btn-danger { background: var(--danger); color: #fff; }
  .modal-buttons .btn-danger:hover { opacity: 0.85; }

  /* ── Highlight ──────────────────────────────────── */
  mark { background: var(--highlight); color: var(--fg); border-radius: 2px; padding: 0 1px; }

  /* ── Empty state ────────────────────────────────── */
  .empty-state {
    text-align: center;
    padding: 24px 8px;
    opacity: 0.5;
    font-size: 12px;
  }

  /* ── Toast ──────────────────────────────────────── */
  .toast {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent);
    color: #fff;
    padding: 6px 16px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 200;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }
  .toast.show { opacity: 1; }
</style>
</head>
<body>

<!-- Search -->
<div class="search-box">
  <span class="search-icon">🔍</span>
  <input type="text" id="searchInput" placeholder="搜索提示词..." />
</div>

<!-- Prompt List -->
<div class="prompt-list" id="promptList"></div>

<!-- Bottom Actions -->
<div class="bottom-bar">
  <button id="btnAddPrompt" title="新增提示词">+ 提示词</button>
  <button id="btnAddCategory" class="secondary" title="新增分类">+ 分类</button>
  <button id="btnImport" class="secondary" title="导入">↓ 导入</button>
  <button id="btnExport" class="secondary" title="导出">↑ 导出</button>
</div>

<!-- Add/Edit Prompt Modal -->
<div class="modal-overlay" id="promptModal">
  <div class="modal">
    <h3 id="promptModalTitle">新增提示词</h3>
    <label for="promptTitle">标题</label>
    <input type="text" id="promptTitle" placeholder="例如：代码审查" />
    <label for="promptCategory">分类</label>
    <select id="promptCategory"></select>
    <label for="promptContent">内容</label>
    <textarea id="promptContent" placeholder="输入提示词内容..."></textarea>
    <div class="modal-buttons">
      <button class="btn-cancel" id="promptModalCancel">取消</button>
      <button class="btn-primary" id="promptModalSave">保存</button>
    </div>
  </div>
</div>

<!-- Add/Rename Category Modal -->
<div class="modal-overlay" id="categoryModal">
  <div class="modal">
    <h3 id="categoryModalTitle">新增分类</h3>
    <label for="categoryName">名称</label>
    <input type="text" id="categoryName" placeholder="例如：代码审查" />
    <div class="modal-buttons">
      <button class="btn-cancel" id="categoryModalCancel">取消</button>
      <button class="btn-primary" id="categoryModalSave">保存</button>
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
<div class="modal-overlay" id="deleteModal">
  <div class="modal">
    <h3>确认删除</h3>
    <p id="deleteMessage" style="font-size:12px;opacity:0.8;"></p>
    <div class="modal-buttons">
      <button class="btn-cancel" id="deleteModalCancel">取消</button>
      <button class="btn-danger" id="deleteModalConfirm">删除</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
// @ts-check
const vscode = acquireVsCodeApi();

// ── State ──────────────────────────────────────────────────────
/** @type {{ categories: Array<{id:string,name:string,order:number}>, prompts: Array<{id:string,title:string,content:string,categoryId:string,order:number,createdAt:number,updatedAt:number}> }} */
let store = { categories: [], prompts: [] };
let searchQuery = '';
let editingPromptId = null; // null = adding new
let editingCategoryId = null; // null = adding new
let deleteTarget = null; // { type: 'prompt'|'category', id: string }

// Drag state
let dragPromptId = null;
let dragCategoryId = null;
let isDragging = false;

// ── DOM refs ───────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const promptList = document.getElementById('promptList');
const btnAddPrompt = document.getElementById('btnAddPrompt');
const btnAddCategory = document.getElementById('btnAddCategory');
const btnImport = document.getElementById('btnImport');
const btnExport = document.getElementById('btnExport');

// Prompt modal
const promptModal = document.getElementById('promptModal');
const promptModalTitle = document.getElementById('promptModalTitle');
const promptTitleInput = document.getElementById('promptTitle');
const promptCategorySelect = document.getElementById('promptCategory');
const promptContentInput = document.getElementById('promptContent');
const promptModalCancel = document.getElementById('promptModalCancel');
const promptModalSave = document.getElementById('promptModalSave');

// Category modal
const categoryModal = document.getElementById('categoryModal');
const categoryModalTitle = document.getElementById('categoryModalTitle');
const categoryNameInput = document.getElementById('categoryName');
const categoryModalCancel = document.getElementById('categoryModalCancel');
const categoryModalSave = document.getElementById('categoryModalSave');

// Delete modal
const deleteModal = document.getElementById('deleteModal');
const deleteMessage = document.getElementById('deleteMessage');
const deleteModalCancel = document.getElementById('deleteModalCancel');
const deleteModalConfirm = document.getElementById('deleteModalConfirm');

const toastEl = document.getElementById('toast');

// ── Helpers ────────────────────────────────────────────────────
function showToast(msg, duration = 2000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function highlightText(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  var spec = '.+?^$()[]{}\\\\*|'.split('');
  var safe = query.replace(new RegExp('([' + spec.map(function(c){return '\\\\'+c;}).join('') + '])', 'g'), '\\\\$1');
  var regex = new RegExp('(' + safe + ')', 'gi');
  return escaped.replace(regex, '<mark>' + '$1' + '</mark>');
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const isSearchActive = () => searchQuery.length > 0;

// ── Render ─────────────────────────────────────────────────────
function render() {
  const cats = [...store.categories].sort((a, b) => a.order - b.order);
  let prompts = [...store.prompts];


  // Filter by search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    prompts = prompts.filter(p =>
      p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    );
  }

  // Group by category
  const grouped = new Map();
  for (const cat of cats) {
    grouped.set(cat.id, []);
  }
  for (const p of prompts.sort((a, b) => a.order - b.order)) {
    if (grouped.has(p.categoryId)) {
      grouped.get(p.categoryId).push(p);
    } else {
      // Orphan prompt — create virtual group
      grouped.set(p.categoryId, [p]);
    }
  }

  let html = '';

  for (const cat of cats) {
    const catPrompts = grouped.get(cat.id) || [];

    // Hide empty categories in search mode
    if (searchQuery && catPrompts.length === 0) continue;

    const collapsedClass = catPrompts.length === 0 ? 'collapsed' : '';

    html += '<div class="category" data-cat-id="' + cat.id + '">';

    // Category header — draggable if not searching
    const draggableCat = isSearchActive() ? '' : 'draggable="true"';
    html += '<div class="category-header ' + collapsedClass + '" data-cat-id="' + cat.id + '" ' + draggableCat + '>';
    html += '<span class="chevron">▼</span>';
    html += '<span class="cat-name">' + escapeHtml(cat.name) + '</span>';
    html += '<span class="cat-count">' + catPrompts.length + '</span>';
    html += '<span class="cat-actions">';
    html += '<button class="cat-rename" data-cat-id="' + cat.id + '" title="重命名">✏️</button>';
    html += '<button class="cat-delete danger" data-cat-id="' + cat.id + '" title="删除">🗑️</button>';
    html += '</span>';
    html += '</div>';

    html += '<div class="category-items ' + collapsedClass + '" data-cat-id="' + cat.id + '">';

    for (const p of catPrompts) {
      const draggablePrompt = isSearchActive() ? '' : 'draggable="true"';
      html += '<div class="prompt-card" data-prompt-id="' + p.id + '" data-cat-id="' + p.categoryId + '" ' + draggablePrompt + '>';
      html += '<span class="drag-handle" title="拖拽排序">⠿</span>';
      html += '<div class="card-body">';
      html += '<div class="card-title">' + highlightText(p.title, searchQuery) + '</div>';
      const preview = p.content.substring(0, 80).replace(/\\n/g, ' ');
      html += '<div class="card-preview">' + highlightText(preview, searchQuery) + '</div>';
      html += '</div>';
      html += '<span class="card-actions">';
      html += '<button class="card-edit" data-prompt-id="' + p.id + '" title="编辑">✏️</button>';
      html += '<button class="card-delete danger" data-prompt-id="' + p.id + '" title="删除">🗑️</button>';
      html += '</span>';
      html += '</div>';
    }

    if (catPrompts.length === 0 && !searchQuery) {
      html += '<div class="empty-state">该分类下暂无提示词</div>';
    }

    html += '</div>'; // category-items
    html += '</div>'; // category
  }

  if (html === '') {
    html = '<div class="empty-state">' + (searchQuery ? '未找到匹配的提示词' : '暂无提示词，点击下方按钮新增') + '</div>';
  }

  promptList.innerHTML = html;
  bindDragEvents();
}

// ── Prompt Modal ───────────────────────────────────────────────
function openPromptModal(promptId) {
  editingPromptId = promptId || null;
  const catOptions = store.categories
    .sort((a, b) => a.order - b.order)
    .map(c => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>')
    .join('');
  promptCategorySelect.innerHTML = catOptions;

  if (promptId) {
    const p = store.prompts.find(p => p.id === promptId);
    if (!p) return;
    promptModalTitle.textContent = '编辑提示词';
    promptTitleInput.value = p.title;
    promptContentInput.value = p.content;
    promptCategorySelect.value = p.categoryId;
  } else {
    promptModalTitle.textContent = '新增提示词';
    promptTitleInput.value = '';
    promptContentInput.value = '';
  }

  promptModal.classList.add('active');
  promptTitleInput.focus();
}

function closePromptModal() {
  promptModal.classList.remove('active');
  editingPromptId = null;
}

function savePrompt() {
  const title = promptTitleInput.value.trim();
  const content = promptContentInput.value.trim();
  const categoryId = promptCategorySelect.value;

  if (!title) { showToast('标题不能为空'); return; }
  if (!content) { showToast('内容不能为空'); return; }
  if (!categoryId) { showToast('请选择分类'); return; }

  if (editingPromptId) {
    vscode.postMessage({ type: 'editPrompt', id: editingPromptId, title, content, categoryId });
  } else {
    vscode.postMessage({ type: 'addPrompt', title, content, categoryId });
  }
  closePromptModal();
}

// ── Category Modal ─────────────────────────────────────────────
function openCategoryModal(catId) {
  editingCategoryId = catId || null;
  if (catId) {
    const c = store.categories.find(c => c.id === catId);
    if (!c) return;
    categoryModalTitle.textContent = '重命名分类';
    categoryNameInput.value = c.name;
  } else {
    categoryModalTitle.textContent = '新增分类';
    categoryNameInput.value = '';
  }
  categoryModal.classList.add('active');
  categoryNameInput.focus();
}

function closeCategoryModal() {
  categoryModal.classList.remove('active');
  editingCategoryId = null;
}

function saveCategory() {
  const name = categoryNameInput.value.trim();
  if (!name) { showToast('名称不能为空'); return; }

  if (editingCategoryId) {
    vscode.postMessage({ type: 'renameCategory', id: editingCategoryId, name });
  } else {
    vscode.postMessage({ type: 'addCategory', name });
  }
  closeCategoryModal();
}

// ── Delete Modal ───────────────────────────────────────────────
function openDeleteModal(type, id) {
  deleteTarget = { type, id };
  if (type === 'prompt') {
    const p = store.prompts.find(p => p.id === id);
    deleteMessage.textContent = '确定删除提示词「' + (p ? p.title : '') + '」吗？';
  } else {
    const c = store.categories.find(c => c.id === id);
    const count = store.prompts.filter(p => p.categoryId === id).length;
    deleteMessage.textContent = '确定删除分类「' + (c ? c.name : '') + '」及其 ' + count + ' 条提示词吗？';
  }
  deleteModal.classList.add('active');
}

function closeDeleteModal() {
  deleteModal.classList.remove('active');
  deleteTarget = null;
}

function confirmDelete() {
  if (!deleteTarget) return;
  if (deleteTarget.type === 'prompt') {
    vscode.postMessage({ type: 'deletePrompt', id: deleteTarget.id });
  } else {
    vscode.postMessage({ type: 'deleteCategory', id: deleteTarget.id });
  }
  closeDeleteModal();
}

// ── Drag & Drop ────────────────────────────────────────────────
function bindDragEvents() {
  if (isSearchActive()) return; // No drag in search mode

  // Prompt drag
  const cards = promptList.querySelectorAll('.prompt-card[draggable="true"]');
  cards.forEach(card => {
    card.addEventListener('dragstart', onPromptDragStart);
    card.addEventListener('dragend', onPromptDragEnd);
    card.addEventListener('dragover', onPromptDragOver);
    card.addEventListener('dragleave', onPromptDragLeave);
    card.addEventListener('drop', onPromptDrop);
  });

  // Category drag
  const catHeaders = promptList.querySelectorAll('.category-header[draggable="true"]');
  catHeaders.forEach(header => {
    header.addEventListener('dragstart', onCategoryDragStart);
    header.addEventListener('dragend', onCategoryDragEnd);
    header.addEventListener('dragover', onCategoryDragOver);
    header.addEventListener('dragleave', onCategoryDragLeave);
    header.addEventListener('drop', onCategoryDrop);
  });
}

let currentDropIndicator = null;

function removeDropIndicator() {
  if (currentDropIndicator && currentDropIndicator.parentNode) {
    currentDropIndicator.parentNode.removeChild(currentDropIndicator);
  }
  currentDropIndicator = null;
}

function showDropIndicator(target, position) {
  removeDropIndicator();
  const indicator = document.createElement('div');
  indicator.className = 'drop-indicator';
  currentDropIndicator = indicator;

  if (position === 'before') {
    target.parentNode.insertBefore(indicator, target);
  } else {
    target.parentNode.insertBefore(indicator, target.nextSibling);
  }
}

// Prompt drag handlers
function onPromptDragStart(e) {
  dragPromptId = e.currentTarget.dataset.promptId;
  isDragging = true;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragPromptId);
}

function onPromptDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  dragPromptId = null;
  isDragging = false;
  removeDropIndicator();
}

function onPromptDragOver(e) {
  if (!dragPromptId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const position = e.clientY < midY ? 'before' : 'after';
  showDropIndicator(card, position);
}

function onPromptDragLeave(e) {
  removeDropIndicator();
}

function onPromptDrop(e) {
  e.preventDefault();
  removeDropIndicator();
  if (!dragPromptId) return;

  const targetCard = e.currentTarget;
  const targetPromptId = targetCard.dataset.promptId;
  const targetCatId = targetCard.dataset.catId;

  if (dragPromptId === targetPromptId) return;

  const rect = targetCard.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const insertBefore = e.clientY < midY;

  // Build new order for target category
  const catPrompts = store.prompts
    .filter(p => p.categoryId === targetCatId && p.id !== dragPromptId)
    .sort((a, b) => a.order - b.order);

  const targetIdx = catPrompts.findIndex(p => p.id === targetPromptId);
  const insertIdx = insertBefore ? targetIdx : targetIdx + 1;

  // Check if cross-category move
  const dragPrompt = store.prompts.find(p => p.id === dragPromptId);
  if (dragPrompt && dragPrompt.categoryId !== targetCatId) {
    // Cross-category: use movePrompt
    vscode.postMessage({
      type: 'movePrompt',
      promptId: dragPromptId,
      targetCategoryId: targetCatId,
      targetOrder: insertIdx,
    });
  } else {
    // Same category reorder
    catPrompts.splice(insertIdx, 0, { id: dragPromptId });
    const newOrder = catPrompts.map(p => p.id);
    vscode.postMessage({
      type: 'reorderPrompts',
      categoryId: targetCatId,
      promptIds: newOrder,
    });
  }
}

// Category drag handlers
function onCategoryDragStart(e) {
  dragCategoryId = e.currentTarget.dataset.catId;
  isDragging = true;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'cat:' + dragCategoryId);
}

function onCategoryDragEnd(e) {
  dragCategoryId = null;
  isDragging = false;
  removeDropIndicator();
}

function onCategoryDragOver(e) {
  if (!dragCategoryId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const header = e.currentTarget;
  const rect = header.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const position = e.clientY < midY ? 'before' : 'after';
  showDropIndicator(header, position);
}

function onCategoryDragLeave(e) {
  removeDropIndicator();
}

function onCategoryDrop(e) {
  e.preventDefault();
  removeDropIndicator();
  if (!dragCategoryId) return;

  const targetCatId = e.currentTarget.dataset.catId;
  if (dragCategoryId === targetCatId) return;

  const cats = [...store.categories].sort((a, b) => a.order - b.order);
  const dragIdx = cats.findIndex(c => c.id === dragCategoryId);
  const [dragged] = cats.splice(dragIdx, 1);

  const targetIdx = cats.findIndex(c => c.id === targetCatId);
  const rect = e.currentTarget.getBoundingClientRect();
  const insertBefore = e.clientY < rect.top + rect.height / 2;
  const insertIdx = insertBefore ? targetIdx : targetIdx + 1;

  cats.splice(insertIdx, 0, dragged);
  const newOrder = cats.map(c => c.id);

  vscode.postMessage({
    type: 'reorderCategories',
    categoryIds: newOrder,
  });
}

// ── Event Listeners ─────────────────────────────────────────────

// Search
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  render();
});

// Bottom buttons
btnAddPrompt.addEventListener('click', () => openPromptModal(null));
btnAddCategory.addEventListener('click', () => openCategoryModal(null));
btnImport.addEventListener('click', () => vscode.postMessage({ type: 'import' }));
btnExport.addEventListener('click', () => vscode.postMessage({ type: 'export' }));

// Prompt modal
promptModalCancel.addEventListener('click', closePromptModal);
promptModalSave.addEventListener('click', savePrompt);

// Category modal
categoryModalCancel.addEventListener('click', closeCategoryModal);
categoryModalSave.addEventListener('click', saveCategory);

// Delete modal
deleteModalCancel.addEventListener('click', closeDeleteModal);
deleteModalConfirm.addEventListener('click', confirmDelete);

// Delegated clicks on prompt list
promptList.addEventListener('click', (e) => {
  const target = e.target;

  // Category header click → toggle collapse
  const catHeader = target.closest('.category-header');
  if (catHeader && !target.closest('.cat-actions')) {
    const catId = catHeader.dataset.catId;
    const items = promptList.querySelector('.category-items[data-cat-id="' + catId + '"]');
    if (items) {
      catHeader.classList.toggle('collapsed');
      items.classList.toggle('collapsed');
    }
    return;
  }

  // Category rename
  const catRename = target.closest('.cat-rename');
  if (catRename) {
    e.stopPropagation();
    openCategoryModal(catRename.dataset.catId);
    return;
  }

  // Category delete
  const catDelete = target.closest('.cat-delete');
  if (catDelete) {
    e.stopPropagation();
    openDeleteModal('category', catDelete.dataset.catId);
    return;
  }

  // Card edit
  const cardEdit = target.closest('.card-edit');
  if (cardEdit) {
    e.stopPropagation();
    openPromptModal(cardEdit.dataset.promptId);
    return;
  }

  // Card delete
  const cardDelete = target.closest('.card-delete');
  if (cardDelete) {
    e.stopPropagation();
    openDeleteModal('prompt', cardDelete.dataset.promptId);
    return;
  }

  // Prompt card click → inject
  const card = target.closest('.prompt-card');
  if (card && !target.closest('.card-actions') && !target.closest('.drag-handle')) {
    vscode.postMessage({ type: 'inject', promptId: card.dataset.promptId });
    return;
  }
});

// Close modals on overlay click
[promptModal, categoryModal, deleteModal].forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

// Keyboard shortcuts in modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    promptModal.classList.remove('active');
    categoryModal.classList.remove('active');
    deleteModal.classList.remove('active');
  }
  if (e.key === 'Enter' && promptModal.classList.contains('active') && e.target.tagName !== 'TEXTAREA') {
    savePrompt();
  }
  if (e.key === 'Enter' && categoryModal.classList.contains('active')) {
    saveCategory();
  }
});

// ── Message from extension ─────────────────────────────────────
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'init' || msg.type === 'update') {
    store = msg.data;
    render();
  }
  if (msg.type === 'injectResult') {
    showToast(msg.message);
  }
  if (msg.type === 'showAddPrompt') {
    openPromptModal(null);
  }
  if (msg.type === 'showAddCategory') {
    openCategoryModal(null);
  }
});

// ── Init ───────────────────────────────────────────────────────
vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
