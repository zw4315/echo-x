# Echo-X

X (Twitter) 语言学习助手浏览器扩展，帮助你在浏览 X 时学习外语。

## 功能

- 📝 **自动提取帖子内容** - 支持原帖和回复的提取
- 🤖 **AI 智能分析** - 翻译、分词、语法讲解、重点词汇
- 🔊 **文本朗读** - 支持多语言 TTS（含日语假名注音）
- 💬 **问答助手** - 就帖子内容提问，AI 解答
- ✍️ **回复润色** - 帮你 proofread 英文回复
- 📚 **学习历史** - 缓存分析结果，Q&A 历史记录
- 🔄 **URL 自动检测** - 点击回复自动提取新内容

## 项目结构

```
.
├── src/
│   ├── components/         # UI 组件
│   │   └── sidepanel.ts    # 侧边栏主组件
│   ├── services/           # 业务逻辑
│   │   ├── analyzer.ts     # AI 分析服务
│   │   └── qa-history.ts   # 问答历史服务
│   ├── utils/              # 工具函数
│   │   ├── cache.ts        # 分析结果缓存 (IndexedDB)
│   │   ├── speech.ts       # 文本转语音
│   │   ├── text-selection.ts # 文本选择引用
│   │   └── api-validator.ts  # API 验证
│   ├── types/              # 类型定义
│   │   └── index.ts
│   ├── index.ts            # 统一入口
│   ├── content.ts          # Content Script
│   └── background.ts       # Service Worker
├── dist/                   # 构建输出
├── docs/                   # 文档
├── gateway.py              # 本地网关服务
├── setup.sh                # 一键启动脚本
└── sidepanel.html          # 侧边栏 HTML
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

```bash
cp config.json.example config.json
# 编辑 config.json，填入你的 Kimi API Key
{
  "api_key": "sk-kimi-xxxxxxxxxxxxxxxx",
  "gateway_host": "127.0.0.1",
  "gateway_port": 9742
}
```

### 3. 启动本地网关

```bash
./setup.sh
```

此命令会自动：
- 安装 uv（如未安装）
- 创建 Python 虚拟环境
- 安装依赖
- 启动网关服务

**保持此终端运行**，扩展才能正常使用。

### 4. 构建扩展

```bash
npm run build
```

### 5. 安装浏览器扩展

1. 打开 Chrome/Edge 扩展管理页 (`chrome://extensions` 或 `edge://extensions`)
2. 开启"开发人员模式"
3. 点击"加载解压缩的扩展"，选择 `dist` 文件夹

### 6. 使用

1. 打开任意 X 帖子页面（URL 包含 `/status/`）
2. 点击浏览器工具栏的 Echo-X 图标打开侧边栏
3. 帖子内容会自动提取并分析（如果网关已连接）
4. 点击任意回复，侧边栏会自动切换到该回复内容

## 开发

### 常用命令

```bash
# 开发模式（自动编译）
npm run dev

# 构建
npm run build

# 代码检查
npm run lint

# 类型检查
npm run type-check

# 清理构建
npm run clean
```

### ESLint 配置

项目已配置 ESLint 用于代码规范：

```bash
# 检查代码
npm run lint

# 自动修复
npx eslint src/**/*.ts --fix
```

## 功能说明

### 快捷键

- `Alt + S` - 打开/关闭设置面板
- `Shift + 点击刷新` - 强制重新分析（绕过缓存）

### 缓存机制

- 分析结果自动缓存到 IndexedDB
- 相同内容不会重复请求 AI
- Shift+刷新可强制重新分析
- Q&A 历史独立于分析缓存

### 回复检测

- 点击回复后 URL 变化自动检测
- 通过 status ID 匹配正确的推文
- 主帖和回复的缓存完全隔离

### 请求中断

切换帖子时会自动：
1. 中断正在进行的 AI 分析请求
2. 清空所有旧内容（原文、分析结果、问答历史）
3. 立即开始新帖子的提取和分析

## 文件说明

| 文件 | 说明 |
|------|------|
| `setup.sh` | 一键启动本地网关 |
| `gateway.py` | 网关服务主程序（Python + uvicorn）|
| `config.json` | API Key 配置（已 gitignore） |
| `config.json.example` | 配置模板 |
| `.eslintrc.json` | ESLint 配置 |

## 技术栈

- **前端**: TypeScript + Chrome Extension Manifest V3
- **网关**: Python + uv + FastAPI
- **AI**: Kimi (Moonshot) / OpenAI 兼容 API
- **存储**: IndexedDB (浏览器端缓存)

## 架构特点

1. **直接代码执行** - 用户触发时通过 `chrome.scripting.executeScript` 提取，避免 Content Script 加载时序问题
2. **最小权限原则** - 仅需要 `activeTab` 和 `scripting` 权限
3. **本地网关** - 通过本地 Python 服务转发 API 请求，避免 CORS 问题

详见 [docs/TECHNICAL.md](docs/TECHNICAL.md)

## 许可证

MIT
