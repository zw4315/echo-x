// Echo-X 简化版 - 能工作的版本

console.log('[Echo-X] Starting...');

// 全局状态
let currentPost: any = null;

// 更新调试信息
function updateDebug(url: string, status: string, error?: string) {
  const urlEl = document.getElementById('debugUrl');
  const statusEl = document.getElementById('debugStatus');
  const errorEl = document.getElementById('debugError');
  
  if (urlEl) urlEl.textContent = 'URL: ' + (url || '-') + '\n时间: ' + new Date().toLocaleTimeString();
  if (statusEl) statusEl.textContent = '状态: ' + status;
  if (errorEl) errorEl.textContent = error ? '错误: ' + error : '';
  
  console.log('[Echo-X Debug]', { url, status, error });
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
  
  // 填充文本
  const originalText = document.getElementById('originalText');
  if (originalText) originalText.textContent = data.text;
  
  updateDebug(data.author?.displayName || '', '显示成功');
  
  // 如果有 API Key，调用 AI 分析
  chrome.storage.local.get(['apiKey'], (result) => {
    if (result.apiKey) {
      analyzePost(data.text);
    }
  });
}

// AI 分析
async function analyzePost(text: string) {
  updateDebug('', 'AI 分析中...');
  
  try {
    const result = await chrome.storage.local.get(['apiKey', 'apiModel']);
    if (!result.apiKey) {
      updateDebug('', '跳过分析', '没有 API Key');
      return;
    }
    
    // 显示加载状态
    const translationText = document.getElementById('translationText');
    if (translationText) translationText.textContent = '翻译中...';
    
    // 这里可以调用 AI API
    // 简化版先跳过
    updateDebug('', '分析完成（简化版跳过AI）');
    
  } catch (e) {
    updateDebug('', '分析失败', (e as Error).message);
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
    updateDebug(url.substring(0, 50), '检查URL...');
    
    // 检查是否是 X 帖子页面
    if (!url.includes('/status/')) {
      updateDebug(url, '不是帖子页面', '请打开具体帖子');
      return;
    }
    
    if (!tab.id) {
      updateDebug(url, '错误', '无法获取标签页ID');
      return;
    }
    
    // 发送消息到 content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_POST' });
      console.log('[Echo-X] Response:', response);
      
      if (response && response.success && response.data) {
        showPost(response.data);
      } else {
        updateDebug(url, '提取失败', response?.error || '未知错误');
      }
    } catch (sendErr: any) {
      // Content script 可能未加载，直接执行
      if (sendErr.message?.includes('Could not establish connection')) {
        updateDebug(url, 'Content Script 未加载', '直接执行提取...');
        await injectAndExtract(tab.id, url);
      } else {
        updateDebug(url, '发送失败', sendErr.message);
      }
    }
  } catch (e: any) {
    updateDebug('', '异常', e.message);
  }
}

// 直接执行提取代码
async function injectAndExtract(tabId: number, url: string) {
  try {
    updateDebug(url, '直接执行提取代码...');
    
    // 直接在页面中执行提取逻辑
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // 内联的提取逻辑
        try {
          const articles = document.querySelectorAll('article');
          if (articles.length === 0) {
            return { success: false, error: 'No articles found' };
          }
          
          const article = articles[0];
          
          // 提取作者
          const authorLink = article.querySelector('a[role="link"][href^="/"]') as HTMLAnchorElement | null;
          const handle = authorLink?.getAttribute('href')?.split('/').pop() || 'unknown';
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

// 绑定按钮
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Echo-X] DOM ready');
  updateDebug('', '已就绪，等待操作');
  
  // 刷新按钮
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', extractPost);
  }
  
  // 强制注入按钮
  const forceInjectBtn = document.getElementById('forceInjectBtn');
  if (forceInjectBtn) {
    forceInjectBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab?.url) {
        await injectAndExtract(tab.id, tab.url);
      }
    });
  }
  
  // 复制按钮
  const copyBtn = document.getElementById('copyOriginalBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (currentPost?.text) {
        navigator.clipboard.writeText(currentPost.text);
        updateDebug('', '已复制到剪贴板');
      }
    });
  }
  
  // 页面切换时自动提取
  chrome.tabs.onActivated.addListener(extractPost);
  
  console.log('[Echo-X] Ready');
});
