// Echo-X Content Script - X.com 内容提取器
// 参考 x-thread-summarizer 的实现方式，纯 DOM 提取

import type { XPost, Metrics, MediaItem, ExtractionResult } from './types/index.js';

console.log('[Echo-X] Content script loaded!');

class XPostExtractor {
  private currentPost: XPost | null = null;

  /**
   * 检查是否在有效的帖子页面
   */
  isValidPostPage(): boolean {
    const url = window.location.href;
    return (url.includes('x.com/') || url.includes('twitter.com/')) && 
           url.includes('/status/');
  }

  /**
   * 从 URL 提取帖子 ID
   */
  extractPostId(url: string): string | null {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * 等待元素出现
   */
  async waitForElement(selector: string, timeout: number = 5000): Promise<Element | null> {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * 提取当前帖子
   */
  async extractCurrentPost(): Promise<ExtractionResult> {
    console.log('[Echo-X] extractCurrentPost called');
    
    if (!this.isValidPostPage()) {
      return {
        success: false,
        error: 'Not on a valid X.com post page'
      };
    }

    try {
      const url = window.location.href;
      const postId = this.extractPostId(url);
      console.log('[Echo-X] Post ID:', postId);
      
      // 等待页面加载完成 - 关键！
      console.log('[Echo-X] Waiting for article...');
      const article = await this.waitForElement('article', 3000);
      
      if (!article) {
        console.error('[Echo-X] No article found after waiting');
        return {
          success: false,
          error: 'Page not loaded yet, please wait and retry'
        };
      }

      const mainPost = this.extractPostData(article);
      
      if (!mainPost) {
        console.error('[Echo-X] Could not extract post data');
        return {
          success: false,
          error: 'Could not extract post data from page'
        };
      }

      this.currentPost = {
        id: postId || undefined,
        url: url,
        ...mainPost
      };

      console.log('[Echo-X] Extracted post:', this.currentPost);

      return {
        success: true,
        data: this.currentPost
      };
    } catch (error) {
      console.error('[Echo-X] Extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 从 article 元素提取帖子数据
   * 参考 x-thread-summarizer 的实现
   */
  private extractPostData(article: Element): XPost | null {
    try {
      console.log('[Echo-X] Parsing article...');

      // 检测是否是 X Article (长文)
      const isArticle = article.querySelector('h1, h2, [role="heading"]') && 
                        !article.querySelector('[data-testid="tweetText"]');
      console.log('[Echo-X] Is long article:', isArticle);

      // 从时间元素获取 permalink - x-thread-summarizer 的方法
      const timeElement = article.querySelector('time');
      const linkElement = timeElement?.closest('a');
      const permalink = linkElement?.getAttribute('href') || window.location.href;
      console.log('[Echo-X] Permalink:', permalink);

      // 提取作者信息 - x-thread-summarizer 的方法
      const authorLink = article.querySelector('a[role="link"][href^="/"]') as HTMLAnchorElement | null;
      const href = authorLink?.getAttribute('href') || '';
      const handle = href.split('/').pop() || '';
      
      // 显示名称 - 从 [dir="ltr"] span 获取
      const displayNameElement = article.querySelector('[dir="ltr"] span');
      const displayName = displayNameElement?.textContent || handle;
      console.log('[Echo-X] Author:', displayName, '@' + handle);

      // 提取时间戳
      const timestamp = timeElement?.getAttribute('datetime') || new Date().toISOString();

      // 提取文本内容 - x-thread-summarizer 的方法
      let text = '';
      
      if (isArticle) {
        // X Article 长文处理
        console.log('[Echo-X] Extracting article text...');
        const titleEl = article.querySelector('[data-testid="twitter-article-title"]') || 
                      article.querySelector('h1, h2, [role="heading"]');
        const title = titleEl?.textContent?.trim() || '';
        
        const bodyContainer = article.querySelector('[data-testid="longformRichTextComponent"]');
        let paragraphs: string[] = [];
        
        if (bodyContainer) {
          paragraphs = Array.from(bodyContainer.querySelectorAll('div, p'))
            .filter(el => {
              if (el.querySelector('p')) return false;
              return el.textContent?.trim().length || 0 > 0;
            })
            .map(el => el.textContent?.trim() || '');
        } else {
          paragraphs = Array.from(article.querySelectorAll('div, p'))
            .filter(el => {
              if (el.closest('[role="group"]') || el.closest('[data-testid="group"]')) return false;
              if (el.getAttribute('aria-hidden') === 'true') return false;
              if (el.tagName.startsWith('H') || el.getAttribute('role') === 'heading') return false;
              return true;
            })
            .map(el => el.textContent?.trim() || '')
            .filter(t => t.length > 20);
        }
        
        const uniqueParagraphs = [...new Set(paragraphs)];
        text = title ? `# ${title}\n\n` : '';
        text += uniqueParagraphs.join('\n\n');
        console.log('[Echo-X] Article text length:', text.length);
      } else {
        // 普通推文 - 标准方法
        const textContainer = article.querySelector('[data-testid="tweetText"]');
        if (textContainer) {
          text = textContainer.textContent || '';
          console.log('[Echo-X] Tweet text found:', text.substring(0, 100));
        } else {
          // 备用方法：找 lang 属性的 div
          const langDiv = article.querySelector('div[lang]');
          if (langDiv) {
            text = langDiv.textContent || '';
            console.log('[Echo-X] Text from lang div:', text.substring(0, 100));
          }
        }
      }

      // 提取图片
      const images: MediaItem[] = [];
      const imgElements = article.querySelectorAll('[data-testid="tweetPhoto"] img');
      imgElements.forEach(img => {
        const src = (img as HTMLImageElement).src;
        if (src) {
          images.push({
            type: 'image',
            url: src,
            alt: (img as HTMLImageElement).alt || ''
          });
        }
      });
      console.log('[Echo-X] Found images:', images.length);

      // 提取互动数据 - x-thread-summarizer 的方法
      const metrics: Metrics = { replies: 0, reposts: 0, likes: 0 };

      const replyBtn = article.querySelector('[data-testid="reply"]');
      const retweetBtn = article.querySelector('[data-testid="retweet"], [data-testid="unretweet"]');
      const likeBtn = article.querySelector('[data-testid="like"], [data-testid="unlike"]');

      if (replyBtn) {
        metrics.replies = this.parseMetricValue(
          replyBtn.textContent || replyBtn.getAttribute('aria-label') || ''
        );
      }
      if (retweetBtn) {
        metrics.reposts = this.parseMetricValue(
          retweetBtn.textContent || retweetBtn.getAttribute('aria-label') || ''
        );
      }
      if (likeBtn) {
        metrics.likes = this.parseMetricValue(
          likeBtn.textContent || likeBtn.getAttribute('aria-label') || ''
        );
      }

      // 如果都是 0，尝试从 role="group" 获取
      if (metrics.replies === 0 && metrics.reposts === 0 && metrics.likes === 0) {
        const metricsContainer = article.querySelector('[role="group"]');
        if (metricsContainer) {
          const buttons = metricsContainer.querySelectorAll('[role="button"], a[role="link"]');
          buttons.forEach((button) => {
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            const testId = button.getAttribute('data-testid');
            const val = this.parseMetricValue(button.textContent || ariaLabel);

            if (testId === 'reply' || ariaLabel.includes('repl')) metrics.replies = val;
            else if (testId?.includes('retweet') || testId?.includes('repost') || ariaLabel.includes('repost')) {
              metrics.reposts = val;
            }
            else if (testId === 'like' || ariaLabel.includes('like')) metrics.likes = val;
          });
        }
      }
      console.log('[Echo-X] Metrics:', metrics);

      return {
        author: {
          handle: handle.replace('@', ''),
          displayName: displayName.replace('@', ''),
          profileUrl: `https://x.com/${handle.replace('@', '')}`
        },
        timestamp,
        text: text.trim(),
        images,
        videos: [],
        metrics
      };
    } catch (error) {
      console.error('[Echo-X] Error extracting post data:', error);
      return null;
    }
  }

  /**
   * 解析数字（处理 k, m, 万 等后缀）
   * x-thread-summarizer 的方法
   */
  private parseMetricValue(text: string): number {
    if (!text) return 0;
    
    const cleaned = text.trim().toLowerCase();
    let multiplier = 1;
    
    if (cleaned.includes('k') || cleaned.endsWith('t')) multiplier = 1000;
    else if (cleaned.includes('m')) multiplier = 1000000;
    else if (cleaned.includes('万')) multiplier = 10000;
    
    let numStr = cleaned.replace(/[^\d,.]/g, '');
    
    if (multiplier > 1) {
      numStr = numStr.replace(',', '.');
      const val = parseFloat(numStr);
      return isNaN(val) ? 0 : Math.round(val * multiplier);
    } else {
      numStr = numStr.replace(/[,.]/g, '');
      return parseInt(numStr, 10) || 0;
    }
  }
}

// 初始化提取器
const extractor = new XPostExtractor();

// 监听来自 side panel 的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Echo-X] Received message:', message.type);

  switch (message.type) {
    case 'GET_CURRENT_POST':
      // 使用异步处理
      extractor.extractCurrentPost().then(result => {
        console.log('[Echo-X] Sending response:', result);
        sendResponse(result);
      });
      return true; // 保持通道开放以进行异步响应

    case 'FILL_REPLY':
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

    default:
      return false;
  }
});
