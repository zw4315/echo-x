// Echo-X - X(Twitter) 语言学习助手
// 统一入口文件

// 类型定义 (直接导出，避免重复导出)
export type {
  ExtensionSettings,
  Author,
  MediaItem,
  Metrics,
  XPost,
  ExtractionResult,
  LearningRecord,
  ErrorRecord,
  Message,
  ExtractPostMessage,
  PostExtractedMessage,
  FillReplyMessage
} from './types/index.js';

// 工具函数
export * from './utils/cache.js';
export * from './utils/speech.js';
export * from './utils/text-selection.js';
export * from './utils/api-validator.js';

// 业务服务 (AnalysisResult, TokenItem 等从这里导出)
export * from './services/analyzer.js';
export * from './services/qa-history.js';

// 组件
export * from './components/sidepanel.js';

// Content Script 和 Background 保持独立入口
// - content.ts (单独构建)
// - background.ts (单独构建)
