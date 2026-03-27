// Echo-X Content Script - 提取 X 帖子内容

console.log('[Echo-X] Content script loaded!');

class XPostExtractor {
  constructor() {
    this.currentPost = null;
  }

  // 检查是否在有效的帖子页面
  isValidPostPage() {
    const url = window.location.href;
    return (url.includes('x.com/') || url.includes('twitter.com/')) && 
           url.includes('/status/');
  }

  // 从 URL 提取帖子 ID
  extractPostId(url) {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  // 提取当前帖子
  extractCurrentPost() {
    if (!this.isValidPostPage()) {
      return {
        success: false,
        error: 'Not on a valid X.com post page'
      };
    }

    try {
      const url = window.location.href;
      const postId = this.extractPostId(url);
      
      // 尝试找到主帖子（通常在 main 区域或第一个 article）
      const mainPost = this.findMainPost();
      
      if (!mainPost) {
        return {
          success: false,
          error: 'Could not find main post on page'
        };
      }

      this.currentPost = {
        id: postId,
        url: url,
        ...mainPost
      };

      return {
        success: true,
        data: this.currentPost
      };
    } catch (error) {
      console.error('[Echo-X] Extraction error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 找到主帖子
  findMainPost() {
    // 策略 1: 找包含当前 URL 的 article
    const articles = document.querySelectorAll('article');
    const url = window.location.href;
    
    for (const article of articles) {
      const links = article.querySelectorAll('a[href*="/status/"]');
      for (const link of links) {
        if (link.href === url || link.href.includes(`/status/${this.extractPostId(url)}`)) {
          return this.parsePostData(article);
        }
      }
    }

    // 策略 2: 找第一个包含 tweetText 的 article
    for (const article of articles) {
      const textEl = article.querySelector('[data-testid="tweetText"]');
      if (textEl) {
        return this.parsePostData(article);
      }
    }

    // 策略 3: 返回第一个 article
    if (articles.length > 0) {
      return this.parsePostData(articles[0]);
    }

    return null;
  }

  // 解析帖子数据
  parsePostData(article) {
    // 提取作者信息
    const authorLink = article.querySelector('a[role="link"][href^="/"]');
    const handle = authorLink?.getAttribute('href')?.split('/').pop() || '';
    
    // 显示名称
    const displayNameEl = article.querySelector('[data-testid="User-Name"] a span');
    const displayName = displayNameEl?.textContent || handle;

    // 提取时间
    const timeEl = article.querySelector('time');
    const timestamp = timeEl?.getAttribute('datetime') || new Date().toISOString();

    // 提取文本内容
    let text = '';
    const textContainer = article.querySelector('[data-testid="tweetText"]');
    if (textContainer) {
      text = textContainer.textContent || '';
    } else {
      // 尝试从 article 中提取纯文本
      text = article.textContent || '';
    }

    // 提取图片
    const images = [];
    const imgElements = article.querySelectorAll('[data-testid="tweetPhoto"] img');
    imgElements.forEach(img => {
      if (img.src) {
        images.push({
          type: 'image',
          url: img.src,
          alt: img.alt || ''
        });
      }
    });

    // 提取视频
    const videos = [];
    const videoElements = article.querySelectorAll('[data-testid="videoPlayer"] video, [data-testid="videoComponent"] video');
    videoElements.forEach(video => {
      if (video.src || video.querySelector('source')) {
        videos.push({
          type: 'video',
          url: video.src || video.querySelector('source')?.src
        });
      }
    });

    // 提取互动数据
    const metrics = { replies: 0, reposts: 0, likes: 0 };
    
    const replyBtn = article.querySelector('[data-testid="reply"]');
    const retweetBtn = article.querySelector('[data-testid="retweet"], [data-testid="unretweet"]');
    const likeBtn = article.querySelector('[data-testid="like"], [data-testid="unlike"]');

    if (replyBtn) {
      const text = replyBtn.textContent || replyBtn.getAttribute('aria-label') || '';
      metrics.replies = this.parseNumber(text);
    }
    if (retweetBtn) {
      const text = retweetBtn.textContent || retweetBtn.getAttribute('aria-label') || '';
      metrics.reposts = this.parseNumber(text);
    }
    if (likeBtn) {
      const text = likeBtn.textContent || likeBtn.getAttribute('aria-label') || '';
      metrics.likes = this.parseNumber(text);
    }

    return {
      author: {
        handle: handle.replace('@', ''),
        displayName: displayName.replace('@', ''),
        profileUrl: `https://x.com/${handle.replace('@', '')}`
      },
      timestamp,
      text: text.trim(),
      images,
      videos,
      metrics
    };
  }

  // 解析数字（处理 k, m 等后缀）
  parseNumber(text) {
    if (!text) return 0;
    
    const cleaned = text.toLowerCase().replace(/[^\d.km]/g, '');
    if (cleaned.includes('k')) {
      return parseFloat(cleaned.replace('k', '')) * 1000;
    } else if (cleaned.includes('m')) {
      return parseFloat(cleaned.replace('m', '')) * 1000000;
    }
    return parseInt(cleaned, 10) || 0;
  }
}

// 初始化提取器
const extractor = new XPostExtractor();

// 监听来自 side panel 的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Echo-X] Received message:', message.type);

  if (message.type === 'GET_CURRENT_POST') {
    const result = extractor.extractCurrentPost();
    sendResponse(result);
    return true;
  } else if (message.type === 'ANALYZE_POST') {
    const result = extractor.extractCurrentPost();
    if (result.success) {
      // 发送提取到的帖子数据
      chrome.runtime.sendMessage({
        type: 'POST_EXTRACTED',
        data: result.data
      });
    }
    sendResponse(result);
    return true;
  }

  return false;
});
