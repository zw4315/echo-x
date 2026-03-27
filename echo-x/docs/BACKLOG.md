# Echo-X 产品 Backlog

## Sprint 1: MVP (当前)
**目标**: 最小可用版本，验证核心价值
**时间**: 1-2 周

### 已完成 ✅
- [x] X 帖子提取（content script）
- [x] Side Panel UI 框架
- [x] AI 翻译和基础分析
- [x] 简单回复助手
- [x] 设置面板（API Key 配置）

### Sprint 1 剩余任务
- [ ] 创建图标资源
- [ ] 编写安装文档
- [ ] 基础错误处理

---

## Sprint 2: 学习记录系统
**目标**: 记录学习历史，支持复习
**优先级**: P0

### 功能需求
- [ ] IndexedDB 存储层设计
  - 学习记录表: `learning_records`
  - 错误记录表: `error_logs`
  - 语法点掌握度表: `grammar_mastery`
  
- [ ] 数据结构
```typescript
interface LearningRecord {
  id: string;
  postId: string;
  postUrl: string;
  originalText: string;
  translation: string;
  extractedAt: Date;
  vocabulary: VocabItem[];
  grammar: GrammarItem[];
}

interface ReplyRecord {
  id: string;
  postId: string;
  originalInput: string;      // 用户原始输入
  polishedReply: string;      // AI 润色后
  grammarErrors: ErrorItem[]; // 语法错误列表
  timestamp: Date;
}

interface ErrorItem {
  type: 'grammar' | 'spelling' | 'expression' | 'word_choice';
  original: string;
  correction: string;
  explanation: string;
  grammarPoint?: string;      // 关联的语法点
}

interface GrammarMastery {
  grammarPattern: string;
  encounterCount: number;
  errorCount: number;
  lastReviewed: Date;
  masteryLevel: 0-100;        // 掌握度百分比
}
```

- [ ] 复习模式 UI
  - 错题本视图
  - 语法点统计
  - 掌握度进度条
  - 复习提醒（基于遗忘曲线）

- [ ] 数据导出/导入
  - JSON 格式导出学习记录
  - 支持备份和恢复

---

## Sprint 3: 后端服务集成
**目标**: 连接 Kimi SDK，支持云端同步
**优先级**: P1

### 功能需求
- [ ] 后端 API 设计
```
POST /api/v1/analyze      # 文本分析
POST /api/v1/reply        # 回复润色
POST /api/v1/sync         # 数据同步
GET  /api/v1/records      # 获取学习记录
POST /api/v1/errors       # 记录错误
GET  /api/v1/stats        # 学习统计
```

- [ ] Kimi SDK 集成
  - 使用 Moonshot AI API
  - 流式响应支持
  - 错误重试机制

- [ ] 用户系统
  - 匿名用户（本地存储）
  - 登录用户（云端同步）
  - 数据加密存储

---

## Sprint 4: 智能复习系统
**目标**: 基于遗忘曲线的个性化复习
**优先级**: P1

### 功能需求
- [ ] 遗忘曲线算法
  - 基于 SuperMemo SM-2 算法
  - 个性化间隔重复
  
- [ ] 复习提醒
  - 浏览器通知
  - 待复习数量徽章
  
- [ ] 复习模式
  - 闪卡模式（Flashcard）
  - 填空练习
  - 改错练习
  
- [ ] 学习统计
  - 每日学习时长
  - 词汇掌握度趋势
  - 错误类型分布

---

## Sprint 5: 高级功能
**目标**: 提升用户体验
**优先级**: P2

### 功能需求
- [ ] 多语言支持
  - 日语学习优化（假名标注）
  - 韩语学习优化（罗马音）
  - 单词发音（TTS）

- [ ] 快捷键系统
  - 快速提取: `Alt+Shift+E`
  - 快速回复: `Alt+Shift+R`
  - 打开复习: `Alt+Shift+S`

- [ ] 主题定制
  - 浅色/深色/跟随系统
  - 字体大小调节
  - 配色方案

- [ ] 导出集成
  - Anki 卡片导出
  - Notion 同步
  - Obsidian 插件

---

## Sprint 6: 社区与分享
**目标**: 社交学习
**优先级**: P3

### 功能需求
- [ ] 例句贡献
  - 用户添加自己的例句
  - 社区投票最佳例句
  
- [ ] 学习小组
  - 创建学习小组
  - 分享学习进度
  - 互相纠错

- [ ] 挑战模式
  - 每日翻译挑战
  - 语法测试
  - 排行榜

---

## 技术债务
- [ ] 代码重构
  - 模块化架构
  - 类型系统（TypeScript 迁移）
  - 单元测试覆盖

- [ ] 性能优化
  - 虚拟滚动（长列表）
  - 图片懒加载
  - API 请求缓存

- [ ] 安全加固
  - API Key 加密存储
  - Content Security Policy
  - 输入验证

---

## 待讨论需求
1. **离线模式**: 是否支持离线分析（本地 AI 模型）？
2. **多设备同步**: 如何实现跨设备数据同步？
3. **付费模式**: 免费版 vs 付费版功能划分？
4. **数据隐私**: 学习记录如何保护用户隐私？

---

## 发布计划

### v1.0.0 - MVP
- 基础提取和分析
- 简单回复助手
- 本地存储

### v1.1.0 - 学习记录
- 完整的错误记录
- 基础复习模式
- 数据统计

### v1.2.0 - 云端同步
- 后端服务
- 用户系统
- 跨设备同步

### v1.3.0 - 智能复习
- 遗忘曲线算法
- 复习提醒
- 闪卡模式

### v2.0.0 - 完整产品
- 多语言优化
- 社区功能
- 第三方集成
