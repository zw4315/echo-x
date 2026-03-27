# Echo-X MVP

🚀 **在 X (Twitter) 上学习语言的最小可用版本**

> 提取 X 帖子 → AI 分析翻译 → 智能回复助手

## 功能

| 功能 | 状态 |
|------|------|
| 📖 原文提取 | ✅ |
| 🇨🇳 中文翻译 | ✅ |
| ✂️ 分词展示 | ✅ |
| 📚 生词提取 | ✅ |
| 📖 语法要点 | ✅ |
| 💬 例句场景 | ✅ |
| 💭 回复助手 | ✅ |
| 🔧 设置面板 | ✅ |

## 技术栈

- **语言**: TypeScript 5.3+
- **架构**: Chrome Extension Manifest V3
- **样式**: 原生 CSS3
- **AI**: OpenAI API / Kimi API

## 快速开始

### 方式 1: 直接下载 (推荐用户)

1. 下载 [最新 Release](../../releases)
2. 解压到本地文件夹
3. 打开 `chrome://extensions/`
4. 开启「开发者模式」
5. 点击「加载已解压的扩展程序」
6. 选择解压后的文件夹

### 方式 2: 开发者模式 (推荐开发者)

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/echo-x.git
cd echo-x/echo-x

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 开发模式（热重载）
npm run dev
```

然后加载 `dist/` 目录到 Chrome。

## 配置 API Key

1. 点击浏览器工具栏的 Echo-X 图标打开侧边栏
2. 点击右上角的 ⚙️ 设置按钮
3. 输入你的 API Key:
   - **OpenAI**: 从 https://platform.openai.com/api-keys 获取
   - **Kimi (Moonshot)**: 从 https://platform.moonshot.cn/ 获取
4. 选择学习的语言
5. 点击「保存设置」

### 使用 Kimi 替代 OpenAI

如果你想使用 Kimi (国内可用)，修改 `src/sidepanel.ts` 中的 API 调用：

```typescript
// 第 470 行左右
const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
  // ...
});
```

并设置模型为 `moonshot-v1-8k`。

## 使用指南

### 提取帖子
1. 打开任意 X (Twitter) 帖子页面，例如：`https://x.com/elonmusk/status/123456`
2. 点击 Echo-X 图标，侧边栏自动展开
3. 等待 AI 分析完成，你将看到：
   - 原文
   - 中文翻译
   - 分词解析
   - 生词列表
   - 语法要点
   - 例句和使用场景

### 回复助手
1. 在侧边栏底部找到「回复助手」
2. 选择语气（友好/随意/正式/幽默/赞同/提问）
3. 输入你想回复的内容要点（可以是中文或简单的外文）
4. 点击「生成回复」
5. AI 会帮你：
   - 检查语法错误
   - 润色成更自然的表达
   - 提供中文翻译
   - 解释语言知识点

### 快捷操作
- `Alt+Shift+E`: 打开 Echo-X 侧边栏
- `Enter`: 生成回复
- `Shift+Enter`: 输入框换行

## 项目结构

```
echo-x/
├── src/                    # TypeScript 源代码
│   ├── content.ts         # 内容脚本 - 提取 X 帖子
│   ├── background.ts      # Service Worker - 消息路由
│   └── sidepanel.ts       # 侧边栏主逻辑
├── types/                 # 类型定义
│   └── index.ts
├── dist/                 # 编译输出 (加载到浏览器的目录)
├── icons/                # 图标资源
├── docs/                 # 文档
│   ├── BACKLOG.md       # 产品需求 backlog
│   └── README.md
├── sidepanel.html        # 侧边栏 HTML
├── sidepanel.css         # 侧边栏样式
├── manifest.json         # 扩展配置
├── package.json          # 依赖和脚本
├── tsconfig.json         # TypeScript 配置
└── README.md            # 本文件
```

## 开发指南

查看 [README_TYPESCRIPT.md](./README_TYPESCRIPT.md) 了解详细的 TypeScript 开发规范。

### 常用命令

```bash
npm run dev          # 开发模式（热重载）
npm run build        # 构建生产版本
npm run type-check   # 类型检查
npm run lint         # 代码检查
```

### 调试

1. **Source Map**: 已启用，可在 DevTools 直接调试 TypeScript
2. **Background Script**: `chrome://extensions` → Service Worker
3. **Content Script**: X 页面 → DevTools → Sources → Content scripts
4. **Side Panel**: 右键侧边栏 → Inspect

## 产品路线图

查看 [BACKLOG.md](./docs/BACKLOG.md) 了解完整的产品规划。

### Sprint 1: MVP (当前) ✅
- 基础提取和分析
- 回复助手

### Sprint 2: 学习记录 🚧
- IndexedDB 存储
- 错误追踪
- 基础复习模式

### Sprint 3: 云端同步 📅
- 后端服务
- 用户系统
- 跨设备同步

### Sprint 4: 智能复习 📅
- 遗忘曲线算法
- 闪卡模式
- 学习统计

## 常见问题

### Q: 为什么需要 API Key？

Echo-X 使用 AI 来进行翻译、分词、语法分析等工作。这些需要调用 OpenAI/Kimi 的 API，因此需要你自己的 API Key。

### Q: API 费用如何？

- OpenAI: GPT-4o-mini 约 $0.15/1M tokens，一般使用每月 $1-5 足够
- Kimi: 新用户有免费额度，后续按量付费

### Q: 我的 API Key 安全吗？

API Key 存储在你的浏览器本地（Chrome Storage），不会上传到任何服务器。

### Q: 支持哪些语言？

目前主要优化支持：英语、日语、韩语、西班牙语、法语、德语。理论上支持任何语言，但分析质量可能有所不同。

## 贡献

欢迎提交 Issue 和 PR！

### 提交 PR 流程

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/my-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送到分支: `git push origin feature/my-feature`
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 通过 ESLint 检查
- 添加必要的类型注解
- 保持代码简洁可读

## License

MIT License - 详见 [LICENSE](./LICENSE)

---

Made with ❤️ for language learners

[加入 Discord](https://discord.gg/yourlink) | [提交反馈](../../issues)
