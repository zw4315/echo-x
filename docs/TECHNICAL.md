# Echo-X 技术实现原理

## 核心问题

为什么之前用传统方法（Content Script + Message Passing）一直失败，最后改用直接执行代码才成功？

## X.com 的特殊性

### 1. 动态加载机制

X.com 使用 **React 服务端渲染 (SSR)** + **客户端 hydration**：

```
1. 首次请求：服务器返回 HTML 骨架
2. JS 加载：下载并执行 main.js (约 3MB)
3. Hydration：React 接管，替换静态 HTML 为动态组件
4. 数据获取：通过 API 获取帖子数据，渲染真实内容
```

**问题**：Manifest V3 的 `content_scripts` 在 `document_idle` 触发时，React 可能还没完成 hydration。

### 2. 代码分割与懒加载

X 将代码分割成多个 chunk：
- `main.js` - 核心框架
- `bundle.Conversation.js` - 帖子详情页
- `bundle.UserProfile.js` - 用户主页

**问题**：当你打开帖子页面时，Conversation chunk 可能还没加载完，Content Script 就已经执行了。

### 3. 虚拟滚动与 DOM 复用

X 使用虚拟滚动技术：
- 只渲染视口内的帖子
- 滚动时复用 DOM 节点
- 帖子数据存储在 React 内部状态，不在 DOM 中

**问题**：`document.querySelector('article')` 可能找到的是上一个页面的缓存节点。

## 三种抓取方案对比

### 方案 A：传统 Content Script（Echo-X 最初版本）

```javascript
// manifest.json
"content_scripts": [{
  "matches": ["https://x.com/*"],
  "js": ["content.js"],
  "run_at": "document_idle"
}]

// content.js
const articles = document.querySelectorAll('article');
```

**失败原因**：
1. `document_idle` 触发时，X 的 JS 还没加载完
2. 找到的 `article` 可能是骨架屏，没有真实内容
3. Content Script 与 Side Panel 通信失败（端口未建立）

### 方案 B：等待 + 重试（x-thread-summarizer 使用）

```javascript
// 等待页面加载
await sleep(1000);

// 滚动加载更多
while (hasMore) {
  window.scrollBy(0, 1000);
  await sleep(500);
  extractPosts();
}
```

**优点**：
- 适用于线程提取（需要加载所有回复）
- 可以获取动态加载的内容

**缺点**：
- 慢（需要等待和滚动）
- 不可靠（网络慢时会超时）
- 用户能看到页面在滚动

### 方案 C：直接代码执行（Echo-X 最终方案）

```javascript
chrome.scripting.executeScript({
  target: { tabId },
  func: () => {
    // 代码直接在 X 页面执行
    const article = document.querySelector('article');
    return extractData(article);
  }
});
```

**为什么成功**：
1. **时机问题**：用户点击按钮时，页面已经完全加载
2. **上下文问题**：代码在 X 的 JS 环境中执行，可以访问 React 渲染后的 DOM
3. **通信问题**：不需要建立长连接，直接返回结果

## 与开源软件的比较

### x-thread-summarizer

| 特性 | x-thread-summarizer | Echo-X |
|------|---------------------|--------|
| 目标 | 提取完整线程（主帖+所有回复） | 提取单个帖子进行分析 |
| 方法 | 自动滚动 + DOM 提取 | 直接代码执行 |
| 等待策略 | 固定延迟 + 滚动触发 | 用户触发（保证已加载）|
| 深度控制 | 支持（1-5级回复） | 不需要 |
| 数据量 | 大（可能100+帖子） | 小（单个帖子）|
| 适用场景 | 备份完整讨论 | 学习语言、回复辅助 |

**x-thread-summarizer 的核心逻辑**：

```javascript
class ThreadExtractor {
  async startExtraction(maxDepth) {
    // 1. 找到根帖子
    this.extractRootPost();
    
    // 2. 循环滚动加载
    while (this.scrollAttempts < this.maxScrollAttempts) {
      // 点击"显示更多回复"
      await this.expandReplies();
      
      // 滚动加载
      await this.scrollPage();
      
      // 提取新出现的帖子
      this.extractVisiblePosts();
      
      // 检查是否完成
      if (this.extractedPosts.size >= this.targetReplyCount) {
        break;
      }
    }
    
    // 3. 构建树形结构
    return this.buildTree();
  }
}
```

**Echo-X 的核心逻辑**：

```javascript
async function extractPost() {
  // 直接执行，无需等待
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const article = document.querySelector('article');
      return {
        text: article.querySelector('[data-testid="tweetText"]')?.textContent,
        author: extractAuthor(article),
        // ...
      };
    }
  });
  
  return results[0].result;
}
```

### markdownload-extension-updated

| 特性 | MarkDownload | Echo-X |
|------|--------------|--------|
| 目标 | 将任意网页转为 Markdown | 提取 X 帖子用于学习 |
| 通用性 | 高（适用于任何网站） | 低（专门针对 X）|
| 提取方法 | Readability.js + Turndown | 专用 DOM 选择器 |
| 输出格式 | Markdown 文件 | 结构化数据（用于 AI 分析）|
| 交互性 | 静态导出 | 动态分析 + 回复生成 |

**MarkDownload 的核心逻辑**：

```javascript
// 1. 使用 Readability 提取正文
const article = new Readability(document).parse();

// 2. 使用 Turndown 转为 Markdown
const markdown = turndownService.turndown(article.content);

// 3. 下载文件
chrome.downloads.download({
  url: 'data:text/markdown,' + encodeURIComponent(markdown),
  filename: 'article.md'
});
```

**为什么 Echo-X 不用 Readability**：

1. **Readability 会过滤掉重要信息**
   - 作者信息、时间戳、互动数据被视为"元数据"
   - 对语言学习很重要

2. **Readability 不保留结构**
   - 推文中的换行、分段会丢失
   - 回复结构被扁平化

3. **X 的特殊 DOM 结构**
   - Readability 无法识别 `data-testid="tweetText"`
   - 会将整个页面当作一篇文章处理

## 技术选型总结

| 场景 | 推荐方案 | 理由 |
|------|----------|------|
| 备份完整 X 线程 | x-thread-summarizer | 需要滚动加载大量内容 |
| 任意网页转 Markdown | MarkDownload | 通用性强，不需要定制 |
| 学习 X 帖子 + AI 分析 | Echo-X | 精准提取，直接调用 AI |

## Echo-X 的独特之处

### 1. 直接代码执行模式

不依赖 Content Script 的自动注入，而是在用户触发时执行：

```
优势：
- 保证页面已完全加载
- 避免通信端口问题
- 代码可以即时修改（无需刷新扩展）
```

### 2. 最小权限原则

```json
{
  "permissions": [
    "activeTab",    // 只在活动时访问
    "scripting"     // 执行提取代码
  ],
  "host_permissions": [
    "https://x.com/*"
  ]
}
```

不需要 `storage` 以外的持久权限。

### 3. 错误处理策略

```javascript
try {
  // 尝试 Content Script 通信
  response = await chrome.tabs.sendMessage(...);
} catch (e) {
  if (e.message.includes('Could not establish connection')) {
    // 失败则降级为直接执行
    await injectAndExtract(...);
  }
}
```

### 4. 面向 AI 的数据结构

提取的数据直接适配 AI 分析：

```typescript
interface XPost {
  text: string;           // 原文
  author: {              // 作者信息
    handle: string;
    displayName: string;
  };
  // 不存储图片、视频等二进制数据
  // 减少 token 消耗
}
```

## 未来改进方向

### 1. 使用 PageScript（注入到页面 JS 环境）

```javascript
const script = document.createElement('script');
script.src = chrome.runtime.getURL('page-script.js');
document.head.appendChild(script);
```

可以访问 X 的 React 内部状态（通过 `__REACT__` 全局变量）。

### 2. 拦截 API 请求

使用 `declarativeNetRequest` 拦截 X 的 API：

```json
{
  "declarative_net_request": {
    "rule_resources": [{
      "id": "ruleset_1",
      "enabled": true,
      "path": "rules.json"
    }]
  }
}
```

直接从 API 响应获取数据，不依赖 DOM。

### 3. 使用 Chrome DevTools Protocol

对于高级用户，可以连接 CDP 直接调试 X：

```javascript
chrome.debugger.attach({ tabId }, '1.3');
chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
  expression: 'extractPost()'
});
```

但这需要 `debugger` 权限，用户会看到警告。

## 总结

Echo-X 的成功在于：

1. **放弃传统 Content Script 模式**，改用用户触发的直接执行
2. **专注 X 的 DOM 结构**，不使用通用提取库
3. **保持极简**，只做一件事（提取单个帖子）并做好

失败教会我们：浏览器扩展的 "最佳实践" 不一定适用于现代 SPA（单页应用），有时候需要打破常规。
