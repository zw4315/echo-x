// Echo-X - X(Twitter) 语言学习助手

import { TextAnalyzer, AnalysisResult } from './analyzer.js';
import { checkGatewayStatus, getModelDisplayName, getModelHint } from './api-validator.js';
import { getCachedAnalysis, saveCachedAnalysis, clearCache, getCacheStats } from './cache.js';
import { initTextSelection } from './text-selection.js';
import { createSpeechButton, isSpeechSupported, setDetectedLanguage, getCurrentLanguage, updateAllSpeechButtonsLanguage } from './speech.js';
import { saveQARecord, getQAHistoryByUrl, getQAStats, clearQAHistory, deleteQARecord, QARecord } from './qa-history.js';

console.log('[Echo-X] Starting...');

// 全局状态
let currentPost: any = null;
let analyzer: TextAnalyzer | null = null;
let gatewayConnected = false;
let availableModels: string[] = [];
let forceRefresh = false;  // 强制刷新标志

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Echo-X] DOM ready');
  
  // 绑定按钮
  document.getElementById('refreshBtn')?.addEventListener('click', (e) => {
    // Shift+点击 = 强制刷新
    if (e.shiftKey) {
      forceRefresh = true;
      updateDebug('', '强制刷新模式', '将重新分析并更新缓存');
    }
    extractPost();
  });
  document.getElementById('settingsBtn')?.addEventListener('click', () => showSettings(true));
  document.getElementById('closeSettings')?.addEventListener('click', () => showSettings(false));
  document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
  document.getElementById('generateReplyBtn')?.addEventListener('click', generateReply);
  document.getElementById('refreshConnectionBtn')?.addEventListener('click', checkGatewayAndInit);
  document.getElementById('clearCacheBtn')?.addEventListener('click', handleClearCache);
  document.getElementById('clearQABtn')?.addEventListener('click', handleClearQAHistory);
  
  // 模式选择 (rewrite / qa)
  document.querySelectorAll('.reply-mode-btn').forEach(btn => {
    const button = btn as HTMLButtonElement;
    button.addEventListener('click', () => {
      document.querySelectorAll('.reply-mode-btn').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      
      // 更新 placeholder
      const mode = button.dataset.mode;
      const input = document.getElementById('replyInput') as HTMLTextAreaElement;
      if (input) {
        if (mode === 'rewrite') {
          input.placeholder = '输入你想表达的英文内容，AI会帮你 proofread...';
        } else {
          input.placeholder = '输入你想问的问题，可以引用上文内容...';
        }
      }
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
  
  // 初始化文本选择引用功能
  initTextSelection();
  
  // 检测网关状态
  await checkGatewayAndInit();
  
  // 自动提取当前页面
  extractPost();
  
  // 监听 URL 变化（X 是 SPA，点击回复时 URL 会变化）
  setupUrlChangeListener();
});

// 更新缓存统计显示
async function updateCacheStats() {
  const statsEl = document.getElementById('cacheStats');
  if (!statsEl) return;
  
  const stats = await getCacheStats();
  if (stats.count === 0) {
    statsEl.innerHTML = '暂无缓存';
  } else {
    const oldest = stats.oldestTimestamp ? new Date(stats.oldestTimestamp).toLocaleDateString() : '-';
    statsEl.innerHTML = `${stats.count} 条分析结果 (最早: ${oldest})`;
  }
}

// 更新 Q&A 统计
async function updateQAStats() {
  const statsEl = document.getElementById('qaStats');
  if (!statsEl) return;
  
  const stats = await getQAStats();
  if (stats.totalCount === 0) {
    statsEl.innerHTML = '暂无提问记录';
  } else {
    statsEl.innerHTML = `${stats.totalCount} 条提问 (${stats.postCount} 个帖子) · 今日 ${stats.todayCount} 条`;
  }
}

// 清空缓存
async function handleClearCache() {
  if (!confirm('确定要清空所有缓存的分析结果吗？')) {
    return;
  }
  
  await clearCache();
  updateCacheStats();
  updateDebug('', '缓存已清空');
}

// 清空 Q&A 历史
async function handleClearQAHistory() {
  if (!confirm('确定要清空所有 Q&A 历史记录吗？此操作不可恢复。')) {
    return;
  }
  
  await clearQAHistory();
  updateQAStats();
  await loadQAHistory();
  updateDebug('', 'Q&A 历史已清空');
}

// 加载并显示当前帖子的 Q&A 历史
async function loadQAHistory() {
  if (!currentPost?.url) return;
  
  const history = await getQAHistoryByUrl(currentPost.url);
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
      e.stopPropagation();
      const id = (btn as HTMLButtonElement).dataset.id;
      if (id && confirm('确定删除这条记录吗？')) {
        await deleteQARecord(id);
        await loadQAHistory();
      }
    });
  });
}

// HTML 转义
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 检测网关并初始化
async function checkGatewayAndInit() {
  updateDebug('', '检测本地网关...');
  
  const result = await checkGatewayStatus();
  
  if (result.running) {
    gatewayConnected = true;
    availableModels = result.models || ['kimi-2.5-coding'];
    
    updateDebug('', '✅ 网关已连接', `可用模型: ${availableModels.length} 个`);
    
    // 更新缓存统计
    updateCacheStats();
    
    // 加载保存的模型设置
    const saved = await chrome.storage.local.get(['apiModel']);
    const selectedModel = saved.apiModel || availableModels[0] || 'kimi-2.5-coding';
    
    // 初始化分析器
    analyzer = new TextAnalyzer('local', 'kimi', selectedModel);
    
    // 更新设置面板
    updateModelSelect(availableModels, selectedModel);
    updateConnectionStatus(true);
    
    // 注意：自动分析现在在 showPost 中处理，避免重复分析
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
    analyzeText(currentPost.text, currentPost.url || '');
  }
}

// 显示/隐藏设置
function showSettings(show: boolean) {
  const panel = document.getElementById('settingsPanel');
  if (panel) {
    panel.classList.toggle('hidden', !show);
  }
  
  // 打开设置时重新检测网关和更新统计
  if (show) {
    checkGatewayAndInit();
    updateQAStats();
  }
}

// 监听 URL 变化
let lastExtractedUrl: string | null = null;

function setupUrlChangeListener() {
  // 方法1: 监听标签页更新
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active && tab.url?.includes('/status/')) {
      console.log('[Echo-X] Tab URL changed:', changeInfo.url);
      // URL 变化时自动重新提取
      setTimeout(() => extractPost(), 500); // 稍等片刻让页面加载
    }
  });
  
  // 方法2: 监听标签页切换
  chrome.tabs.onActivated.addListener(() => {
    setTimeout(() => extractPost(), 300);
  });
  
  // 方法3: 定期检查（备用）
  setInterval(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('/status/') && tab.url !== lastExtractedUrl) {
        console.log('[Echo-X] URL changed (poll):', tab.url);
        extractPost();
      }
    } catch (e) {
      // 忽略错误
    }
  }, 2000); // 每 2 秒检查一次
  
  console.log('[Echo-X] URL change listener setup complete');
}

// 提取帖子
async function extractPost() {
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
    
    // 现在有了 URL 才更新调试信息
    updateDebug(url, '提取中...');
    
    // 记录当前提取的 URL
    lastExtractedUrl = url;
    
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

// 尝试通过 content script 提取
async function injectAndExtract(tabId: number, url: string) {
  try {
    updateDebug(url, '提取中...');
    
    // 首先尝试发送消息给 content script
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_POST' });
      console.log('[Echo-X] Content script response:', response);
      
      if (response && response.success && response.data) {
        showPost(response.data);
        return;
      } else if (response && !response.success) {
        updateDebug(url, '提取失败', response.error);
        return;
      }
    } catch (msgError) {
      console.log('[Echo-X] Content script not loaded, falling back to executeScript');
    }
    
    // 如果 content script 没有响应，使用 executeScript 作为后备
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (pageUrl: string) => {
        try {
          const articles = document.querySelectorAll('article');
          if (articles.length === 0) {
            return { success: false, error: 'No articles found' };
          }
          
          // 从 URL 提取 status ID
          const statusMatch = pageUrl.match(/\/status\/(\d+)/);
          const statusId = statusMatch ? statusMatch[1] : null;
          
          // 找到匹配的 article
          let article = articles[0]; // 默认第一个
          
          if (statusId) {
            for (const art of articles) {
              const links = art.querySelectorAll('a[href*="/status/"]');
              for (const link of links) {
                if (link.getAttribute('href')?.includes(statusId)) {
                  article = art;
                  break;
                }
              }
            }
          }
          
          // 判断是否是回复：检查是否有"回复给"的提示
          const replyIndicator = document.querySelector('[data-testid="tweetReplyContext"], [aria-label*="回复"]');
          const isReply = !!replyIndicator;
          
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
              url: pageUrl,
              isReply,
              author: { handle, displayName },
              timestamp,
              text: text.trim()
            }
          };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      },
      args: [url]
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

// 清空 AI 分析内容
function clearAnalysis() {
  const translationEl = document.getElementById('translationText');
  if (translationEl) translationEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:16px 0;">分析中...</div>';
  
  const tokenizationEl = document.getElementById('tokenization');
  if (tokenizationEl) tokenizationEl.innerHTML = '';
  
  const vocabularyEl = document.getElementById('vocabulary');
  if (vocabularyEl) vocabularyEl.innerHTML = '';
  
  const grammarEl = document.getElementById('grammar');
  if (grammarEl) grammarEl.innerHTML = '';
  
  const suggestionsEl = document.getElementById('suggestions');
  if (suggestionsEl) suggestionsEl.innerHTML = '';
}

// 显示帖子
function showPost(data: any) {
  console.log('[Echo-X] Showing post:', data);
  
  if (!data || !data.text) {
    updateDebug('', '错误', '没有文本内容');
    return;
  }
  
  // 清空之前的 AI 分析内容
  clearAnalysis();
  
  // 标记是原帖还是回复
  const isReply = data.isReply;
  if (isReply) {
    console.log('[Echo-X] This is a REPLY, not the original post');
  }
  
  currentPost = data;
  
  // 隐藏空状态
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.classList.add('hidden');
  
  // 显示主内容
  const mainContent = document.getElementById('mainContent');
  if (mainContent) mainContent.classList.remove('hidden');
  
  // 填充原文（带朗读按钮）
  const originalText = document.getElementById('originalText');
  if (originalText) {
    originalText.innerHTML = '';
    
    // 添加标签显示是原帖还是回复
    const typeLabel = document.createElement('div');
    typeLabel.style.cssText = 'font-size: 11px; color: var(--accent); margin-bottom: 8px; font-weight: 600;';
    typeLabel.textContent = isReply ? '💬 回复内容' : '📝 原帖内容';
    originalText.appendChild(typeLabel);
    
    // 创建文本容器
    const textSpan = document.createElement('span');
    textSpan.textContent = data.text;
    originalText.appendChild(textSpan);
    
    // 添加朗读按钮（如果支持）- 初始使用默认语言，分析后会更新
    if (isSpeechSupported()) {
      const speechBtn = createSpeechButton(data.text, getCurrentLanguage());
      speechBtn.classList.add('original-speech-btn');
      originalText.appendChild(speechBtn);
    }
  }
  
  // 填充作者信息
  const authorEl = document.getElementById('authorInfo');
  if (authorEl && data.author) {
    authorEl.textContent = (isReply ? '💬 @' : '📝 @') + data.author.handle;
  }
  
  updateDebug(data.author?.handle || '', '原文显示成功');
  
  // 加载当前帖子的 Q&A 历史
  loadQAHistory();
  
  // 检查是否需要自动分析
  // 如果网关已连接且分析器已初始化，则自动分析
  if (gatewayConnected) {
    if (!analyzer) {
      // 如果分析器未初始化，先初始化
      initAnalyzerAndAnalyze(data.text, data.url || '', data.isReply || false);
    } else {
      // 分析器已存在，直接分析
      analyzeText(data.text, data.url || '', data.isReply || false);
    }
  } else {
    updateDebug('', '就绪', '请运行 ./setup.sh 启动本地网关');
  }
}

// 初始化分析器并分析
async function initAnalyzerAndAnalyze(text: string, url: string, isReply: boolean = false) {
  const saved = await chrome.storage.local.get(['apiModel']);
  const selectedModel = saved.apiModel || availableModels[0] || 'kimi-2.5-coding';
  analyzer = new TextAnalyzer('local', 'kimi', selectedModel);
  analyzeText(text, url, isReply);
}

// AI 分析
async function analyzeText(text: string, url: string, isReply: boolean = false) {
  if (!analyzer || !gatewayConnected) {
    updateDebug('', '跳过分析', '本地网关未连接');
    return;
  }
  
  // 检查缓存（除非强制刷新）
  if (!forceRefresh) {
    const cached = await getCachedAnalysis(text, isReply);
    if (cached) {
      console.log('[Echo-X] Using cached analysis');
      
      // 恢复检测到的语言
      if (cached.result.detectedLanguage) {
        setDetectedLanguage(cached.result.detectedLanguage);
        updateAllSpeechButtonsLanguage(cached.result.detectedLanguage);
      }
      
      showAnalysis(cached.result);
      const date = new Date(cached.timestamp).toLocaleString();
      updateDebug('', `✅ 已加载缓存 (${date})  |  💡 Shift+刷新 强制重新分析`);
      updateCacheStats();
      return;
    }
  }
  
  updateDebug('', 'AI 分析中...');
  showAnalysisLoading(true);
  
  try {
    const result = await analyzer.analyze(text, 'zh');
    
    // 设置检测到的语言（用于朗读）
    if (result.detectedLanguage) {
      setDetectedLanguage(result.detectedLanguage);
      updateAllSpeechButtonsLanguage(result.detectedLanguage);
      console.log('[Echo-X] Detected language:', result.detectedLanguage);
    }
    
    showAnalysis(result);
    
    // 保存到缓存
    const model = (await chrome.storage.local.get(['apiModel'])).apiModel || 'kimi-2.5-coding';
    await saveCachedAnalysis(text, url, result, model, isReply);
    
    updateDebug('', forceRefresh ? '✅ 分析完成 (强制刷新已保存到缓存)' : '✅ 分析完成');
    updateCacheStats();
  } catch (e: any) {
    console.error('[Echo-X] Analysis error:', e);
    const errorMsg = e.message || '未知错误';
    updateDebug('', '❌ 分析失败', errorMsg);
    showAnalysisError(errorMsg);
  } finally {
    showAnalysisLoading(false);
    forceRefresh = false;  // 重置强制刷新标志
  }
}

// 显示分析结果
function showAnalysis(result: AnalysisResult) {
  // 翻译
  const translationEl = document.getElementById('translationText');
  if (translationEl) {
    translationEl.innerHTML = `
      <div style="color:var(--text-secondary);font-size:12px;margin-bottom:4px;">难度: ${escapeHtml(result.difficulty || '')}</div>
      <div>${escapeHtml(result.translation || '')}</div>
    `;
  }
  
  // 分词（带朗读按钮）
  const tokenizationEl = document.getElementById('tokenization');
  if (tokenizationEl && result.tokens) {
    tokenizationEl.innerHTML = '';
    
    result.tokens.forEach(t => {
      const tokenDiv = document.createElement('div');
      tokenDiv.className = 'token';
      
      // 单词和朗读按钮容器
      const wordContainer = document.createElement('div');
      wordContainer.className = 'token-word-container';
      
      const wordSpan = document.createElement('span');
      wordSpan.className = 'token-word';
      wordSpan.textContent = t.word;
      wordContainer.appendChild(wordSpan);
      
      // 添加朗读按钮（如果支持）- 使用检测到的语言
      if (isSpeechSupported()) {
        const speechBtn = createSpeechButton(t.word, getCurrentLanguage());
        speechBtn.classList.add('token-speech-btn');
        wordContainer.appendChild(speechBtn);
      }
      
      tokenDiv.appendChild(wordContainer);
      
      // 其他信息
      if (t.reading) {
        const readingSpan = document.createElement('span');
        readingSpan.className = 'token-reading';
        readingSpan.textContent = t.reading;
        tokenDiv.appendChild(readingSpan);
      }
      
      const posSpan = document.createElement('span');
      posSpan.className = 'token-pos';
      posSpan.textContent = t.pos;
      tokenDiv.appendChild(posSpan);
      
      const meaningSpan = document.createElement('span');
      meaningSpan.className = 'token-meaning';
      meaningSpan.textContent = t.meaning;
      tokenDiv.appendChild(meaningSpan);
      
      tokenizationEl.appendChild(tokenDiv);
    });
  }
  
  // 生词（带朗读按钮）
  const vocabularyEl = document.getElementById('vocabulary');
  const vocabCount = document.getElementById('vocabCount');
  if (vocabularyEl && result.vocabulary) {
    if (vocabCount) vocabCount.textContent = String(result.vocabulary.length);
    vocabularyEl.innerHTML = '';
    
    result.vocabulary.forEach(v => {
      const vocabDiv = document.createElement('div');
      vocabDiv.className = 'vocab-item';
      
      // 单词和朗读按钮
      const wordDiv = document.createElement('div');
      wordDiv.className = 'vocab-word-container';
      
      const wordSpan = document.createElement('span');
      wordSpan.className = 'vocab-word';
      wordSpan.textContent = v.word;
      wordDiv.appendChild(wordSpan);
      
      // 朗读按钮
      if (isSpeechSupported()) {
        const speechBtn = createSpeechButton(v.word, getCurrentLanguage());
        speechBtn.classList.add('vocab-speech-btn');
        wordDiv.appendChild(speechBtn);
      }
      
      const levelSpan = document.createElement('span');
      levelSpan.className = `vocab-level ${getLevelClass(v.level)}`;
      levelSpan.textContent = v.level;
      wordDiv.appendChild(levelSpan);
      
      vocabDiv.appendChild(wordDiv);
      
      // 释义
      const meaningDiv = document.createElement('div');
      meaningDiv.className = 'vocab-meaning';
      meaningDiv.textContent = v.meaning;
      vocabDiv.appendChild(meaningDiv);
      
      // 例句（带汉字注音、翻译和朗读）
      const exampleDiv = document.createElement('div');
      exampleDiv.className = 'vocab-example';
      
      // 例句原文（汉字带注音）和朗读按钮
      const exampleTextRow = document.createElement('div');
      exampleTextRow.className = 'vocab-example-text';
      
      // 如果有读音标注，显示带注音的格式
      if (v.exampleReading) {
        // 使用ルビ形式显示（汉字上方标注读音）
        const rubyContainer = document.createElement('span');
        rubyContainer.className = 'vocab-ruby-text';
        rubyContainer.innerHTML = renderRubyText(v.example, v.exampleReading);
        exampleTextRow.appendChild(rubyContainer);
      } else {
        const exampleText = document.createElement('span');
        exampleText.textContent = v.example;
        exampleTextRow.appendChild(exampleText);
      }
      
      if (isSpeechSupported() && v.example) {
        const exampleSpeechBtn = createSpeechButton(v.example, getCurrentLanguage());
        exampleSpeechBtn.classList.add('example-speech-btn');
        exampleTextRow.appendChild(exampleSpeechBtn);
      }
      
      exampleDiv.appendChild(exampleTextRow);
      
      // 中文翻译
      if (v.exampleTranslation) {
        const translationDiv = document.createElement('div');
        translationDiv.className = 'vocab-example-translation';
        translationDiv.textContent = v.exampleTranslation;
        exampleDiv.appendChild(translationDiv);
      }
      
      vocabDiv.appendChild(exampleDiv);
      vocabularyEl.appendChild(vocabDiv);
    });
  }
  
  // 语法（带朗读按钮和平假名注音）
  const grammarEl = document.getElementById('grammar');
  if (grammarEl && result.grammar) {
    grammarEl.innerHTML = '';
    
    result.grammar.forEach(g => {
      const grammarDiv = document.createElement('div');
      grammarDiv.className = 'grammar-item';
      
      // 语法结构
      const patternDiv = document.createElement('div');
      patternDiv.className = 'grammar-pattern';
      patternDiv.textContent = g.pattern;
      
      // 语法结构朗读按钮
      if (isSpeechSupported()) {
        const patternSpeechBtn = createSpeechButton(g.pattern, getCurrentLanguage());
        patternSpeechBtn.classList.add('grammar-speech-btn');
        patternDiv.appendChild(patternSpeechBtn);
      }
      
      grammarDiv.appendChild(patternDiv);
      
      // 解释
      const explanationDiv = document.createElement('div');
      explanationDiv.className = 'grammar-explanation';
      explanationDiv.textContent = g.explanation;
      grammarDiv.appendChild(explanationDiv);
      
      // 例句（带平假名注音和朗读）
      const exampleDiv = document.createElement('div');
      exampleDiv.className = 'grammar-example';
      
      // 例句原文（汉字带注音）
      if (g.exampleReading) {
        // 使用ルビ形式显示
        const rubyContainer = document.createElement('span');
        rubyContainer.className = 'grammar-ruby-text';
        rubyContainer.innerHTML = renderRubyText(g.example, g.exampleReading);
        exampleDiv.appendChild(rubyContainer);
      } else {
        const exampleText = document.createElement('span');
        exampleText.className = 'grammar-example-text';
        exampleText.textContent = g.example;
        exampleDiv.appendChild(exampleText);
      }
      
      // 例句朗读按钮
      if (isSpeechSupported() && g.example) {
        const exampleSpeechBtn = createSpeechButton(g.example, getCurrentLanguage());
        exampleSpeechBtn.classList.add('example-speech-btn');
        exampleDiv.appendChild(exampleSpeechBtn);
      }
      
      grammarDiv.appendChild(exampleDiv);
      grammarEl.appendChild(grammarDiv);
    });
  }
  
  // 建议
  const suggestionsEl = document.getElementById('suggestions');
  if (suggestionsEl && result.suggestions) {
    suggestionsEl.innerHTML = result.suggestions.map(s => `
      <div class="suggestion-item">💡 ${escapeHtml(s)}</div>
    `).join('');
  }
}

// 渲染带注音的文本（Ruby 标注）
function renderRubyText(text: string, reading: string): string {
  // 如果 reading 是简单的注音列表（如 "にほんご:日本語,べんきょう:勉強"）
  // 或者是完整的注音文本，我们尝试智能匹配
  
  // 简单处理：如果 reading 包含冒号，说明是 key:value 格式
  if (reading.includes(':') || reading.includes('：')) {
    let result = text;
    // 解析注音对
    const pairs = reading.split(/[,，]/);
    pairs.forEach(pair => {
      const [kanji, yomi] = pair.split(/[:：]/);
      if (kanji && yomi) {
        const kanjiTrimmed = kanji.trim();
        const yomiTrimmed = yomi.trim();
        // 替换文本中的汉字为 ruby 标注
        result = result.replace(
          kanjiTrimmed,
          `<ruby>${kanjiTrimmed}<rt>${yomiTrimmed}</rt></ruby>`
        );
      }
    });
    return result;
  }
  
  // 如果不是 key:value 格式，直接显示原文
  return text;
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

// 生成回复 (rewrite / qa 两种模式)
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
    updateDebug('', '错误', '请输入内容');
    return;
  }
  
  const modeBtn = document.querySelector('.reply-mode-btn.active') as HTMLElement;
  const mode = modeBtn?.dataset.mode || 'rewrite';
  
  updateDebug('', mode === 'rewrite' ? 'Proofreading...' : '生成回答中...');
  showReplyLoading(true);
  
  try {
    let result;
    
    if (mode === 'rewrite') {
      // Rewrite 模式：proofread 用户的英文输入
      result = await analyzer.rewriteProofread(
        currentPost.text,
        inputEl.value
      );
    } else {
      // QA 模式：回答问题，可以引用上下文
      result = await analyzer.answerQuestion(
        currentPost.text,
        inputEl.value,
        currentPost.author?.handle || 'author'
      );
      
      // 保存到 Q&A 历史（不受强制刷新影响）
      try {
        const model = (await chrome.storage.local.get(['apiModel'])).apiModel || 'kimi-2.5-coding';
        await saveQARecord({
          postUrl: currentPost.url || window.location.href,
          postText: currentPost.text.substring(0, 200),
          question: inputEl.value,
          answer: result.answer,
          references: result.references,
          model
        });
        console.log('[Echo-X] QA saved to history');
        
        // 刷新 QA 历史显示
        await loadQAHistory();
      } catch (e) {
        console.error('[Echo-X] Failed to save QA:', e);
      }
    }
    
    showGeneratedReply(result, mode);
    inputEl.value = '';
    updateDebug('', mode === 'rewrite' ? '✅ Proofread 完成' : '✅ 回答已生成');
  } catch (e: any) {
    updateDebug('', '生成失败', e.message);
  } finally {
    showReplyLoading(false);
  }
}

// 显示生成的回复 (rewrite 或 qa 模式)
function showGeneratedReply(result: any, mode: string = 'rewrite') {
  const container = document.getElementById('generatedReplies');
  if (!container) return;
  
  const replyEl = document.createElement('div');
  replyEl.className = 'reply-item';
  
  if (mode === 'rewrite') {
    // Rewrite 模式：显示 proofread 结果和改进建议
    replyEl.innerHTML = `
      <div class="reply-section-title">📝 改进版本</div>
      <div class="reply-polished">${result.improvedText || result.polishedReply}</div>
      
      ${result.issues?.length ? `
        <div class="reply-section-title">⚠️ 发现的问题</div>
        <div class="reply-issues">
          ${result.issues.map((issue: any) => `
            <div class="issue-item">
              <div class="issue-original">❌ ${issue.original}</div>
              <div class="issue-suggestion">✅ ${issue.suggestion}</div>
              <div class="issue-explanation">💡 ${issue.explanation}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="reply-section-title">📚 改进说明</div>
      <div class="reply-explanation">${result.explanation}</div>
      
      <div class="reply-actions">
        <button class="reply-copy-btn">📋 复制改进版本</button>
      </div>
    `;
    
    // 绑定复制按钮
    replyEl.querySelector('.reply-copy-btn')?.addEventListener('click', () => {
      const textToCopy = result.improvedText || result.polishedReply;
      navigator.clipboard.writeText(textToCopy);
      updateDebug('', '已复制改进版本');
    });
  } else {
    // QA 模式：显示回答
    replyEl.innerHTML = `
      <div class="reply-section-title">💬 回答</div>
      <div class="reply-answer">${result.answer}</div>
      
      ${result.references?.length ? `
        <div class="reply-section-title">📖 参考引用</div>
        <div class="reply-references">
          ${result.references.map((ref: string) => `<div class="reference-item">• ${ref}</div>`).join('')}
        </div>
      ` : ''}
      
      <div class="reply-actions">
        <button class="reply-copy-btn">📋 复制回答</button>
      </div>
    `;
    
    // 绑定复制按钮
    replyEl.querySelector('.reply-copy-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(result.answer);
      updateDebug('', '已复制回答');
    });
  }
  
  container.insertBefore(replyEl, container.firstChild);
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
