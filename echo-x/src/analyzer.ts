// Echo-X AI 分析器 - 直接连接本地网关

export interface AnalysisResult {
  translation: string;
  difficulty: string;
  tokens: TokenItem[];
  grammar: GrammarItem[];
  vocabulary: VocabItem[];
  suggestions: string[];
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
}

export interface VocabItem {
  word: string;
  level: string;
  meaning: string;
  example: string;
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
   * 分析文本
   */
  async analyze(text: string, targetLang: string = 'zh'): Promise<AnalysisResult> {
    console.log('[Echo-X] Analyzing...', { model: this.model, textLength: text.length });

    const prompt = `请对以下文本进行详细的语言学习分析，帮助语言学习者理解这段内容。

文本："""${text}"""

目标语言：${targetLang === 'zh' ? '中文' : targetLang}

请返回 JSON 格式的分析结果：

{
  "translation": "翻译成中文的译文",
  "difficulty": "难度等级 (A1/A2/B1/B2/C1/C2 或 初级/中级/高级)",
  "tokens": [
    {
      "word": "原文中的单词或词组",
      "pos": "词性 (名词/动词/形容词/副词/介词/连词等)",
      "lemma": "原形 (如果是变形后的单词，提供原形)",
      "reading": "读音或假名 (如果是日语/韩语)",
      "meaning": "中文意思"
    }
  ],
  "grammar": [
    {
      "pattern": "语法点名称",
      "explanation": "详细解释这个语法点的用法",
      "example": "一个使用这个语法点的例句"
    }
  ],
  "vocabulary": [
    {
      "word": "重点词汇",
      "level": "难度等级 (N5/N4/N3/N2/N1 或 basic/intermediate/advanced)",
      "meaning": "中文释义",
      "example": "使用这个单词的例句"
    }
  ],
  "suggestions": [
    "针对这段文本的学习建议"
  ]
}

注意事项：
1. tokenization 要对文本进行合理的分词，展示每个词的信息
2. grammar 要提取 2-3 个重要的语法点
3. vocabulary 选择 3-5 个重点词汇
4. 所有解释用中文
5. 如果是英语文本，注意时态、语态、从句等语法点`;

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
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Echo-X] API Error:', errorText);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 解析 JSON
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[Echo-X] JSON parse error:', e);
    }
    
    // 如果解析失败，返回基本结果
    return {
      translation: content,
      difficulty: '未知',
      tokens: [],
      grammar: [],
      vocabulary: [],
      suggestions: []
    };
  }

  /**
   * 生成回复
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
        temperature: 0.5
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[Echo-X] JSON parse error:', e);
    }
    
    return {
      polishedReply: content,
      translation: '',
      explanation: ''
    };
  }
}
