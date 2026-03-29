// Echo-X DOM 工具函数
// 纯 UI 工具，不依赖业务逻辑

/**
 * HTML 转义，防止 XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 安全清空 DOM 元素
 */
export function clearElement(element: Element): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * 添加文本行到容器
 */
export function appendTextLine(container: HTMLElement, text: string, className?: string): void {
  const line = document.createElement('div');
  if (className) {
    line.className = className;
  }
  line.textContent = text;
  container.appendChild(line);
}

/**
 * 创建操作按钮
 */
export function createActionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'reply-copy-btn';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

/**
 * 构建 Ruby 注音片段
 * 支持格式："かな:漢字" 或 "漢字:かな"
 */
export function buildRubyFragment(text: string, reading: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const normalizedReading = reading.trim();

  if (!normalizedReading.includes(':') && !normalizedReading.includes('：')) {
    fragment.append(document.createTextNode(text));
    return fragment;
  }

  const rubyPairs = normalizedReading
    .split(/[,，]/)
    .map((pair) => pair.split(/[:：]/).map((part) => part.trim()))
    .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[0]) && Boolean(parts[1]))
    .map(([left, right]) => {
      const readingFirst = /^[\p{Script=Hiragana}\p{Script=Katakana}\sー]+$/u.test(left)
        && !/^[\p{Script=Hiragana}\p{Script=Katakana}\sー]+$/u.test(right);
      return readingFirst ? { base: right, ruby: left } : { base: left, ruby: right };
    });

  if (rubyPairs.length === 0) {
    fragment.append(document.createTextNode(text));
    return fragment;
  }

  let cursor = 0;

  for (const { base, ruby } of rubyPairs) {
    const index = text.indexOf(base, cursor);
    if (index === -1) {
      continue;
    }

    if (index > cursor) {
      fragment.append(document.createTextNode(text.slice(cursor, index)));
    }

    const rubyEl = document.createElement('ruby');
    rubyEl.append(document.createTextNode(base));
    const rtEl = document.createElement('rt');
    rtEl.textContent = ruby;
    rubyEl.appendChild(rtEl);
    fragment.appendChild(rubyEl);
    cursor = index + base.length;
  }

  if (cursor < text.length) {
    fragment.append(document.createTextNode(text.slice(cursor)));
  }

  if (!fragment.hasChildNodes()) {
    fragment.append(document.createTextNode(text));
  }

  return fragment;
}

/**
 * 渲染带注音的文本到容器
 */
export function renderRubyText(container: HTMLElement, text: string, reading: string): void {
  clearElement(container);
  container.appendChild(buildRubyFragment(text, reading));
}

/**
 * 获取等级样式类名
 */
export function getLevelClass(level: string): string {
  const levelMap: Record<string, string> = {
    'N1': 'level-n1',
    'N2': 'level-n2',
    'N3': 'level-n3',
    'N4': 'level-n4',
    'N5': 'level-n5',
    'basic': 'level-basic',
    'intermediate': 'level-intermediate',
    'advanced': 'level-advanced',
    '初级': 'level-basic',
    '中级': 'level-intermediate',
    '高级': 'level-advanced'
  };
  return levelMap[level] || 'level-basic';
}
