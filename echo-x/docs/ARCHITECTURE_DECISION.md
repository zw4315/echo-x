# Echo-X 架构决策：前端 vs 后端

## 问题
使用 Kimi SDK 进行词法/语法分析，是否需要后端？

## 关键事实

### Kimi SDK 现状
| SDK 类型 | 存在？ | 适用场景 |
|----------|--------|----------|
| Python SDK | ✅ 官方提供 | 后端服务 |
| Node.js SDK | ✅ 社区提供 | 后端服务 |
| 浏览器 SDK | ❌ 不存在 | 前端不可用 |

**结论**：Kimi 没有浏览器版 SDK，只有 HTTP API 可以直接从前端调用。

## 两种架构对比

### 方案 A：纯前端（当前架构）

```
┌─────────────┐      HTTP      ┌─────────────┐
│   浏览器    │ ─────────────→ │  Kimi API   │
│  Echo-X     │                │  (Moonshot) │
└─────────────┘                └─────────────┘

代码示例：
const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: 'moonshot-v1-8k',
    messages: [{ role: 'user', content: prompt }]
  })
});
```

**优点**：
- ✅ 零服务器成本
- ✅ 用户数据隐私（直接发到 Kimi，不经过中间服务器）
- ✅ 延迟低（少一跳网络）
- ✅ 部署简单（纯静态文件）

**缺点**：
- ❌ API Key 存储在浏览器（但可以接受，因为不传输到第三方）
- ❌ 无法做复杂缓存/批处理
- ❌ 无法实现用户系统（登录/同步）

---

### 方案 B：添加后端服务

```
┌─────────────┐     HTTP      ┌─────────────┐     HTTP      ┌─────────────┐
│   浏览器    │ ─────────────→│  Echo-X     │ ─────────────→│   Kimi API  │
│  Echo-X     │               │  Backend    │               │  (Moonshot) │
└─────────────┘               └─────────────┘               └─────────────┘
                                      ↓
                               ┌─────────────┐
                               │  Database   │
                               │ (User Data) │
                               └─────────────┘

后端技术栈：
- Node.js + Express (或 Cloudflare Workers)
- 调用 @moonshotai/moonshot-js SDK
- 数据库：PostgreSQL / MongoDB
```

**优点**：
- ✅ 可以隐藏 API Key（后端管理）
- ✅ 可以实现用户系统（登录/注册）
- ✅ 可以持久化数据（学习记录、复习进度）
- ✅ 可以做多用户共享（例句库、最佳回复模板）
- ✅ 可以做缓存（重复分析直接返回）

**缺点**：
- ❌ 需要服务器成本（$5-20/月）
- ❌ 部署运维复杂
- ❌ 延迟增加（多一跳网络）
- ❌ 用户隐私（数据经过你的服务器）

---

## 决策建议

### 短期（MVP）：保持纯前端 ✅

**理由**：
1. Kimi HTTP API 功能完全够用
2. 无需服务器，用户可以立即使用
3. API Key 存储本地是可接受的（类似其他扩展）

**实现方式**：
```javascript
// 直接使用 Kimi HTTP API
class KimiAnalyzer {
  async analyze(text) {
    const prompt = `分析这段文本的词法和语法：
"""${text}"""

返回 JSON：{
  "translation": "中文翻译",
  "tokenization": [{"word": "单词", "pos": "词性", "meaning": "意思"}],
  "grammar": [{"pattern": "语法点", "explanation": "解释"}],
  "vocabulary": [{"word": "生词", "level": "N5/N4/N3/N2/N1"}]
}`;

    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'system', content: '你是语言学习助手' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    return response.json();
  }
}
```

### 长期（商业化）：添加后端

**触发条件**：
- 需要用户系统（登录/同步学习进度）
- 需要复习系统（遗忘曲线算法，需要持久化数据）
- 需要隐藏 API Key（付费版，防止滥用）
- 需要社区功能（共享例句、排行榜）

**渐进式迁移路径**：
```
Phase 1: 纯前端（现在）
    ↓
Phase 2: 可选后端（用户选择是否登录）
    - 未登录：直接调用 Kimi
    - 已登录：走后端，同步学习记录
    ↓
Phase 3: 纯后端（付费版必须登录）
    - 免费版：每日限额，直接调用
    - 付费版：无限额，走后端
```

---

## 推荐：混合架构（最佳实践）

```
┌─────────────────────────────────────────────────────────────┐
│                      Echo-X 架构                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐                                          │
│  │   前端       │  纯静态，直接调用 Kimi API                │
│  │  (浏览器)    │  - 帖子提取                               │
│  │              │  - AI 分析（词法/语法/翻译）              │
│  │              │  - 本地存储（设置、缓存）                 │
│  └──────────────┘                                          │
│           │                                                │
│           │ 可选：用户登录后                                │
│           ↓                                                │
│  ┌──────────────┐     ┌──────────────┐                    │
│  │  轻量后端    │────→│   数据库     │                    │
│  │ (Cloudflare │     │  (D1/PlanetScale)                 │
│  │  Workers)    │     │               │                    │
│  └──────────────┘     └──────────────┘                    │
│       (可选，免费额度够用)                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**技术选型**：
- **前端**：保持现有架构
- **后端（可选）**：Cloudflare Workers（免费额度 100k/天）
- **数据库**：Cloudflare D1（免费 500MB）

**优点**：
- 免费起步，随用量增长付费
- 全球 CDN，延迟低
- 无需运维服务器

---

## 下一步行动

### 方案 1：立即添加 AI 分析（纯前端）
**工作量**：2-3 小时
**成本**：$0

### 方案 2：搭建轻量后端（Cloudflare）
**工作量**：1-2 天
**成本**：$0（起步）

### 方案 3：完整后端（VPS）
**工作量**：1 周
**成本**：$10-20/月

**推荐**：先实现方案 1，用户反馈好后再考虑方案 2。

---

## 代码示例：添加 AI 分析

```typescript
// src/analyzer.ts
export class TextAnalyzer {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, provider: 'openai' | 'kimi' = 'kimi') {
    this.apiKey = apiKey;
    this.baseUrl = provider === 'kimi' 
      ? 'https://api.moonshot.cn/v1'
      : 'https://api.openai.com/v1';
  }

  async analyze(text: string, targetLang: string = 'zh') {
    const prompt = this.buildPrompt(text, targetLang);
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [
          { 
            role: 'system', 
            content: '你是专业的语言学习助手，擅长词法分析和语法讲解。' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  private buildPrompt(text: string, targetLang: string): string {
    return `请对以下文本进行详细的语言学习分析：

文本："""${text}"""

请返回以下内容的 JSON：

1. **词法分析 (Tokenization)**
   - 每个单词/词组
   - 词性（名词、动词、形容词等）
   - 读音（如果是日语/韩语）
   - 原形（如果是变形后的单词）

2. **语法要点 (Grammar)**
   - 句子中的关键语法结构
   - 用法解释
   - 类似结构的对比

3. **重点词汇 (Vocabulary)**
   - 值得学习的单词
   - 难度等级（CEFR A1-C2 或 JLPT N5-N1）
   - 例句

4. **学习建议**
   - 这段话适合什么水平的学习者
   - 建议重点学习哪些知识点

返回格式：
{
  "translation": "中文翻译",
  "difficulty": "B1",
  "tokens": [
    {"word": "running", "pos": "verb", "lemma": "run", "meaning": "跑步"}
  ],
  "grammar": [
    {"pattern": "present continuous", "explanation": "表示正在进行的动作", "example": "I am running"}
  ],
  "vocabulary": [
    {"word": "investigation", "level": "B2", "meaning": "调查", "example": "The police started an investigation."}
  ],
  "suggestions": ["建议重点学习现在进行时", "investigation 是正式用语"]
}`;
  }
}
```

---

## 你的选择是？

| 选项 | 描述 | 时间 | 成本 |
|------|------|------|------|
| **A** | 纯前端，直接调用 Kimi | 2-3 小时 | $0 |
| **B** | 添加 Cloudflare Workers 后端 | 1-2 天 | $0 |
| **C** | 完整 VPS 后端 | 1 周 | $10-20/月 |

**推荐 A**，后续按需升级。
