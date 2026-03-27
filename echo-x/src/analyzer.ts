// Echo-X AI 分析器 - 直接连接本地网关

export interface AnalysisResult {
  translation: string;
  difficulty: string;
  tokens: TokenItem[];
  grammar: GrammarItem[];
  vocabulary: VocabItem[];
  suggestions: string[];
  detectedLanguage?: string;  // ISO 639-1 语言代码
}

export interface TokenItem {
  word: string;
  pos: string;
  lemma?: string;
  reading?: string;
  meaning: string;
}

export interface GrammarItem {
  pattern: string;
  explanation: string;
  example: string;
  exampleReading?: string;  // 日语平假名注音等
}

export interface VocabItem {
  word: string;
  level: string;
  meaning: string;
  example: string;           // 例句原文
  exampleReading?: string;   // 例句读音标注（如日语平假名、中文拼音）
  exampleTranslation?: string; // 例句中文翻译
}

const GATEWAY_URL = 'http://127.0.0.1:9742/v1';

export class TextAnalyzer {
  private model: string;

  constructor(_apiKey: string, _provider: 'openai' | 'kimi' = 'kimi', model?: string) {
    // 模型名称映射
    const modelMapping: Record<string, string> = {
      'kimi-latest': 'kimi-latest',
      'kimi-k2.5': 'kimi-k2-5',
      'kimi-k2': 'kimi-k2',
      'kimi-k1.5': 'kimi-k1-5',
      'moonshot-v1-8k': 'moonshot-v1-8k',
      'moonshot-v1-32k': 'moonshot-v1-32k',
      'moonshot-v1-128k': 'moonshot-v1-128k',
      'kimi-2.5-coding': 'kimi-2.5-coding'
    };
    
    this.model = modelMapping[model || ''] || model || 'kimi-2.5-coding';
    console.log('[Echo-X] Analyzer model:', this.model);
  }

  /**
   * 从 LLM 响应中提取并解析 JSON
   */
  private extractJson<T>(content: string): T | null {
    // 清理 markdown 代码块标记
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7).trim();
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3).trim();
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3).trim();
    }
    
    try {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
    } catch (e) {
      console.error('[Echo-X] JSON parse error:', e);
    }
    return null;
  }

  /**
   * 分析文本
   */
  async analyze(text: string, targetLang: string = 'zh'): Promise<AnalysisResult> {
    console.log('[Echo-X] Analyzing...', { model: this.model, textLength: text.length });

    const prompt = `请对以下文本进行详细的语言学习分析，帮助语言学习者理解这段内容。

文本："""${text}"""

目标语言：${targetLang === 'zh' ? '中文' : targetLang}

请返回 JSON 格式的分析结果：

{
  "detectedLanguage": "检测到的语言代码 (ja/en/ko/zh/es/fr/de/it 等 ISO 639-1 代码)",
  "translation": "翻译成中文的译文",
  "difficulty": "难度等级 (A1/A2/B1/B2/C1/C2 或 初级/中级/高级)",
  "tokens": [
    {
      "word": "原文中的单词或词组",
      "pos": "词性 (名词/动词/形容词/副词/介词/连词等)",
      "lemma": "原形 (如果是变形后的单词，提供原形)",
      "reading": "读音或假名 (如果是日语/韩语/中文拼音)",
      "meaning": "中文意思"
    }
  ],
  "grammar": [
    {
      "pattern": "语法点名称",
      "explanation": "详细解释这个语法点的用法",
      "example": "例句（原文）",
      "exampleReading": "例句中汉字/难词的注音（只标注需要注音的字词，如日语汉字标平假名，不重复标注已标注过的字）"
    }
  ],
  "vocabulary": [
    {
      "word": "重点词汇",
      "level": "难度等级 (N5/N4/N3/N2/N1 或 basic/intermediate/advanced)",
      "meaning": "中文释义",
      "example": "例句原文",
      "exampleReading": "例句中汉字/难词的注音（只标注需要注音的字词，如日语汉字标平假名，不重复标注已标注过的字）",
      "exampleTranslation": "例句的中文翻译"
    }
  ],
  "suggestions": [
    "针对这段文本的学习建议"
  ]
}

注意事项：
1. detectedLanguage 必须填写 ISO 639-1 语言代码 (ja=日语, en=英语, ko=韩语, zh=中文, es=西班牙语, fr=法语, de=德语, it=意大利语, ru=俄语, pt=葡萄牙语 等)
2. tokenization 要对文本进行合理的分词，展示每个词的信息
3. grammar 要提取 2-3 个重要的语法点
4. vocabulary 选择 3-5 个重点词汇
5. 所有解释用中文
6. 如果是日语/韩语，提供假名/读音
7. 如果是中文，可以提供拼音`;

    const response = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer local'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { 
            role: 'system', 
            content: '你是专业的语言学习助手，擅长词法分析、语法讲解和语言教学。返回 JSON 格式。' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        stream: false  // 确保返回完整响应，不是流式
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Echo-X] API Error:', errorText);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 提取并解析 JSON
    const result = this.extractJson<AnalysisResult>(content);
    if (result) {
      return result;
    }
    
    // 如果解析失败，返回基本结果
    return {
      translation: content,
      difficulty: '未知',
      tokens: [],
      grammar: [],
      vocabulary: [],
      suggestions: [],
      detectedLanguage: 'en'
    };
  }

  /**
   * Rewrite 模式：proofread 用户的英文输入
   */
  async rewriteProofread(
    originalPost: string,
    userInput: string
  ): Promise<{
    improvedText: string;
    originalText: string;
    issues: Array<{
      original: string;
      suggestion: string;
      explanation: string;
      type: string;
    }>;
    explanation: string;
  }> {
    const prompt = `请对用户的英文输入进行 proofread，指出问题并给出改进建议。

原帖内容：
"""${originalPost}"""

用户想表达的英文：
"""${userInput}"""

请返回 JSON 格式：
{
  "improvedText": "改进后的完整英文（保持原意但更地道）",
  "originalText": "用户的原始输入",
  "issues": [
    {
      "original": "有问题的原句或词汇",
      "suggestion": "建议的改进写法",
      "explanation": "为什么这样改（中文解释语法/用法问题）",
      "type": "错误类型（grammar/vocabulary/style/tone）"
    }
  ],
  "explanation": "总体评价和改进建议总结（中文）"
}

要求：
1. 找出所有语法、词汇、搭配、语气问题
2. 不仅指出错误，还要解释正确用法
3. 给出更地道的表达方式
4. 保持用户想表达的原意`;

    const response = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer local'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: '你是专业的英语写作教练，擅长 proofreading 和给出建设性的语言改进建议。返回 JSON 格式。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 提取并解析 JSON
    const result = this.extractJson<any>(content);
    if (result) {
      return result;
    }
    
    // Fallback
    return {
      improvedText: userInput,
      originalText: userInput,
      issues: [],
      explanation: content
    };
  }

  /**
   * QA 模式：回答用户关于帖子内容的问题
   */
  async answerQuestion(
    originalPost: string,
    question: string,
    authorHandle: string
  ): Promise<{
    answer: string;
    references: string[];
  }> {
    const prompt = `用户正在阅读 @${authorHandle} 的帖子，并对内容有疑问。请基于帖子内容回答问题。

原帖内容：
"""${originalPost}"""

用户的问题：
"""${question}"""

请返回 JSON 格式：
{
  "answer": "详细回答用户的问题（用中文）",
  "references": ["引用的原帖内容片段（如果有）"]
}

要求：
1. 基于帖子内容回答，不要引入外部信息
2. 如果问题与帖子无关，说明无法回答
3. 可以引用帖子原文作为回答依据
4. 用中文回答，方便用户理解`;

    const response = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer local'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: '你是专业的阅读助手，擅长理解文本内容并回答相关问题。返回 JSON 格式。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 提取并解析 JSON
    const result = this.extractJson<any>(content);
    if (result) {
      return result;
    }
    
    // Fallback
    return {
      answer: content,
      references: []
    };
  }

  /**
   * 生成回复 (保留用于兼容)
   */
  async generateReply(
    originalPost: string, 
    userInput: string, 
    tone: string,
    _targetLang: string = 'en'
  ): Promise<{
    polishedReply: string;
    translation: string;
    explanation: string;
    grammarCheck?: {
      hasErrors: boolean;
      errors: string[];
      suggestions: string[];
    };
  }> {
    const prompt = `用户想要回复这条帖子：

原帖："""${originalPost}"""

用户的输入要点："""${userInput}"""

语气要求：${tone}

请帮助用户润色回复，返回 JSON 格式：
{
  "polishedReply": "润色后的完整回复（目标语言）",
  "translation": "中文翻译",
  "explanation": "解释为什么这样修改，包含语言知识点",
  "grammarCheck": {
    "hasErrors": true/false,
    "errors": ["如果有语法错误，列出错误"],
    "suggestions": ["改进建议"]
  }
}`;

    const response = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer local'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: '你是语言学习助手，擅长语法纠正和自然表达。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 提取并解析 JSON
    const result = this.extractJson<any>(content);
    if (result) {
      return result;
    }
    
    return {
      polishedReply: content,
      translation: '',
      explanation: ''
    };
  }
}
