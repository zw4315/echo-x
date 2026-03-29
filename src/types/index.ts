// Echo-X 类型定义

// 用户设置
export interface ExtensionSettings {
  apiProvider: 'openai' | 'kimi' | 'custom';
  apiKey: string;
  apiModel: string;
  apiBaseUrl: string;
  targetLanguage: string;
  nativeLanguage: string;
  learningLanguage: string;
  autoAnalyze: boolean;
}

// 作者信息
export interface Author {
  handle: string;
  displayName: string;
  profileUrl: string;
}

// 媒体文件
export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  alt?: string;
}

// 互动数据
export interface Metrics {
  replies: number;
  reposts: number;
  likes: number;
  bookmarks?: number;
}

// X 帖子数据
export interface XPost {
  id?: string;
  url?: string;
  author: Author;
  timestamp: string;
  text: string;
  images: MediaItem[];
  videos?: MediaItem[];
  metrics: Metrics;
}

// 提取结果
export interface ExtractionResult {
  success: boolean;
  data?: XPost;
  error?: string;
}

// AI 分析结果（与 analyzer.ts 保持兼容）
export interface AnalysisResult {
  translation: string;
  difficulty: string;
  tokens: TokenItem[];
  grammar: GrammarItem[];
  vocabulary: VocabularyItem[];
  suggestions: string[];
  detectedLanguage?: string;
}

// 分词项
export interface TokenItem {
  word: string;
  pos: string;
  lemma?: string;
  reading?: string;
  meaning: string;
}

// 词汇项
export interface VocabularyItem {
  word: string;
  level: string;
  meaning: string;
  example: string;
  exampleReading?: string;
  exampleTranslation?: string;
}

// 语法项
export interface GrammarItem {
  pattern: string;
  explanation: string;
  example: string;
  exampleReading?: string;
}

// 例句
export interface ExampleItem {
  sentence: string;
  translation: string;
  context: string;
}

// 语法检查结果
export interface GrammarCheckResult {
  hasErrors: boolean;
  errors: string[];
  suggestions: string[];
}

// AI 生成的回复
export interface GeneratedReply {
  originalInput?: string;
  polishedReply: string;
  translation?: string;
  explanation?: string;
  grammarCheck?: GrammarCheckResult;
  timestamp?: string;
}

// 语气类型
export type ToneType = 'friendly' | 'casual' | 'formal' | 'humorous' | 'agree' | 'question';

// 学习记录 (Sprint 2)
export interface LearningRecord {
  id: string;
  postId: string;
  postUrl: string;
  originalText: string;
  translation: string;
  extractedAt: Date;
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
}

// 错误记录 (Sprint 2)
export interface ErrorRecord {
  id: string;
  recordId: string;
  type: 'grammar' | 'spelling' | 'expression' | 'word_choice';
  original: string;
  correction: string;
  explanation: string;
  grammarPoint?: string;
  timestamp: Date;
}

// 消息类型
export interface Message {
  type: string;
  data?: unknown;
  error?: string;
}

export interface ExtractPostMessage extends Message {
  type: 'GET_CURRENT_POST' | 'EXTRACT_SINGLE' | 'EXTRACT_THREAD';
  maxDepth?: number;
}

export interface PostExtractedMessage extends Message {
  type: 'POST_EXTRACTED';
  data: XPost;
}

export interface FillReplyMessage extends Message {
  type: 'FILL_REPLY';
  text: string;
}
