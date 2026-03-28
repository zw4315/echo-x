# X 页面加载时间线详解

## 为什么 Content Script 注入会失败

### 时间线对比

```
传统方式 (Manifest V3 content_scripts):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

0ms     用户访问 x.com/status/123
        ↓
100ms   服务器返回 HTML (骨架屏)
        <div class="skeleton">Loading...</div>
        ↓
200ms   **Content Script 注入!** ⬅️ 问题在这里
        此时 DOM 只有骨架，没有真实内容
        ↓
500ms   下载 main.js (3MB)
        ↓
1s      React 开始运行 (Hydration)
        ↓
2s      React 请求 API 获取帖子数据
        ↓
3s      React 渲染真实内容到 DOM
        ↓
4s      页面完全可交互

结果：Content Script 只看到了骨架屏，没拿到真实数据！


Echo-X 方式 (chrome.scripting.executeScript):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

0ms     用户访问 x.com/status/123
        ↓
...     (等待页面完全加载，用户看帖子)
        ↓
10s     用户点击 Echo-X 图标 ⬅️ 用户触发
        ↓
10.1s   **执行脚本!** ⬅️ 此时 React 已完成
        DOM 已有真实内容
        ↓
10.2s   立即提取到数据

结果：成功拿到真实数据！
```

## 具体演示

### 失败的 Content Script

```javascript
// content.js - 在 manifest.json 中配置，自动注入
console.log('Content Script 运行');

const article = document.querySelector('article');
console.log(article?.textContent); 
// 输出: "Loading..." 或空字符串
// 因为这时 React 还没渲染真实内容
```

### 成功的直接执行

```javascript
// 用户点击按钮后执行
chrome.scripting.executeScript({
  func: () => {
    const article = document.querySelector('article');
    return article?.textContent;
  }
});
// 返回: "After a months-long investigation..."
// 因为这时页面已完全加载
```

## 核心区别

| 特性 | Manifest Content Script | scripting.executeScript |
|------|-------------------------|-------------------------|
| **触发时机** | 页面加载时自动 | 用户点击后手动 |
| **执行环境** | 隔离的 Content Script | 页面主环境 |
| **时机可控** | ❌ 无法控制 | ✅ 完全可控 |
| **等待页面** | ❌ 不等页面加载完 | ✅ 用户已看完 |

## 为什么 X 特别容易出现这个问题？

### 普通网站 (如 Wikipedia)

```
服务器返回完整 HTML → 浏览器渲染 → 完成
     ↓
Content Script 执行时能拿到完整内容 ✅
```

### X (React 应用)

```
服务器返回骨架 HTML → 下载 JS → 执行 React → 请求 API → 渲染内容
     ↓
Content Script 执行时只有骨架 ❌
```

## 另一个问题：端口未建立

### Content Script 通信流程

```
Content Script (页面)  ←─────→  Side Panel (侧边栏)
        ↓                           ↓
   自动注入                    用户点击打开
        ↓                           ↓
   尝试连接 ────────❌────────→ 还没准备好
```

**问题**：Content Script 在页面加载时就尝试连接，但 Side Panel 还没打开，连接失败。

### 直接执行流程

```
用户点击按钮
     ↓
Side Panel 已打开 ✅
     ↓
执行脚本到页面
     ↓
立即返回结果 ✅
```

## 代码对比

### 失败的方式

```javascript
// manifest.json
{
  "content_scripts": [{
    "matches": ["https://x.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle"  // 页面空闲时注入
  }]
}

// content.js - 自动运行
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const data = extractPost(); // 提取到空数据！
  sendResponse(data);
});
```

### 成功的方式

```javascript
// sidepanel.js - 用户点击后运行
async function extractPost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // 直接注入代码到页面执行
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      return document.querySelector('article')?.textContent; // 能拿到数据！
    }
  });
  
  return results[0].result;
}
```

## 一句话总结

> **Content Script 注入太早（页面还没准备好），而 executeScript 执行正好（用户点击时页面已完全加载）。**

就像你去餐厅：
- Content Script = 你 8:00 到店，但厨师还没来，你等到了空桌子
- executeScript = 你 10:00 到店（高峰期），厨师已在，立即上菜
