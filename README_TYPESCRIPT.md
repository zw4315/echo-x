# Echo-X TypeScript 开发指南

## 技术栈

- **语言**: TypeScript 5.3+
- **构建**: tsc (TypeScript Compiler)
- **类型**: Chrome Extension Types (@types/chrome)
- **代码规范**: ESLint + TypeScript ESLint

## 项目结构

```
echo-x/
├── src/                    # TypeScript 源代码
│   ├── content.ts         # 内容脚本 - 提取 X 帖子
│   ├── background.ts      # Service Worker - 消息路由
│   └── sidepanel.ts       # 侧边栏主逻辑
├── types/                 # 类型定义
│   └── index.ts          # 所有类型导出
├── dist/                 # 编译输出 (加载到浏览器的目录)
├── icons/                # 图标资源
├── sidepanel.html        # 侧边栏 HTML
├── sidepanel.css         # 侧边栏样式
├── manifest.json         # 扩展配置
├── package.json          # 依赖和脚本
├── tsconfig.json         # TypeScript 配置
└── README.md            # 使用说明
```

## 开发流程

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式 (热重载)

```bash
npm run dev
```

这会启动 TypeScript watch 模式，文件修改后自动编译到 `dist/` 目录。

### 3. 构建生产版本

```bash
npm run build
```

完整的构建流程：
1. 清理 dist 目录
2. 编译 TypeScript
3. 复制静态资源 (icons, HTML, CSS, manifest)

### 4. 加载到浏览器

构建完成后，加载 `dist/` 目录到 Chrome/Edge：

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist/` 文件夹

## 类型系统

### 核心类型定义

所有类型定义在 `types/index.ts`：

```typescript
// 帖子数据
interface XPost {
  id?: string;
  author: Author;
  timestamp: string;
  text: string;
  images: MediaItem[];
  metrics: Metrics;
}

// AI 分析结果
interface AnalysisResult {
  translation: string;
  tokenization: TokenItem[];
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  examples: ExampleItem[];
}

// AI 生成的回复
interface GeneratedReply {
  polishedReply: string;
  translation?: string;
  explanation?: string;
  grammarCheck?: GrammarCheckResult;
}
```

### 使用类型

```typescript
import type { XPost, AnalysisResult } from '../types/index.js';

class XPostExtractor {
  private currentPost: XPost | null = null;
  
  extractPost(): ExtractionResult {
    // ...
  }
}
```

## 代码规范

### ESLint 配置

```bash
npm run lint       # 检查代码
npm run type-check # 类型检查
```

### 命名规范

- **类名**: PascalCase (`EchoXSidePanel`)
- **方法/变量**: camelCase (`extractPost`, `currentPost`)
- **类型/接口**: PascalCase (`XPost`, `AnalysisResult`)
- **常量**: UPPER_SNAKE_CASE (`DEFAULT_SETTINGS`)
- **私有成员**: 前缀 `_` 或使用 `private` 修饰符

### 最佳实践

1. **严格类型**: 开启 `strict: true`，避免 `any`
2. **空值检查**: 使用可选链 `?.` 和空值合并 `??`
3. **异步处理**: 使用 `async/await`，正确处理错误
4. **类型守卫**: 使用 `instanceof` 和类型谓词

```typescript
// ✅ 好的例子
async function fetchData(): Promise<Data> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  return response.json() as Promise<Data>;
}

// ❌ 避免
async function fetchData(): Promise<any> {
  const res = await fetch(url);
  return res.json();
}
```

## 调试技巧

### 1. Source Map

`tsconfig.json` 中已启用 `sourceMap: true`，可以在 DevTools 中直接调试 TypeScript 源码。

### 2. Chrome DevTools

- **Background**: `chrome://extensions` → Echo-X → Service Worker
- **Content Script**: 在 X 页面 → DevTools → Sources → Content scripts
- **Side Panel**: 右键侧边栏 → Inspect

### 3. 日志

```typescript
console.log('[Echo-X] Message:', data);
```

使用 `[Echo-X]` 前缀方便过滤日志。

## 添加新功能

### 示例：添加复习模式 (Sprint 2)

1. **添加类型** (`types/index.ts`):
```typescript
export interface LearningRecord {
  id: string;
  postId: string;
  // ...
}
```

2. **创建存储类** (`src/storage.ts`):
```typescript
export class LearningStorage {
  async saveRecord(record: LearningRecord): Promise<void> {
    // 使用 chrome.storage.local
  }
  
  async getRecords(): Promise<LearningRecord[]> {
    // ...
  }
}
```

3. **在 SidePanel 中使用**:
```typescript
import { LearningStorage } from './storage.js';

class EchoXSidePanel {
  private storage = new LearningStorage();
  
  async saveCurrentPost(): Promise<void> {
    if (this.currentPost) {
      await this.storage.saveRecord({
        id: generateId(),
        postId: this.currentPost.id,
        // ...
      });
    }
  }
}
```

## 迁移 JavaScript 到 TypeScript

### 自动迁移

```bash
# 安装 ts-migrate (大型项目)
npx ts-migrate-full src
```

### 手动迁移步骤

1. 重命名 `.js` → `.ts`
2. 添加类型注解
3. 处理 `any` 类型
4. 修复类型错误
5. 测试功能

## 常见问题

### Q: 编译报错 "Cannot find module"

确保导入路径使用 `.js` 扩展名：
```typescript
// ✅ 正确
import type { XPost } from '../types/index.js';

// ❌ 错误
import type { XPost } from '../types/index';
```

### Q: chrome API 类型不存在

安装 Chrome 类型：
```bash
npm install --save-dev @types/chrome
```

### Q: 如何让 CSS 变量有类型提示？

创建 `css.d.ts`：
```typescript
declare module '*.css' {
  const content: string;
  export default content;
}
```

## 下一步

查看 [BACKLOG.md](./docs/BACKLOG.md) 了解 Sprint 2+ 的功能规划：
- 学习记录系统
- 复习模式
- 后端同步
- 遗忘曲线算法

---

Happy coding with TypeScript! 🚀
