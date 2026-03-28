// Echo-X Content Script - X.com 内容提取器
// 支持提取原帖和回复

console.log('[Echo-X] Content script loaded!');

// 跟踪用户最后交互的推文
let lastInteractedTweet: Element | null = null;

// 跟踪当前页面 URL
let currentUrl = window.location.href;

// 监听 URL 变化（处理点击回复后的页面跳转）
function observeUrlChanges() {
  // 使用 MutationObserver 监听 URL 变化
  const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      console.log('[Echo-X] URL changed:', currentUrl, '->', window.location.href);
      currentUrl = window.location.href;
      lastInteractedTweet = null; // 重置，因为页面已变化
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // 同时监听 popstate 事件（浏览器前进/后退）
  window.addEventListener('popstate', () => {
    console.log('[Echo-X] URL changed via popstate:', window.location.href);
    currentUrl = window.location.href;
    lastInteractedTweet = null;
  });
}

// 启动 URL 监听
observeUrlChanges();

// 监听点击事件，记录用户点击的推文
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  
  // 查找点击位置最近的 article（推文）
  const article = target.closest('article');
  if (article) {
    lastInteractedTweet = article;
    console.log('[Echo-X] User clicked on tweet:', article);
  }
}, true);

// 监听输入框聚焦，记录用户正在回复的推文
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLElement;
  
  // 检查是否是回复输入框
  const isReplyBox = target.matches('[data-testid="tweetTextarea_0"]') ||
                     target.closest('[data-testid="tweetTextarea_0"]');
  
  if (isReplyBox) {
    // 找到这个回复对应的推文
    // X.com 的结构：回复框通常在推文下方的某个位置
    // 我们需要向上查找最近的 article，或者在页面中找到对应的推文
    const replyContainer = target.closest('div[role="dialog"]') || 
                          target.closest('div[data-testid="cellInnerDiv"]');
    
    if (replyContainer) {
      // 在回复容器中查找推文
      const article = replyContainer.querySelector('article');
      if (article) {
        lastInteractedTweet = article;
        console.log('[Echo-X] User focusing reply box for tweet:', article);
      }
    }
  }
});

/**
 * 检查是否在有效的帖子页面
 */
function isValidPostPage(): boolean {
  const url = window.location.href;
  return (url.includes('x.com/') || url.includes('twitter.com/')) && 
         url.includes('/status/');
}

/**
 * 从 URL 提取帖子 ID
 */
function extractPostId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * 提取推文数据
 */
function extractTweetData(article: Element): any {
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

/**
 * 判断当前 URL 是否是回复页面
 * 在 X 上，点击回复后 URL 会变成回复的独立链接
 */
function isReplyUrl(): boolean {
  // const url = window.location.href;
  // 如果是 status 页面且不是原帖作者的链接，则是回复
  // 或者简单判断：有多个 article 时第一个可能是原帖，后续是回复
  // 但更准确的是：URL 中的 status ID 对应的推文
  return false; // 简化处理，因为每个 status 页面都是独立的
}

/**
 * 获取当前应该提取的推文
 * 通过 URL 中的 status ID 匹配正确的 article
 */
function getTargetTweet(): { element: Element | null; isReply: boolean } {
  const articles = document.querySelectorAll('article');
  
  if (articles.length === 0) {
    return { element: null, isReply: false };
  }
  
  // 从 URL 获取当前 status ID
  const currentUrl = window.location.href;
  const statusId = extractPostId(currentUrl);
  
  if (!statusId) {
    // 如果无法提取 status ID，回退到第一个 article
    console.log('[Echo-X] Cannot extract status ID from URL, using first article');
    return { element: articles[0], isReply: false };
  }
  
  // 遍历所有 article，找到包含当前 status ID 链接的那个
  for (const article of articles) {
    // 查找 article 中是否有链接包含当前 status ID
    const links = article.querySelectorAll('a[href*="/status/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.includes(statusId)) {
        // 找到了匹配的 article
        // 判断是否是回复：检查是否有"回复给"的提示，或者检查页面结构
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
  
  // 判断是否是回复：检查页面中是否有"回复给"的提示
  const replyIndicator = document.querySelector('[data-testid="tweetReplyContext"], [aria-label*="回复"]');
  const isReply = !!replyIndicator;
  
  return { element: articles[0], isReply };
}

/**
 * 提取当前推文
 */
async function extractCurrentPost(): Promise<any> {
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
    return true;
  }
  
  if (message.type === 'FILL_REPLY') {
    try {
      const replyBox = document.querySelector('[data-testid="tweetTextarea_0"]') as HTMLElement | null;
      if (replyBox) {
        replyBox.focus();
        navigator.clipboard.writeText(message.text as string).then(() => {
          document.execCommand('paste');
        });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Reply box not found' });
      }
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    return true;
  }
  
  return false;
});
