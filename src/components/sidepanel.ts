// Echo-X - X(Twitter) 语言学习助手
// 主控制器，只负责协调各模块

import { TextAnalyzer, AnalysisResult } from '../services/analyzer.js';
import { checkGatewayStatus, getModelDisplayName, getModelHint } from '../utils/api-validator.js';
import { getCachedAnalysis, saveCachedAnalysis, clearCache, getCacheStats } from '../utils/cache.js';
import { initTextSelection } from '../utils/text-selection.js';
import { setDetectedLanguage } from '../utils/speech.js';
import { saveQARecord } from '../services/qa-history.js';
import { escapeHtml } from './ui/dom.js';
import { renderAnalysis, showAnalysisLoading, showAnalysisError, clearAnalysis } from './ui/analysisRenderer.js';
import { loadQAHistory, updateQAStatsDisplay, handleClearQAHistory, showGeneratedReply, setDebugLogger } from './ui/qaRenderer.js';

console.log('[Echo-X] Starting...');

// 全局状态
export let currentPost: any = null;
let analyzer: TextAnalyzer | null = null;
export let gatewayConnected = false;
let availableModels: string[] = [];
export let forceRefresh = false;

// === 初始化 ===

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Echo-X] DOM ready');
  
  // 设置调试日志回调
  setDebugLogger(updateDebug);
  
  bindEventListeners();
  initTextSelection();
  
  await checkGatewayAndInit();
  extractPost();
  setupUrlChangeListener();
});

function bindEventListeners(): void {
  document.getElementById('refreshBtn')?.addEventListener('click', (e) => {
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
  document.getElementById('clearQABtn')?.addEventListener('click', () => handleClearQAHistory());
  
  // 模式选择
  document.querySelectorAll('.reply-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.reply-mode-btn').forEach(b => b.classList.remove('active'));
      (btn as HTMLButtonElement).classList.add('active');
      
      const mode = (btn as HTMLButtonElement).dataset.mode;
      const input = document.getElementById('replyInput') as HTMLTextAreaElement;
      if (input) {
        input.placeholder = mode === 'rewrite' 
          ? '输入你想表达的英文内容，AI会帮你 proofread...'
          : '输入你想问的问题，可以引用上文内容...';
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
}

// === 调试工具 (导出供其他模块使用) ===

export function updateDebug(url: string, status: string, error?: string): void {
  const urlEl = document.getElementById('debugUrl');
  const statusEl = document.getElementById('debugStatus');
  const errorEl = document.getElementById('debugError');
  
  if (urlEl) urlEl.textContent = 'URL: ' + (url || '-') + ' | ' + new Date().toLocaleTimeString();
  if (statusEl) statusEl.textContent = '状态: ' + status;
  if (errorEl) errorEl.textContent = error ? '错误: ' + error : '';
  
  console.log('[Echo-X Debug]', { url, status, error });
}

// === 设置 ===

async function checkGatewayAndInit(): Promise<void> {
  updateDebug('', '检测本地网关...');
  
  const result = await checkGatewayStatus();
  
  if (result.running) {
    gatewayConnected = true;
    availableModels = result.models || ['kimi-2.5-coding'];
    
    updateDebug('', '✅ 网关已连接', `可用模型: ${availableModels.length} 个`);
    updateCacheStats();
    
    const saved = await chrome.storage.local.get(['apiModel']);
    const selectedModel = saved.apiModel || availableModels[0] || 'kimi-2.5-coding';
    
    analyzer = new TextAnalyzer('local', 'kimi', selectedModel);
    
    updateModelSelect(availableModels, selectedModel);
    updateConnectionStatus(true);
  } else {
    gatewayConnected = false;
    updateDebug('', '❌ 网关未连接', result.error || '请运行 ./setup.sh 启动服务');
    updateConnectionStatus(false, result.error);
  }
}

function updateConnectionStatus(connected: boolean, error?: string): void {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;
  
  if (connected) {
    statusEl.innerHTML = '✅ <span style="color: #00ba7c;">本地网关已连接</span>';
    statusEl.className = 'status-connected';
  } else {
    statusEl.innerHTML = `❌ <span style="color: #f4212e;">${escapeHtml(error || '网关未连接')}</span><br><small style="color: #888;">请运行: ./setup.sh</small>`;
    statusEl.className = 'status-error';
  }
}

function updateModelSelect(models: string[], selectedModel: string): void {
  const modelEl = document.getElementById('apiModel') as HTMLSelectElement;
  const hintEl = document.getElementById('modelHint');
  if (!modelEl) return;
  
  modelEl.innerHTML = '';
  
  models.forEach(modelId => {
    const option = document.createElement('option');
    option.value = modelId;
    option.textContent = getModelDisplayName(modelId);
    if (modelId === selectedModel) option.selected = true;
    modelEl.appendChild(option);
  });
  
  if (hintEl) hintEl.textContent = getModelHint(modelEl.value);
  
  modelEl.onchange = () => {
    if (hintEl) hintEl.textContent = getModelHint(modelEl.value);
  };
}

async function saveSettings(): Promise<void> {
  const modelEl = document.getElementById('apiModel') as HTMLSelectElement;
  const selectedModel = modelEl?.value || 'kimi-2.5-coding';
  
  await chrome.storage.local.set({ apiModel: selectedModel });
  
  if (gatewayConnected) {
    analyzer = new TextAnalyzer('local', 'kimi', selectedModel);
  }
  
  showSettings(false);
  updateDebug('', '✅ 设置已保存', `模型: ${getModelDisplayName(selectedModel)}`);
  
  if (currentPost?.text && analyzer) {
    analyzeText(currentPost.text, currentPost.url || '');
  }
}

function showSettings(show: boolean): void {
  const panel = document.getElementById('settingsPanel');
  if (panel) panel.classList.toggle('hidden', !show);
  
  if (show) {
    checkGatewayAndInit();
    updateQAStatsDisplay();
  }
}

// === 缓存统计 ===

async function updateCacheStats(): Promise<void> {
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

async function handleClearCache(): Promise<void> {
  if (!confirm('确定要清空所有缓存的分析结果吗？')) return;
  await clearCache();
  updateCacheStats();
  updateDebug('', '缓存已清空');
}

// === 内容提取 ===

let lastExtractedUrl: string | null = null;

function clearAllContent(): void {
  analyzer?.abort();
  
  document.getElementById('originalText')!.innerHTML = '';
  document.getElementById('authorInfo')!.textContent = '';
  
  clearAnalysis();
  
  document.getElementById('qaHistoryList')!.innerHTML = '';
  document.getElementById('qaHistoryCount')!.textContent = '';
  document.getElementById('qaHistorySection')?.classList.add('hidden');
  
  document.getElementById('generatedReplies')!.innerHTML = '';
  (document.getElementById('replyInput') as HTMLTextAreaElement)!.value = '';
  
  document.getElementById('mainContent')?.classList.add('hidden');
  document.getElementById('emptyState')?.classList.remove('hidden');
  
  console.log('[Echo-X] All content cleared');
}

export async function extractPost(): Promise<void> {
  clearAllContent();
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      updateDebug('', '错误', '无法获取当前页面');
      return;
    }
    
    const url = tab.url;
    if (!url.includes('/status/')) {
      updateDebug(url, '不是帖子页面', '请打开具体帖子');
      return;
    }
    
    updateDebug(url, '提取中...');
    lastExtractedUrl = url;
    
    if (!tab.id) {
      updateDebug(url, '错误', '无法获取标签页ID');
      return;
    }
    
    await injectAndExtract(tab.id, url);
  } catch (e: any) {
    updateDebug('', '异常', e.message);
  }
}

async function injectAndExtract(tabId: number, url: string): Promise<void> {
  try {
    updateDebug(url, '提取中...');
    
    // 尝试已注入的 content script
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_POST' });
      if (response?.success && response.data) {
        showPost(response.data);
        return;
      }
    } catch {
      console.log('[Echo-X] Injecting content script...');
    }
    
    // 动态注入
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['/content.js']
    });
    
    await new Promise(r => setTimeout(r, 100));
    
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_POST' });
    if (response?.success && response.data) {
      showPost(response.data);
    } else {
      updateDebug(url, '提取失败', response?.error || '未知错误');
    }
  } catch (e: any) {
    updateDebug(url, '执行失败', e.message);
  }
}

function setupUrlChangeListener(): void {
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active && tab.url?.includes('/status/')) {
      setTimeout(() => extractPost(), 500);
    }
  });
  
  chrome.tabs.onActivated.addListener(() => {
    setTimeout(() => extractPost(), 300);
  });
  
  setInterval(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('/status/') && tab.url !== lastExtractedUrl) {
        extractPost();
      }
    } catch {}
  }, 2000);
}

// === 帖子显示 ===

function showPost(data: any): void {
  console.log('[Echo-X] Showing post:', data);
  
  if (!data?.text) {
    updateDebug('', '错误', '没有文本内容');
    return;
  }
  
  currentPost = data;
  
  document.getElementById('emptyState')?.classList.add('hidden');
  document.getElementById('mainContent')?.classList.remove('hidden');
  
  // 原文
  const originalText = document.getElementById('originalText');
  if (originalText) {
    originalText.innerHTML = '';
    
    const typeLabel = document.createElement('div');
    typeLabel.style.cssText = 'font-size: 11px; color: var(--accent); margin-bottom: 8px; font-weight: 600;';
    typeLabel.textContent = data.isReply ? '💬 回复内容' : '📝 原帖内容';
    originalText.appendChild(typeLabel);
    
    const textSpan = document.createElement('span');
    textSpan.textContent = data.text;
    originalText.appendChild(textSpan);
  }
  
  // 作者
  const authorEl = document.getElementById('authorInfo');
  if (authorEl && data.author) {
    authorEl.textContent = (data.isReply ? '💬 @' : '📝 @') + data.author.handle;
  }
  
  updateDebug(data.author?.handle || '', '原文显示成功');
  
  // 加载历史
  loadQAHistory(data.url);
  document.getElementById('qaHistorySection')?.classList.remove('hidden');
  
  // 自动分析
  if (gatewayConnected) {
    if (!analyzer) {
      initAnalyzerAndAnalyze(data.text, data.url || '', data.isReply);
    } else {
      analyzeText(data.text, data.url || '', data.isReply);
    }
  }
}

// === AI 分析 ===

async function initAnalyzerAndAnalyze(text: string, url: string, isReply: boolean): Promise<void> {
  const saved = await chrome.storage.local.get(['apiModel']);
  const selectedModel = saved.apiModel || availableModels[0] || 'kimi-2.5-coding';
  analyzer = new TextAnalyzer('local', 'kimi', selectedModel);
  analyzeText(text, url, isReply);
}

async function analyzeText(text: string, url: string, isReply: boolean = false): Promise<void> {
  if (!analyzer || !gatewayConnected) {
    updateDebug('', '跳过分析', '本地网关未连接');
    return;
  }
  
  // 检查缓存
  if (!forceRefresh) {
    const cached = await getCachedAnalysis(text, isReply);
    if (cached) {
      const cachedResult = cached.result as AnalysisResult;
      if (cachedResult.detectedLanguage) {
        setDetectedLanguage(cachedResult.detectedLanguage);
      }
      renderAnalysis(cachedResult);
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
    
    if (result.detectedLanguage) {
      setDetectedLanguage(result.detectedLanguage);
    }
    
    renderAnalysis(result);
    
    const model = (await chrome.storage.local.get(['apiModel'])).apiModel || 'kimi-2.5-coding';
    await saveCachedAnalysis(text, url, result, model, isReply);
    
    updateDebug('', forceRefresh ? '✅ 分析完成 (强制刷新已保存到缓存)' : '✅ 分析完成');
    updateCacheStats();
  } catch (e: any) {
    if (e.message === 'ANALYSIS_ABORTED') {
      clearAnalysis();
      return;
    }
    updateDebug('', '❌ 分析失败', e.message);
    showAnalysisError(e.message);
  } finally {
    showAnalysisLoading(false);
    forceRefresh = false;
  }
}

// === 回复生成 ===

async function generateReply(): Promise<void> {
  if (!currentPost?.text) {
    updateDebug('', '错误', '没有帖子内容');
    return;
  }
  
  if (!analyzer || !gatewayConnected) {
    updateDebug('', '错误', '本地网关未连接');
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
  
  try {
    let result;
    
    if (mode === 'rewrite') {
      result = await analyzer.rewriteProofread(currentPost.text, inputEl.value);
    } else {
      result = await analyzer.answerQuestion(currentPost.text, inputEl.value, currentPost.author?.handle || 'author');
      
      await saveQARecord({
        postUrl: currentPost.url || window.location.href,
        postText: currentPost.text.substring(0, 200),
        question: inputEl.value,
        answer: result.answer,
        references: result.references,
        model: (await chrome.storage.local.get(['apiModel'])).apiModel || 'kimi-2.5-coding'
      });
      
      await loadQAHistory(currentPost.url);
      await updateQAStatsDisplay();
    }
    
    showGeneratedReply(result, mode);
    inputEl.value = '';
    updateDebug('', mode === 'rewrite' ? '✅ Proofread 完成' : '✅ 回答已生成');
  } catch (e: any) {
    updateDebug('', '生成失败', e.message);
  }
}
