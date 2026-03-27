# Echo-X 调试指南

## 常见问题：帖子提取失败

如果你在打开 X 帖子页面时，侧边栏显示"提取失败"或空白，请按以下步骤排查：

## 1. 检查 Content Script 是否加载

1. 打开 X 帖子页面 (如: https://x.com/thetimesoca/status/2037172195290423433)
2. 按 `F12` 打开 DevTools
3. 切换到 **Console** 标签
4. 查找日志 `[Echo-X] Content script loaded!`

**如果没有看到这个日志：**
- 检查扩展是否已启用：`edge://extensions/` 或 `chrome://extensions/`
- 尝试刷新页面
- 点击扩展图标，重新打开侧边栏

## 2. 检查提取日志

在 Console 中应该看到类似这样的日志：

```
[Echo-X] Received message: GET_CURRENT_POST
[Echo-X] extractCurrentPost called
[Echo-X] isValidPostPage: true https://x.com/thetimesoca/status/...
[Echo-X] Post ID: 2037172195290423433
[Echo-X] Finding main post...
[Echo-X] Found articles: 5
[Echo-X] Current URL: https://x.com/thetimesoca/status/...
[Echo-X] Found post by ID match: 2037172195290423433
[Echo-X] Parsing post data...
[Echo-X] Author: TimesOC @thetimesoca
[Echo-X] Found text via tweetText: After a months-long investigation...
[Echo-X] Extracted post: {id: "...", text: "...", ...}
[Echo-X] Sending response: {success: true, data: {...}}
```

## 3. 常见问题及解决方案

### 问题 A: "No articles found on page"

**原因**: X 页面结构改变或页面未完全加载

**解决**:
1. 等待页面完全加载后再点击扩展图标
2. 刷新页面后重试
3. 检查是否登录 X (有些内容需要登录)

### 问题 B: "Could not find main post"

**原因**: 无法识别哪个 article 是主帖

**解决**:
1. 确保你在帖子详情页 (URL 包含 `/status/`)
2. 尝试滚动到页面顶部
3. 检查 DevTools 中 `[Echo-X] Found articles:` 的数量

### 问题 C: "提取到空文本"

**原因**: 找到了帖子但文本内容为空

**解决**:
1. 在 Console 中查看 `[Echo-X] Found text via ...` 的日志
2. 如果没有任何文本相关的日志，可能是 X 的 DOM 结构改变
3. 尝试更新扩展到最新版本

### 问题 D: "Content script not loaded"

**原因**: 扩展 content script 没有注入到页面

**解决**:
1. 刷新页面
2. 重新加载扩展：
   - `edge://extensions/` → 找到 Echo-X → 点击刷新按钮
   - 或关闭再打开「开发人员模式」
3. 检查扩展权限是否完整

## 4. 手动测试提取

在 X 帖子页面的 Console 中执行：

```javascript
// 发送提取消息
chrome.runtime.sendMessage({ type: 'GET_CURRENT_POST' }, (response) => {
  console.log('Response:', response);
});
```

如果返回 `Could not establish connection`，说明 content script 没有加载。

## 5. 检查扩展权限

访问 `edge://extensions/`，找到 Echo-X，确认：
- ✅ 「允许访问文件网址」(可选)
- ✅ 网站访问权限包含 `x.com`

## 6. 完全重置

如果以上方法都无效：

1. 移除扩展：点击「删除」
2. 重新加载：`edge://extensions/` → 「加载解压缩的扩展」
3. 选择 `dist` 文件夹
4. 重新配置 API Key

## 7. 提交 Bug 报告

如果问题仍未解决，请收集以下信息提交 Issue：

1. **浏览器版本**: Edge/Chrome 版本号
2. **扩展版本**: `manifest.json` 中的 version
3. **页面 URL**: 出问题的 X 帖子链接
4. **Console 日志**: 完整的 Console 输出 (右键 → Save as...)
5. **页面结构**: 
   - 在 DevTools 的 Elements 标签
   - 搜索 `article` 元素
   - 截图或导出 HTML

## 8. 临时解决方案

如果急着使用，可以：

1. **手动复制文本**: 选中帖子文本 → 复制 → 粘贴到 AI 工具
2. **使用其他工具**: 截图后用 ChatGPT 的图像分析功能
3. **等待修复**: 关注 GitHub Issues 获取更新

---

## X 页面结构说明

Echo-X 通过以下方式识别帖子：

1. **URL 匹配**: 检查是否包含 `/status/数字`
2. **Article 元素**: 查找 `<article>` 标签
3. **Post ID**: 从 URL 提取数字 ID
4. **内容匹配**: 找包含该 ID 链接的 article
5. **文本提取**: 查找 `data-testid="tweetText"` 或使用 `lang` 属性

如果 X 改变了这些结构，扩展可能需要更新。
