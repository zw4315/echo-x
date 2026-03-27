// Echo-X 文本选择引用功能
// 类似 ChatGPT 的选中后引用功能

let selectionPopup: HTMLElement | null = null;
let lastSelectedText = '';

// 初始化文本选择监听
export function initTextSelection() {
  // 创建引用按钮（初始隐藏）
  createSelectionPopup();
  
  // 监听选择事件
  document.addEventListener('mouseup', handleSelection);
  document.addEventListener('selectionchange', () => {
    // 延迟检查，确保选择完成
    setTimeout(checkSelection, 10);
  });
  
  // 点击其他地方隐藏按钮
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.selection-popup')) {
      hideSelectionPopup();
    }
  });
}

// 创建选择弹出按钮
function createSelectionPopup() {
  if (selectionPopup) return;
  
  selectionPopup = document.createElement('div');
  selectionPopup.className = 'selection-popup';
  selectionPopup.innerHTML = `
    <button class="selection-quote-btn" title="引用选中内容">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M3 12h18M3 18h6"></path>
      </svg>
      <span>引用</span>
    </button>
  `;
  
  // 点击引用按钮
  const quoteBtn = selectionPopup.querySelector('.selection-quote-btn');
  quoteBtn?.addEventListener('click', () => {
    quoteSelectedText();
    hideSelectionPopup();
  });
  
  document.body.appendChild(selectionPopup);
}

// 处理选择事件
function handleSelection(_e: MouseEvent) {
  // 延迟检查，确保选择完成
  setTimeout(() => checkSelection(), 50);
}

// 检查当前选择
function checkSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    hideSelectionPopup();
    return;
  }
  
  const text = selection.toString().trim();
  if (!text || text.length < 2) {
    hideSelectionPopup();
    return;
  }
  
  // 检查选择是否在侧边栏内
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE 
    ? container.parentElement 
    : container as Element;
    
  if (!element?.closest('#app')) {
    hideSelectionPopup();
    return;
  }
  
  // 保存选中文本
  lastSelectedText = text;
  
  // 显示引用按钮
  showSelectionPopup(selection);
}

// 显示引用按钮
function showSelectionPopup(selection: Selection) {
  if (!selectionPopup) return;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // 计算位置：在选区上方居中
  const left = rect.left + (rect.width / 2) - 30;
  const top = rect.top - 40;
  
  selectionPopup.style.left = `${left}px`;
  selectionPopup.style.top = `${top}px`;
  selectionPopup.style.opacity = '1';
  selectionPopup.style.pointerEvents = 'auto';
  selectionPopup.classList.add('show');
}

// 隐藏引用按钮
function hideSelectionPopup() {
  if (!selectionPopup) return;
  selectionPopup.style.opacity = '0';
  selectionPopup.style.pointerEvents = 'none';
  selectionPopup.classList.remove('show');
}

// 引用选中的文本 - 自动切换到 QA 模式
function quoteSelectedText() {
  if (!lastSelectedText) return;
  
  const input = document.getElementById('replyInput') as HTMLTextAreaElement;
  if (!input) return;
  
  // 自动切换到 QA 模式
  const qaBtn = document.querySelector('.reply-mode-btn[data-mode="qa"]') as HTMLButtonElement;
  if (qaBtn) {
    // 移除其他按钮的激活状态
    document.querySelectorAll('.reply-mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    // 激活 QA 按钮
    qaBtn.classList.add('active');
    
    // 更新 placeholder
    input.placeholder = '针对这段内容，你想了解什么？';
  }
  
  // 获取当前输入框内容
  const currentValue = input.value;
  
  // 格式化引用文本（QA 模式格式）
  let quoteText = `> "${lastSelectedText}"\n\n`;
  
  // 插入到输入框
  if (currentValue) {
    input.value = currentValue + '\n\n' + quoteText;
  } else {
    input.value = quoteText;
  }
  
  // 聚焦输入框并滚动到底部
  input.focus();
  input.scrollTop = input.scrollHeight;
  
  // 触发输入事件（如果有监听）
  input.dispatchEvent(new Event('input'));
  
  console.log('[Echo-X] Quoted text (QA mode):', lastSelectedText.substring(0, 50) + '...');
}

// 清除选择
export function clearSelection() {
  window.getSelection()?.removeAllRanges();
  hideSelectionPopup();
}
