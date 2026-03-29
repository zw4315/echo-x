// Echo-X QA 和回复渲染器
// 负责渲染问答历史和生成的回复

// 回调函数类型，避免循环依赖
export type DebugLogger = (url: string, status: string, error?: string) => void;

import { QARecord, deleteQARecord, getQAHistoryByUrl, getQAStats, clearQAHistory } from '../../services/qa-history.js';
import { escapeHtml, appendTextLine, createActionButton } from './dom.js';

let debugLogger: DebugLogger = () => {};

export function setDebugLogger(logger: DebugLogger): void {
  debugLogger = logger;
}

/**
 * 加载并显示当前帖子的 Q&A 历史
 */
export async function loadQAHistory(postUrl: string): Promise<void> {
  const history = await getQAHistoryByUrl(postUrl);
  const container = document.getElementById('qaHistoryList');
  const countEl = document.getElementById('qaHistoryCount');
  
  if (countEl) {
    countEl.textContent = history.length > 0 ? `${history.length} 条` : '';
  }
  
  if (!container) return;
  
  if (history.length === 0) {
    container.innerHTML = '<div class="qa-history-empty">暂无提问记录</div>';
    return;
  }
  
  container.innerHTML = history.map((qa: QARecord) => `
    <div class="qa-history-item" data-id="${qa.id}">
      <div class="qa-history-question">❓ ${escapeHtml(qa.question)}</div>
      <div class="qa-history-answer">💡 ${escapeHtml(qa.answer.substring(0, 100))}${qa.answer.length > 100 ? '...' : ''}</div>
      <div class="qa-history-meta">
        <span>${new Date(qa.timestamp).toLocaleDateString()}</span>
        <button class="qa-delete-btn" data-id="${qa.id}" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');
  
  // 绑定删除按钮
  container.querySelectorAll('.qa-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (id && confirm('确定删除这条记录吗？')) {
        await deleteQARecord(id);
        await loadQAHistory(postUrl);
        await updateQAStatsDisplay();
      }
    });
  });
}

/**
 * 更新 QA 统计显示
 */
export async function updateQAStatsDisplay(): Promise<void> {
  const statsEl = document.getElementById('qaStats');
  if (!statsEl) return;
  
  const stats = await getQAStats();
  if (stats.totalCount === 0) {
    statsEl.innerHTML = '暂无提问记录';
  } else {
    statsEl.innerHTML = `${stats.totalCount} 条提问 (${stats.postCount} 个帖子) · 今日 ${stats.todayCount} 条`;
  }
}

/**
 * 清空 QA 历史
 */
export async function handleClearQAHistory(): Promise<void> {
  if (!confirm('确定要清空所有 Q&A 历史记录吗？此操作不可恢复。')) {
    return;
  }
  
  await clearQAHistory();
  await updateQAStatsDisplay();
}

/**
 * 显示生成的回复 (rewrite 或 qa 模式)
 */
export function showGeneratedReply(result: any, mode: string = 'rewrite'): void {
  const container = document.getElementById('generatedReplies');
  if (!container) return;
  
  const replyEl = document.createElement('div');
  replyEl.className = 'reply-item';
  
  if (mode === 'rewrite') {
    showRewriteReply(replyEl, result);
  } else {
    showQAReply(replyEl, result);
  }
  
  container.insertBefore(replyEl, container.firstChild);
}

/**
 * 显示 Rewrite 模式的回复
 */
function showRewriteReply(container: HTMLElement, result: any): void {
  const textToCopy = result.improvedText || result.polishedReply || '';

  appendTextLine(container, '📝 改进版本', 'reply-section-title');

  const polishedEl = document.createElement('div');
  polishedEl.className = 'reply-polished';
  polishedEl.textContent = textToCopy;
  container.appendChild(polishedEl);

  if (result.issues?.length) {
    appendTextLine(container, '⚠️ 发现的问题', 'reply-section-title');

    const issuesEl = document.createElement('div');
    issuesEl.className = 'reply-issues';

    result.issues.forEach((issue: any) => {
      const issueEl = document.createElement('div');
      issueEl.className = 'issue-item';
      appendTextLine(issueEl, `❌ ${issue.original || ''}`, 'issue-original');
      appendTextLine(issueEl, `✅ ${issue.suggestion || ''}`, 'issue-suggestion');
      appendTextLine(issueEl, `💡 ${issue.explanation || ''}`, 'issue-explanation');
      issuesEl.appendChild(issueEl);
    });

    container.appendChild(issuesEl);
  }

  appendTextLine(container, '📚 改进说明', 'reply-section-title');
  appendTextLine(container, result.explanation || '', 'reply-explanation');

  const actionsEl = document.createElement('div');
  actionsEl.className = 'reply-actions';
  actionsEl.appendChild(createActionButton('📋 复制改进版本', () => {
    navigator.clipboard.writeText(textToCopy);
    debugLogger('', '已复制改进版本');
  }));
  container.appendChild(actionsEl);
}

/**
 * 显示 QA 模式的回复
 */
function showQAReply(container: HTMLElement, result: any): void {
  appendTextLine(container, '💬 回答', 'reply-section-title');

  const answerEl = document.createElement('div');
  answerEl.className = 'reply-answer';
  answerEl.textContent = result.answer || '';
  container.appendChild(answerEl);

  if (result.references?.length) {
    appendTextLine(container, '📖 参考引用', 'reply-section-title');

    const referencesEl = document.createElement('div');
    referencesEl.className = 'reply-references';

    result.references.forEach((ref: string) => {
      appendTextLine(referencesEl, `• ${ref}`, 'reference-item');
    });

    container.appendChild(referencesEl);
  }

  const actionsEl = document.createElement('div');
  actionsEl.className = 'reply-actions';
  actionsEl.appendChild(createActionButton('📋 复制回答', () => {
    navigator.clipboard.writeText(result.answer || '');
    debugLogger('', '已复制回答');
  }));
  container.appendChild(actionsEl);
}
