# Echo-X 产品需求文档

## 项目概述

**Echo-X** 是一个浏览器扩展，用于将 X (Twitter) 平台上的帖子、线程、文章保存为 Markdown、JSON 或纯文本格式。结合两个开源项目的优点，提供优雅的提取和导出体验。

## 参考项目

1. **x-thread-summarizer** - 提供 X 线程提取的核心逻辑和深度遍历能力
2. **MarkSnip (markdownload-extension-updated)** - 提供 Markdown 转换、UI 设计和导出功能

## 核心功能

### 1. 内容提取
- **单帖子提取**: 提取当前浏览的单个帖子
- **线程提取**: 提取主帖及其所有回复（支持深度控制）
- **文章提取**: 支持 X Articles (长文) 的提取
- **媒体检测**: 识别帖子中的图片和视频

### 2. 导出格式
- **Markdown**: 干净的 Markdown 格式，包含元数据（作者、时间、点赞数等）
- **JSON**: 结构化数据，包含完整的帖子和线程信息
- **纯文本**: 简洁的文本格式，便于阅读

### 3. 用户界面
- **Popup 弹出窗口**: 主要交互界面
- **实时预览**: 编辑和预览 Markdown 内容
- **进度显示**: 线程提取时显示实时进度
- **一键复制/下载**: 快速保存内容

### 4. 智能功能
- **自动滚动加载**: 自动展开和加载线程回复
- **深度控制**: 设置提取的最大回复深度 (1-5)
- **去重机制**: 避免重复提取相同内容
- **增量更新**: 支持对已提取线程的增量更新

## 技术架构

### 文件结构
```
echo-x/
├── manifest.json          # 扩展配置 (MV3)
├── background.js          # Service Worker
├── content.js             # 内容脚本 (X.com 页面)
├── popup.html             # 弹出窗口 HTML
├── popup.js               # 弹出窗口逻辑
├── popup.css              # 弹出窗口样式
├── icons/                 # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/                  # 文档
    └── README.md
```

### 权限需求
- `activeTab`: 访问当前标签页
- `storage`: 本地存储设置
- `scripting`: 脚本注入
- `clipboardWrite`: 写入剪贴板
- `downloads`: 文件下载
- `host_permissions`: `https://x.com/*`, `https://twitter.com/*`

### 数据流
```
User Action → Popup → Background → Content Script (X.com)
                                       ↓
                                Extract Data
                                       ↓
Content Script → Background → Popup → Display/Export
```

## UI 设计

### 主题
- 深色/浅色主题支持
- X.com 风格配色 (黑色、白色、蓝色强调色)
- 简洁现代的界面设计

### 主要界面元素
1. **顶部栏**: 标题、设置按钮
2. **模式选择**: 单帖子 / 线程 / 文章
3. **内容预览区**: Markdown 编辑器/预览
4. **操作按钮**: 复制、下载、发送到 Obsidian
5. **状态栏**: 提取进度、统计信息

## 数据 Schema

### 帖子数据结构
```json
{
  "schemaVersion": "1.0",
  "source": {
    "platform": "x.com",
    "url": "https://x.com/user/status/123",
    "extractedAt": "2025-01-07T...",
    "mode": "single|thread|article"
  },
  "post": {
    "id": "123",
    "url": "https://x.com/user/status/123",
    "author": {
      "handle": "username",
      "displayName": "User Name",
      "profileUrl": "https://x.com/username"
    },
    "timestamp": "2025-01-07T...",
    "text": "帖子正文内容",
    "metrics": {
      "replies": 10,
      "reposts": 25,
      "likes": 100
    },
    "media": [
      {
        "type": "image|video",
        "url": "https://...",
        "alt": "描述文本"
      }
    ]
  },
  "thread": {
    "replies": [
      {
        "id": "456",
        "parentId": "123",
        "depth": 1,
        // ... 同上
      }
    ]
  },
  "stats": {
    "totalPosts": 50,
    "maxDepth": 3
  }
}
```

## 导出模板

### Markdown 模板示例
```markdown
# X Post by @username

**Author:** [User Name](https://x.com/username)  
**Date:** 2025-01-07  
**URL:** https://x.com/user/status/123  
**Metrics:** 💬 10 | 🔁 25 | ❤️ 100

---

帖子正文内容...

---

*Extracted with Echo-X*
```

## 开发计划

### Phase 1: MVP
- [x] 基础架构搭建
- [x] 单帖子提取
- [x] Markdown 导出
- [x] Popup UI

### Phase 2: 增强功能
- [ ] 线程提取
- [ ] JSON 导出
- [ ] 图片下载
- [ ] 设置页面

### Phase 3: 高级功能
- [ ] Obsidian 集成
- [ ] 批量处理
- [ ] 快捷键支持
- [ ] 模板自定义

## 浏览器兼容性
- Chrome (Manifest V3)
- Edge (Manifest V3)
- Firefox (Manifest V2/V3)

## 注意事项
- 遵守 X.com 的使用条款
- 不收集用户数据
- 所有处理在本地完成
- 尊重隐私设置和可见性限制
