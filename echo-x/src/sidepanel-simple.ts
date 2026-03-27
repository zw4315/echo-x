// Echo-X - X(Twitter) 语言学习助手

import { TextAnalyzer, AnalysisResult } from './analyzer.js';
import { checkGatewayStatus, getModelDisplayName, getModelHint } from './api-validator.js';

console.log('[Echo-X] Starting...');

// 全局状态
let currentPost: any = null;
let analyzer: TextAnalyzer | null = null;
let gatewayConnected = false;
let availableModels: string[] = [];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Echo-X] DOM ready');
  
  // 绑定按钮
  document.getElementById('refreshBtn')?.addEventListener('click', extractPost);
  document.getElementById('settingsBtn')?.addEventListener('click', () => showSettings(true));
  document.getElementById('closeSettings')?.addEventListener('click', () => showSettings(false));
  document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
  document.getElementById('generateReplyBtn')?.addEventListener('click', generateReply);
  document.getElementById('refreshConnectionBtn')?.addEventListener('click', checkGatewayAndInit);
  
  // 语气选择
  document.querySelectorAll('.reply-tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.reply-tone-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // 快捷键
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 's') {
      e.preventDefault();
      const panel = document.getElementById('settingsPanel');
      showSettings(panel?.classList.contains('hidden') || false);
    }
  });
  
  // 检测网关状态
  await checkGatewayAndInit();
  
  // 自动提取当前页面
  extractPost();
});

// 检测网关并初始化
async function checkGatewayAndInit() {
  updateDebug('', '检测本地网关...');
  
  const result = await checkGatewayStatus();
  
  if (result.running) {
    gatewayConnected = true;
    availableModels = result.models || ['kimi-2.5-coding'];
    
    updateDebug('', '✅ 网关已连接', `可用模型: ${availableModels.length} 个`);
    
    // 加载保存的模型设置
    const saved = await chrome.storage.local.get(['apiModel']);
    const selectedModel = saved.apiModel || availableModels[0] || 'kimi-2.5-coding';
    
    // 初始化分析器
    analyzer = new TextAnalyzer('local', 'kimi', selectedModel);
    
    // 更新设置面板
    updateModelSelect(availableModels, selectedModel);
    updateConnectionStatus(true);
    
    // 如果有当前帖子，自动分析
    if (currentPost?.text) {
      analyzeText(currentPost.text);
    }
  } else {
    gatewayConnected = false;
    updateDebug('', '❌ 网关未连接', result.error || '请运行 ./setup.sh 启动服务');
    updateConnectionStatus(false, result.error);
  }
}

// 更新连接状态显示
function updateConnectionStatus(connected: boolean, error?: string) {
  const statusEl = document.getElementById('connectionStatus');
  const saveBtn = document.getElementById('saveSettings');
  const modelSelect = document.getElementById('modelSelectContainer');
  
  if (statusEl) {
    if (connected) {
      statusEl.innerHTML = '✅ <span style="color: #00ba7c;">本地网关已连接</span>';
      statusEl.className = 'status-connected';
    } else {
      statusEl.innerHTML = `❌ <span style="color: #f4212e;">${error || '网关未连接'}</span><br><small style="color: #888;">请运行: ./setup.sh</small>`;
      statusEl.className = 'status-error';
    }
  }
  
  if (saveBtn) saveBtn.style.display = connected ? 'block' : 'none';
  if (modelSelect) modelSelect.style.display = connected ? 'block' : 'none';
}

// 更新模型选择列表
function updateModelSelect(models: string[], selectedModel: string) {
  const modelEl = document.getElementById('apiModel') as HTMLSelectElement;
  const hintEl = document.getElementById('modelHint');
  
  if (!modelEl) return;
  
  modelEl.innerHTML = '';
  
  models.forEach(modelId => {
    const option = document.createElement('option');
    option.value = modelId;
    option.textContent = getModelDisplayName(modelId);
    if (modelId === selectedModel) {
      option.selected = true;
    }
    modelEl.appendChild(option);
  });
  
  // 更新提示
  if (hintEl) {
    hintEl.textContent = getModelHint(modelEl.value);
  }
  
  // 监听变化
  modelEl.onchange = () => {
    if (hintEl) {
      hintEl.textContent = getModelHint(modelEl.value);
    }
  };
}

// 保存设置
async function saveSettings() {
  const modelEl = document.getElementById('apiModel') as HTMLSelectElement;
  const selectedModel = modelEl?.value || 'kimi-2.5-coding';
  
  await chrome.storage.local.set({ apiModel: selectedModel });
  
  // 重新初始化分析器
  if (gatewayConnected) {
    analyzer = new TextAnalyzer('local', 'kimi', selectedModel);
  }
  
  showSettings(false);
  updateDebug('', '✅ 设置已保存', `模型: ${getModelDisplayName(selectedModel)}`);
  
  // 如果有当前帖子，重新分析
  if (currentPost?.text && analyzer) {
    analyzeText(currentPost.text);
  }
}

// 显示/隐藏设置
function showSettings(show: boolean) {
  const panel = document.getElementById('settingsPanel');
  if (panel) {
    panel.classList.toggle('hidden', !show);
  }
  
  // 打开设置时重新检测网关
  if (show) {
    checkGatewayAndInit();
  }
}

// 提取帖子
async function extractPost() {
  updateDebug('', '提取中...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.url) {
      updateDebug('', '错误', '无法获取当前页面');
      return;
    }
    
    const url = tab.url;
    
    // 检查是否是 X 帖子页面
    if (!url.includes('/status/')) {
      updateDebug(url, '不是帖子页面', '请打开具体帖子');
      return;
    }
    
    if (!tab.id) {
      updateDebug(url, '错误', '无法获取标签页ID');
      return;
    }
    
    // 直接执行提取代码
    await injectAndExtract(tab.id, url);
  } catch (e: any) {
    updateDebug('', '异常', e.message);
  }
}

// 直接执行提取代码
async function injectAndExtract(tabId: number, url: string) {
  try {
    updateDebug(url, '提取中...');
    
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          const articles = document.querySelectorAll('article');
          if (articles.length === 0) {
            return { success: false, error: 'No articles found' };
          }
          
          const article = articles[0];
          
          // 提取作者
          const authorLink = article.querySelector('a[role="link"][href^="/"]') as HTMLAnchorElement | null;
          const href = authorLink?.getAttribute('href') || '';
          const handle = href.split('/').pop() || 'unknown';
          const displayNameEl = article.querySelector('[dir="ltr"] span');
          const displayName = displayNameEl?.textContent || handle;
          
          // 提取时间
          const timeEl = article.querySelector('time');
          const timestamp = timeEl?.getAttribute('datetime') || new Date().toISOString();
          
          // 提取文本
          let text = '';
          const textContainer = article.querySelector('[data-testid="tweetText"]');
          if (textContainer) {
            text = textContainer.textContent || '';
          } else {
            const langDiv = article.querySelector('div[lang]');
            if (langDiv) {
              text = langDiv.textContent || '';
            }
          }
          
          if (!text) {
            return { success: false, error: 'No text found' };
          }
          
          return {
            success: true,
            data: {
              author: { handle, displayName },
              timestamp,
              text: text.trim()
            }
          };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }
    });
    
    console.log('[Echo-X] Execute script results:', results);
    
    if (results && results[0] && results[0].result) {
      const result = results[0].result;
      if (result.success && result.data) {
        showPost(result.data);
      } else {
        updateDebug(url, '提取失败', result.error);
      }
    } else {
      updateDebug(url, '无返回结果');
    }
  } catch (e: any) {
    updateDebug(url, '执行失败', e.message);
  }
}

// 显示帖子
function showPost(data: any) {
  console.log('[Echo-X] Showing post:', data);
  
  if (!data || !data.text) {
    updateDebug('', '错误', '没有文本内容');
    return;
  }
  
  currentPost = data;
  
  // 隐藏空状态
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.classList.add('hidden');
  
  // 显示主内容
  const mainContent = document.getElementById('mainContent');
  if (mainContent) mainContent.classList.remove('hidden');
  
  // 填充原文
  const originalText = document.getElementById('originalText');
  if (originalText) originalText.textContent = data.text;
  
  // 填充作者信息
  const authorEl = document.getElementById('authorInfo');
  if (authorEl && data.author) {
    authorEl.textContent = `@${data.author.handle}`;
  }
  
  updateDebug(data.author?.handle || '', '原文显示成功');
  
  // 如果网关已连接，自动分析
  if (analyzer && gatewayConnected) {
    analyzeText(data.text);
  } else if (!gatewayConnected) {
    updateDebug('', '就绪', '请运行 ./setup.sh 启动本地网关');
  }
}

// AI 分析
async function analyzeText(text: string) {
  if (!analyzer || !gatewayConnected) {
    updateDebug('', '跳过分析', '本地网关未连接');
    return;
  }
  
  updateDebug('', 'AI 分析中...');
  showAnalysisLoading(true);
  
  try {
    const result = await analyzer.analyze(text, 'zh');
    showAnalysis(result);
    updateDebug('', '✅ 分析完成');
  } catch (e: any) {
    console.error('[Echo-X] Analysis error:', e);
    const errorMsg = e.message || '未知错误';
    updateDebug('', '❌ 分析失败', errorMsg);
    showAnalysisError(errorMsg);
  } finally {
    showAnalysisLoading(false);
  }
}

// 显示分析结果
function showAnalysis(result: AnalysisResult) {
  // 翻译
  const translationEl = document.getElementById('translationText');
  if (translationEl) {
    translationEl.innerHTML = `
      <div style="color:var(--text-secondary);font-size:12px;margin-bottom:4px;">难度: ${result.difficulty}</div>
      <div>${result.translation}</div>
    `;
  }
  
  // 分词
  const tokenizationEl = document.getElementById('tokenization');
  if (tokenizationEl && result.tokens) {
    tokenizationEl.innerHTML = result.tokens.map(t => `
      <div class="token">
        <span class="token-word">${t.word}</span>
        ${t.reading ? `<span class="token-reading">${t.reading}</span>` : ''}
        <span class="token-pos">${t.pos}</span>
        <span class="token-meaning">${t.meaning}</span>
      </div>
    `).join('');
  }
  
  // 生词
  const vocabularyEl = document.getElementById('vocabulary');
  const vocabCount = document.getElementById('vocabCount');
  if (vocabularyEl && result.vocabulary) {
    if (vocabCount) vocabCount.textContent = String(result.vocabulary.length);
    vocabularyEl.innerHTML = result.vocabulary.map(v => `
      <div class="vocab-item">
        <div>
          <span class="vocab-word">${v.word}</span>
          <span class="vocab-level ${getLevelClass(v.level)}">${v.level}</span>
        </div>
        <div class="vocab-meaning">${v.meaning}</div>
        <div class="vocab-example">${v.example}</div>
      </div>
    `).join('');
  }
  
  // 语法
  const grammarEl = document.getElementById('grammar');
  if (grammarEl && result.grammar) {
    grammarEl.innerHTML = result.grammar.map(g => `
      <div class="grammar-item">
        <div class="grammar-pattern">${g.pattern}</div>
        <div class="grammar-explanation">${g.explanation}</div>
        <div class="grammar-example">${g.example}</div>
      </div>
    `).join('');
  }
  
  // 建议
  const suggestionsEl = document.getElementById('suggestions');
  if (suggestionsEl && result.suggestions) {
    suggestionsEl.innerHTML = result.suggestions.map(s => `
      <div class="suggestion-item">💡 ${s}</div>
    `).join('');
  }
}

// 获取等级样式
function getLevelClass(level: string): string {
  const levelMap: Record<string, string> = {
    'N5': 'level-n5', 'N4': 'level-n4', 'N3': 'level-n3',
    'N2': 'level-n2', 'N1': 'level-n1',
    'A1': 'level-n5', 'A2': 'level-n4', 'B1': 'level-n3',
    'B2': 'level-n2', 'C1': 'level-n2', 'C2': 'level-n1',
    'basic': 'level-n5', 'intermediate': 'level-n3', 'advanced': 'level-n1',
    '初级': 'level-n5', '中级': 'level-n3', '高级': 'level-n1'
  };
  return levelMap[level] || 'level-n3';
}

// 显示分析加载状态
function showAnalysisLoading(loading: boolean) {
  const loadingEl = document.getElementById('analysisLoading');
  if (loadingEl) {
    loadingEl.style.display = loading ? 'flex' : 'none';
  }
}

// 显示分析错误
function showAnalysisError(error: string) {
  const translationEl = document.getElementById('translationText');
  if (translationEl) {
    translationEl.innerHTML = `<div style="color:#f00;">AI 分析失败: ${error}</div>`;
  }
}

// 生成回复
async function generateReply() {
  if (!currentPost?.text) {
    updateDebug('', '错误', '没有帖子内容');
    return;
  }
  
  if (!analyzer || !gatewayConnected) {
    updateDebug('', '错误', '本地网关未连接，请运行 ./setup.sh');
    return;
  }
  
  const inputEl = document.getElementById('replyInput') as HTMLTextAreaElement;
  if (!inputEl?.value.trim()) {
    updateDebug('', '错误', '请输入回复内容');
    return;
  }
  
  const toneBtn = document.querySelector('.reply-tone-btn.active') as HTMLElement;
  const tone = toneBtn?.dataset.tone || 'friendly';
  
  updateDebug('', '生成回复中...');
  showReplyLoading(true);
  
  try {
    const result = await analyzer.generateReply(
      currentPost.text,
      inputEl.value,
      tone,
      'en'
    );
    
    showGeneratedReply(result);
    inputEl.value = '';
    updateDebug('', '回复生成成功');
  } catch (e: any) {
    updateDebug('', '生成失败', e.message);
  } finally {
    showReplyLoading(false);
  }
}

// 显示生成的回复
function showGeneratedReply(result: any) {
  const container = document.getElementById('generatedReplies');
  if (!container) return;
  
  const replyEl = document.createElement('div');
  replyEl.className = 'reply-item';
  replyEl.innerHTML = `
    <div class="reply-polished">${result.polishedReply}</div>
    <div class="reply-translation">${result.translation}</div>
    <div class="reply-explanation">${result.explanation}</div>
    ${result.grammarCheck?.hasErrors ? `
      <div class="reply-errors">
        <div>⚠️ 语法问题：</div>
        <ul>${result.grammarCheck.errors.map((e: string) => `<li>${e}</li>`).join('')}</ul>
      </div>
    ` : ''}
    <div class="reply-actions">
      <button class="reply-copy-btn">📋 复制</button>
      <button class="reply-use-btn">✓ 使用</button>
    </div>
  `;
  
  container.insertBefore(replyEl, container.firstChild);
  
  // 绑定按钮
  replyEl.querySelector('.reply-copy-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(result.polishedReply);
    updateDebug('', '已复制');
  });
  
  replyEl.querySelector('.reply-use-btn')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'FILL_REPLY', text: result.polishedReply });
    }
  });
}

// 显示回复加载状态
function showReplyLoading(loading: boolean) {
  const btn = document.getElementById('generateReplyBtn') as HTMLButtonElement;
  if (btn) btn.disabled = loading;
}

// 更新调试信息
function updateDebug(url: string, status: string, error?: string) {
  const urlEl = document.getElementById('debugUrl');
  const statusEl = document.getElementById('debugStatus');
  const errorEl = document.getElementById('debugError');
  
  if (urlEl) urlEl.textContent = 'URL: ' + (url || '-') + ' | ' + new Date().toLocaleTimeString();
  if (statusEl) statusEl.textContent = '状态: ' + status;
  if (errorEl) errorEl.textContent = error ? '错误: ' + error : '';
  
  console.log('[Echo-X Debug]', { url, status, error });
}
