// Echo-X Content Script - X.com 内容提取器
// 支持提取原帖和回复

console.log('[Echo-X] Content script loaded!');

// 从 URL 提取帖子 ID
function extractPostId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

// 检查是否是有效的帖子页面
function isValidPostPage(): boolean {
  const url = window.location.href;
  return url.includes('/status/') || 
         (url.includes('x.com') && url.includes('/status/')) ||
         url.includes('/status/');
}

// 判断是否是回复页面
function isReplyUrl(): boolean {
  return false; // 简化处理，每个 status 页面都是独立的
}

// 获取目标推文
function getTargetTweet(): { element: Element | null; isReply: boolean } {
  const articles = document.querySelectorAll('article');
  
  if (articles.length === 0) {
    return { element: null, isReply: false };
  }
  
  // 从 URL 获取当前 status ID
  const currentUrl = window.location.href;
  const statusId = extractPostId(currentUrl);
  
  if (!statusId) {
    console.log('[Echo-X] Cannot extract status ID from URL, using first article');
    return { element: articles[0], isReply: false };
  }
  
  // 遍历所有 article，找到包含当前 status ID 链接的那个
  for (const article of articles) {
    const links = article.querySelectorAll('a[href*="/status/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.includes(statusId)) {
        // 判断是否是回复
        const replyIndicator = article.querySelector('[data-testid="tweetReplyContext"]') ||
                               document.querySelector('[data-testid="tweetReplyContext"]');
        const isReply = !!replyIndicator;
        
        console.log('[Echo-X] Found matching article for status ID:', statusId, 'isReply:', isReply);
        return { element: article, isReply };
      }
    }
  }
  
  // 如果没有找到匹配的 article，回退到第一个
  console.log('[Echo-X] No matching article found for status ID:', statusId, 'using first article');
  
  const replyIndicator = document.querySelector('[data-testid="tweetReplyContext"], [aria-label*="回复"]');
  const isReply = !!replyIndicator;
  
  return { element: articles[0], isReply };
}

// 提取推文数据
function extractTweetData(article: Element): { author: { handle: string; displayName: string }; timestamp: string; text: string } | null {
  try {
    // 提取作者信息
    const authorLink = article.querySelector('a[role="link"][href^="/"]') as HTMLAnchorElement | null;
    const href = authorLink?.getAttribute('href') || '';
    const handle = href.split('/').pop() || '';
    
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
      return null;
    }
    
    return {
      author: { handle, displayName },
      timestamp,
      text: text.trim()
    };
  } catch (e) {
    console.error('[Echo-X] Error extracting tweet data:', e);
    return null;
  }
}

// 提取当前帖子
async function extractCurrentPost(): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log('[Echo-X] extractCurrentPost called');
  
  if (!isValidPostPage()) {
    return {
      success: false,
      error: 'Not on a valid X.com post page'
    };
  }
  
  try {
    const url = window.location.href;
    const postId = extractPostId(url);
    
    const { element: targetTweet, isReply } = getTargetTweet();
    
    if (!targetTweet) {
      return {
        success: false,
        error: 'No tweet found on page'
      };
    }
    
    const tweetData = extractTweetData(targetTweet);
    
    if (!tweetData) {
      return {
        success: false,
        error: 'Could not extract tweet data'
      };
    }
    
    return {
      success: true,
      data: {
        id: postId,
        url,
        isReply,
        ...tweetData
      }
    };
  } catch (error) {
    console.error('[Echo-X] Extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 监听来自 side panel 的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Echo-X] Received message:', message.type);
  
  if (message.type === 'GET_CURRENT_POST') {
    extractCurrentPost().then(result => {
      sendResponse(result);
    });
    return true; // 保持消息通道打开
  }
  
  return false;
});

// 监听 URL 变化
let currentUrl = window.location.href;
new MutationObserver(() => {
  const url = window.location.href;
  if (url !== currentUrl) {
    console.log('[Echo-X] URL changed:', currentUrl, '->', url);
    currentUrl = url;
  }
}).observe(document, { subtree: true, childList: true });

// 同时监听 popstate 事件
window.addEventListener('popstate', () => {
  console.log('[Echo-X] URL changed via popstate:', window.location.href);
  currentUrl = window.location.href;
});

console.log('[Echo-X] Content script initialization complete');
