// Echo-X Side Panel Logic - TypeScript 版本

import type {
  ExtensionSettings,
  XPost,
  AnalysisResult,
  GeneratedReply,
  ToneType,
  TokenItem,
  VocabularyItem,
  GrammarItem,
  ExampleItem
} from './types/index.js';

/**
 * Echo-X 侧边栏主类
 */
class EchoXSidePanel {
  private settings: ExtensionSettings;
  private currentPost: XPost | null = null;
  private analysisResult: AnalysisResult | null = null;
  private selectedTone: ToneType = 'friendly';

  constructor() {
    this.settings = {
      apiProvider: 'openai',
      apiKey: '',
      apiModel: 'gpt-4o-mini',
      apiBaseUrl: '',
      targetLanguage: 'zh-CN',
      nativeLanguage: 'zh-CN',
      learningLanguage: 'auto',
      autoAnalyze: true
    };
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    try {
      console.log('[Echo-X] Initializing...');
      await this.loadSettings();
      this.initEventListeners();
      this.initReplyAssistant();
      await this.checkAndExtract();
    } catch (err) {
      console.error('[Echo-X] Init error:', err);
      this.showError('初始化失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  /**
   * 显示错误
   */
  private showError(message: string): void {
    console.error('[Echo-X]', message);
    const errorEl = document.getElementById('errorDetail');
    if (errorEl) errorEl.textContent = message;
    this.showEmptyState();
  }

  // ========== 设置管理 ==========

  /**
   * 加载设置
   */
  private async loadSettings(): Promise<void> {
    const keys: (keyof ExtensionSettings)[] = [
      'apiProvider', 'apiKey', 'apiModel', 'apiBaseUrl',
      'targetLanguage', 'nativeLanguage', 'learningLanguage', 'autoAnalyze'
    ];
    
    const result = await chrome.storage.local.get(keys);
    this.settings = { ...this.settings, ...result };
    
    this.updateSettingsForm();
  }

  /**
   * 更新设置表单
   */
  private updateSettingsForm(): void {
    const getEl = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    
    const apiProviderEl = getEl('apiProvider');
    const apiKeyEl = getEl('apiKey');
    const aiModelEl = getEl('aiModel');
    const learningLangEl = getEl('learningLanguage');
    const targetLangEl = getEl('targetLanguage');
    
    if (apiProviderEl) apiProviderEl.value = this.settings.apiProvider;
    if (apiKeyEl) apiKeyEl.value = this.settings.apiKey;
    if (aiModelEl) aiModelEl.value = this.settings.apiModel;
    if (learningLangEl) learningLangEl.value = this.settings.learningLanguage;
    if (targetLangEl) targetLangEl.value = this.settings.targetLanguage;
  }

  /**
   * 保存设置
   */
  private async saveSettings(): Promise<void> {
    const getEl = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    
    this.settings = {
      ...this.settings,
      apiProvider: (getEl('apiProvider')?.value as 'openai' | 'kimi') || 'openai',
      apiKey: getEl('apiKey')?.value.trim() || '',
      apiModel: getEl('aiModel')?.value || 'gpt-4o-mini',
      learningLanguage: getEl('learningLanguage')?.value || 'auto',
      targetLanguage: getEl('targetLanguage')?.value || 'zh-CN'
    };
    
    await chrome.storage.local.set(this.settings);
    this.showSettings(false);
    this.showToast('设置已保存');
    
    if (this.currentPost && this.settings.apiKey) {
      this.analyzePost();
    }
  }

  // ========== 事件监听 ==========

  /**
   * 初始化事件监听
   */
  private initEventListeners(): void {
    // 刷新按钮
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.checkAndExtract());
    
    // 调试按钮
    document.getElementById('forceInjectBtn')?.addEventListener('click', () => this.forceInject());
    document.getElementById('toggleDebugBtn')?.addEventListener('click', () => this.toggleDebug());
    
    // 设置面板 (Alt+S 打开)
    document.getElementById('closeSettings')?.addEventListener('click', () => this.showSettings(false));
    document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        const settingsPanel = document.getElementById('settingsPanel');
        this.showSettings(settingsPanel?.classList.contains('hidden') || false);
      }
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        this.toggleDebug();
      }
    });
    
    // 复制按钮
    document.getElementById('copyOriginalBtn')?.addEventListener('click', () => {
      this.copyToClipboard(this.currentPost?.text || '');
    });
    document.getElementById('copyTranslationBtn')?.addEventListener('click', () => {
      this.copyToClipboard(this.analysisResult?.translation || '');
    });

    // 监听标签页变化
    chrome.tabs.onActivated.addListener(() => this.checkAndExtract());
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
      if (changeInfo.url) this.checkAndExtract();
    });
  }

  /**
   * 切换调试面板
   */
  private toggleDebug(): void {
    const panel = document.getElementById('debugPanel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  }

  /**
   * 更新调试信息
   */
  private updateDebug(url: string, status: string, error?: string): void {
    const urlEl = document.getElementById('debugUrl');
    const statusEl = document.getElementById('debugStatus');
    const errorEl = document.getElementById('debugError');
    
    if (urlEl) urlEl.textContent = 'URL: ' + (url || 'null');
    if (statusEl) statusEl.textContent = '状态: ' + status;
    if (errorEl && error) errorEl.textContent = '错误: ' + error;
  }

  /**
   * 强制注入 content script
   */
  private async forceInject(): Promise<void> {
    try {
      this.updateDebug('', '强制注入中...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        this.updateDebug('', '注入失败', '无法获取当前标签页');
        return;
      }

      // 先尝试直接注入
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      this.updateDebug(tab.url || '', '注入成功，等待加载...');
      
      // 等待一下再提取
      setTimeout(() => this.checkAndExtract(), 1000);
    } catch (error) {
      this.updateDebug('', '注入失败', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 初始化回复助手
   */
  private initReplyAssistant(): void {
    // 语气选择
    document.querySelectorAll('.reply-tone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.reply-tone-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTone = (btn as HTMLElement).dataset.tone as ToneType || 'friendly';
      });
    });
    document.querySelector('[data-tone="friendly"]')?.classList.add('active');

    // 生成回复
    document.getElementById('generateReplyBtn')?.addEventListener('click', () => this.generateReply());
    document.getElementById('quickReplyBtn')?.addEventListener('click', () => this.quickReply());

    // 回车发送
    const replyInput = document.getElementById('replyInput') as HTMLTextAreaElement | null;
    replyInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.generateReply();
      }
    });
  }

  // ========== 帖子提取 ==========

  /**
   * 检查并提取当前帖子
   */
  private async checkAndExtract(): Promise<void> {
    this.showLoading(true);
    this.updateDebug('', '开始检测...');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        console.log('[Echo-X] No active tab');
        this.updateDebug('', '失败', '无法获取当前标签页');
        this.showLoading(false);
        return;
      }

      const url = tab.url || '';
      console.log('[Echo-X] Current URL:', url);
      
      const hasXDomain = url.includes('x.com/') || url.includes('twitter.com/');
      const hasStatus = url.includes('/status/');
      const isValidPage = hasXDomain && hasStatus;

      if (!isValidPage) {
        console.log('[Echo-X] Not a valid X post page:', { hasXDomain, hasStatus, url });
        const emptyState = document.getElementById('emptyState');
        const errorDetail = document.getElementById('errorDetail');
        if (emptyState) emptyState.classList.remove('hidden');
        
        let errorMsg = '';
        if (!hasXDomain) {
          errorMsg = '当前不是 X 网站';
        } else if (!hasStatus) {
          errorMsg = '当前不是帖子页面';
        } else {
          errorMsg = 'URL格式错误';
        }
        
        if (errorDetail) errorDetail.textContent = errorMsg;
        this.updateDebug(url, 'URL检查失败', errorMsg);
        this.showLoading(false);
        return;
      }

      this.updateDebug(url, 'URL合法，发送消息...');
      console.log('[Echo-X] Sending message to content script...');
      
      // 先测试 content script 是否响应
      let response;
      try {
        response = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_POST' }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT')), 5000)
          )
        ]);
      } catch (sendError) {
        const errorMsg = sendError instanceof Error ? sendError.message : String(sendError);
        console.log('[Echo-X] Send message failed:', errorMsg);
        
        if (errorMsg.includes('Could not establish connection') || errorMsg.includes('Receiving end does not exist')) {
          this.updateDebug(url, 'Content Script 未加载', '尝试自动注入...');
          await this.injectContentScript();
          this.showLoading(false);
          return;
        } else if (errorMsg === 'TIMEOUT') {
          this.updateDebug(url, '超时', 'Content Script 无响应');
          this.handleError('Content Script 无响应，请尝试点击"强制注入"按钮');
          this.showLoading(false);
          return;
        }
        throw sendError;
      }
      
      console.log('[Echo-X] Response:', response);
      this.showLoading(false);
      
      if (response.success) {
        this.updateDebug(url, '提取成功');
        this.handlePostExtracted(response.data as XPost);
      } else {
        this.updateDebug(url, '提取失败', response.error as string);
        this.handleError(response.error as string || '提取失败');
      }
    } catch (error) {
      this.showLoading(false);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Echo-X] Error in checkAndExtract:', error);
      this.updateDebug('', '异常', errorMsg);
      this.handleError(errorMsg);
    }
  }

  /**
   * 注入 content script
   */
  private async injectContentScript(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        this.handleError('无法获取当前标签页');
        return;
      }

      console.log('[Echo-X] Injecting content script...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('[Echo-X] Content script injected');

      // 等待脚本初始化
      setTimeout(() => this.checkAndExtract(), 800);
    } catch (error) {
      console.error('[Echo-X] Inject failed:', error);
      this.handleError('注入失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 处理帖子提取成功
   */
  private handlePostExtracted(data: XPost): void {
    console.log('[Echo-X] Post extracted:', data);
    
    // 验证数据
    if (!data) {
      this.handleError('提取数据为空');
      return;
    }
    
    if (!data.text || data.text.trim().length === 0) {
      console.warn('[Echo-X] Extracted post has no text, retrying...');
      // 可能页面还没加载完，延迟重试
      setTimeout(() => this.checkAndExtract(), 1000);
      return;
    }
    
    this.currentPost = data;
    this.renderPost(data);
    
    if (this.settings.apiKey) {
      this.analyzePost();
    } else {
      this.showPlaceholder('请在设置中配置 API Key');
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: string, debugInfo?: string): void {
    console.error('[Echo-X]', error, debugInfo);
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
      const h3 = emptyState.querySelector('h3');
      const p = emptyState.querySelector('p');
      if (h3) h3.textContent = '提取失败';
      let errorText = error || '请确保你在 X 帖子页面';
      if (debugInfo) {
        errorText += `\n\n调试: ${debugInfo}`;
      }
      errorText += '\n\n尝试点击刷新按钮 🔄 重试';
      if (p) p.textContent = errorText;
      this.showEmptyState();
    }
  }

  /**
   * 渲染帖子
   */
  private renderPost(data: XPost): void {
    console.log('[Echo-X] Rendering post:', data);
    
    // 检查数据完整性
    if (!data.text || data.text.trim().length === 0) {
      console.warn('[Echo-X] Post text is empty');
      this.handleError('提取到空文本', JSON.stringify({
        hasAuthor: !!data.author?.displayName,
        hasText: !!data.text,
        textLength: data.text?.length,
        timestamp: data.timestamp
      }));
      return;
    }
    
    document.getElementById('emptyState')?.classList.add('hidden');
    document.getElementById('loadingState')?.classList.add('hidden');
    document.getElementById('mainContent')?.classList.remove('hidden');

    const authorNameEl = document.getElementById('authorName');
    const authorHandleEl = document.getElementById('authorHandle');
    const postTimeEl = document.getElementById('postTime');
    const originalTextEl = document.getElementById('originalText');

    if (authorNameEl) authorNameEl.textContent = data.author?.displayName || 'Unknown';
    if (authorHandleEl) authorHandleEl.textContent = `@${data.author?.handle || 'unknown'}`;
    if (postTimeEl) postTimeEl.textContent = this.formatTime(data.timestamp);
    if (originalTextEl) originalTextEl.textContent = data.text;

    // 图片
    const imagesContainer = document.getElementById('postImages');
    if (imagesContainer) {
      imagesContainer.innerHTML = '';
      data.images?.forEach(img => {
        const imgEl = document.createElement('img');
        imgEl.src = img.url;
        imgEl.alt = img.alt || '';
        imagesContainer.appendChild(imgEl);
      });
    }
  }

  // ========== AI 分析 ==========

  /**
   * 分析帖子
   */
  private async analyzePost(): Promise<void> {
    if (!this.currentPost || !this.settings.apiKey) return;

    this.showLoading(true);

    try {
      const prompt = `分析以下文本，返回 JSON 格式：

文本："""${this.currentPost.text}"""

返回：
{
  "translation": "中文翻译",
  "tokenization": [{"word": "单词", "reading": "读音"}],
  "vocabulary": [{"word": "生词", "reading": "读音", "meaning": "意思", "level": "N5/N4/N3/N2/N1"}],
  "grammar": [{"pattern": "语法", "explanation": "解释"}],
  "examples": [{"sentence": "例句", "translation": "翻译", "context": "场景"}]
}`;

      this.analysisResult = await this.callAI<AnalysisResult>(prompt, true);
      this.renderAnalysis(this.analysisResult);
    } catch (error) {
      console.error('[Echo-X] Analysis error:', error);
      this.showPlaceholder('分析失败，请检查 API Key');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 渲染分析结果
   */
  private renderAnalysis(result: AnalysisResult): void {
    // 翻译
    const translationEl = document.getElementById('translationText');
    if (translationEl) translationEl.textContent = result.translation || '暂无翻译';

    // 分词
    const tokenContainer = document.getElementById('tokenization');
    if (tokenContainer) {
      tokenContainer.innerHTML = result.tokenization?.map((t: TokenItem) => `
        <div class="token">
          <span class="token-word">${t.word}</span>
          ${t.reading ? `<span class="token-reading">${t.reading}</span>` : ''}
        </div>
      `).join('') || '<p style="color: var(--text-secondary)">暂无分词</p>';
    }

    // 生词
    const vocabContainer = document.getElementById('vocabulary');
    const vocabCount = document.getElementById('vocabCount');
    if (vocabContainer && result.vocabulary) {
      if (vocabCount) vocabCount.textContent = String(result.vocabulary.length);
      vocabContainer.innerHTML = result.vocabulary.map((v: VocabularyItem) => `
        <div class="vocab-item">
          <div>
            <span class="vocab-word">${v.word}</span>
            ${v.reading ? `<span class="vocab-reading">${v.reading}</span>` : ''}
            <span class="vocab-level level-n3">${v.level || 'N3'}</span>
          </div>
          <div class="vocab-meaning">${v.meaning}</div>
        </div>
      `).join('');
    }

    // 语法
    const grammarContainer = document.getElementById('grammar');
    if (grammarContainer) {
      grammarContainer.innerHTML = result.grammar?.map((g: GrammarItem) => `
        <div class="grammar-item">
          <div class="grammar-pattern">${g.pattern}</div>
          <div class="grammar-explanation">${g.explanation}</div>
        </div>
      `).join('') || '<p style="color: var(--text-secondary)">暂无语法要点</p>';
    }

    // 例句
    const examplesContainer = document.getElementById('examples');
    if (examplesContainer) {
      examplesContainer.innerHTML = result.examples?.map((e: ExampleItem) => `
        <div class="example-item">
          <div class="example-sentence">${e.sentence}</div>
          <div class="example-translation">${e.translation}</div>
          <div class="example-context">📍 ${e.context}</div>
        </div>
      `).join('') || '<p style="color: var(--text-secondary)">暂无例句</p>';
    }
  }

  // ========== 回复助手 ==========

  /**
   * 生成回复
   */
  private async generateReply(): Promise<void> {
    const input = (document.getElementById('replyInput') as HTMLTextAreaElement | null)?.value.trim();
    if (!input) {
      this.showToast('请输入回复内容');
      return;
    }

    if (!this.settings.apiKey) {
      this.showToast('请先配置 API Key');
      this.showSettings(true);
      return;
    }

    this.setReplyLoading(true);

    try {
      const toneMap: Record<ToneType, string> = {
        friendly: '友好热情', casual: '随意轻松', formal: '正式礼貌',
        humorous: '幽默风趣', agree: '赞同支持', question: '提问好奇'
      };

      const prompt = `用户想回复这个 X 帖子：
原帖："""${this.currentPost?.text || ''}"""
用户输入："""${input}"""
语气：${toneMap[this.selectedTone]}

请返回 JSON：
{
  "polishedReply": "润色后的回复",
  "translation": "中文翻译",
  "explanation": "修改说明和语言知识点",
  "grammarCheck": {
    "hasErrors": true/false,
    "errors": ["错误1", "错误2"],
    "suggestions": ["建议1"]
  }
}`;

      const result = await this.callAI<GeneratedReply>(prompt, true);
      this.displayGeneratedReply(result);
      
      const replyInput = document.getElementById('replyInput') as HTMLTextAreaElement | null;
      if (replyInput) replyInput.value = '';
    } catch (error) {
      this.showToast('生成失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      this.setReplyLoading(false);
    }
  }

  /**
   * 快速回复
   */
  private async quickReply(): Promise<void> {
    if (!this.settings.apiKey) {
      this.showToast('请先配置 API Key');
      return;
    }

    this.setReplyLoading(true);

    try {
      const toneMap: Record<ToneType, string> = {
        friendly: '友好', casual: '随意', formal: '正式',
        humorous: '幽默', agree: '赞同', question: '提问'
      };

      const prompt = `为这个 X 帖子生成一个${toneMap[this.selectedTone]}的回复：
"""${this.currentPost?.text || ''}"""

返回 JSON：
{
  "polishedReply": "回复内容",
  "translation": "中文翻译",
  "explanation": "语言知识点说明"
}`;

      const result = await this.callAI<GeneratedReply>(prompt, true);
      this.displayGeneratedReply(result);
    } catch (error) {
      this.showToast('生成失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      this.setReplyLoading(false);
    }
  }

  /**
   * 显示生成的回复
   */
  private displayGeneratedReply(reply: GeneratedReply): void {
    const container = document.getElementById('generatedReplies');
    if (!container) return;

    const replyEl = document.createElement('div');
    replyEl.className = 'reply-item';
    replyEl.innerHTML = `
      <div class="reply-text">${this.escapeHtml(reply.polishedReply)}</div>
      ${reply.translation ? `<div class="reply-translation">${reply.translation}</div>` : ''}
      ${reply.explanation ? `<div class="reply-explanation">💡 ${reply.explanation}</div>` : ''}
      ${reply.grammarCheck?.hasErrors ? `
        <div style="margin-bottom: 8px; padding: 8px; background: rgba(244, 33, 46, 0.1); border-radius: 6px;">
          <div style="font-size: 12px; color: var(--error); margin-bottom: 4px;">⚠️ 语法问题</div>
          <ul style="font-size: 12px; color: var(--text-secondary); margin: 0; padding-left: 16px;">
            ${reply.grammarCheck.errors.map(e => `<li>${e}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="reply-item-actions">
        <button class="reply-item-btn copy-btn" data-text="${this.escapeHtml(reply.polishedReply)}">📋 复制</button>
        <button class="reply-item-btn use-btn" data-text="${this.escapeHtml(reply.polishedReply)}">✓ 使用</button>
      </div>
    `;

    container.insertBefore(replyEl, container.firstChild);

    // 绑定按钮
    replyEl.querySelector('.copy-btn')?.addEventListener('click', (e) => {
      const text = (e.target as HTMLElement).dataset.text || '';
      this.copyToClipboard(text);
      (e.target as HTMLElement).textContent = '✓ 已复制';
      setTimeout(() => (e.target as HTMLElement).textContent = '📋 复制', 2000);
    });

    replyEl.querySelector('.use-btn')?.addEventListener('click', (e) => {
      const text = (e.target as HTMLElement).dataset.text || '';
      this.useReply(text);
    });
  }

  /**
   * 设置回复加载状态
   */
  private setReplyLoading(loading: boolean): void {
    const btn = document.getElementById('generateReplyBtn') as HTMLButtonElement | null;
    if (btn) btn.disabled = loading;

    const container = document.getElementById('generatedReplies');
    if (!container) return;

    if (loading) {
      const loadingEl = document.createElement('div');
      loadingEl.id = 'replyLoading';
      loadingEl.className = 'reply-generating';
      loadingEl.innerHTML = '<div class="spinner"></div><span>Kimi 思考中...</span>';
      container.insertBefore(loadingEl, container.firstChild);
    } else {
      document.getElementById('replyLoading')?.remove();
    }
  }

  /**
   * 使用回复
   */
  private async useReply(text: string): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'FILL_REPLY', text });
        this.showToast('已填入回复框');
      }
    } catch {
      this.copyToClipboard(text);
      this.showToast('已复制，请手动粘贴');
    }
  }

  // ========== AI API 调用 ==========

  /**
   * 调用 AI API (支持 OpenAI 和 Kimi)
   */
  private async callAI<T>(prompt: string, jsonResponse: boolean = false): Promise<T> {
    const { apiProvider, apiKey, apiModel, apiBaseUrl } = this.settings;
    
    if (!apiKey) {
      throw new Error('API Key not configured');
    }

    // 确定 API endpoint 和模型
    let baseUrl: string;
    let model: string;
    
    if (apiBaseUrl) {
      // 使用自定义后端
      baseUrl = apiBaseUrl;
      model = apiModel;
    } else if (apiProvider === 'kimi') {
      // Kimi (Moonshot) API
      baseUrl = 'https://api.moonshot.cn/v1';
      model = apiModel.includes('moonshot') ? apiModel : 'moonshot-v1-8k';
    } else {
      // OpenAI API (默认)
      baseUrl = 'https://api.openai.com/v1';
      model = apiModel || 'gpt-4o-mini';
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: '你是语言学习助手，擅长语法纠正和自然表达。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        ...(jsonResponse && { response_format: { type: 'json_object' } })
      })
    });

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } };
      throw new Error(error.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json() as { choices: [{ message: { content: string } }] };
    const content = data.choices[0].message.content;
    return jsonResponse ? JSON.parse(content) as T : content as unknown as T;
  }

  // ========== UI 工具 ==========

  /**
   * 显示/隐藏设置面板
   */
  private showSettings(show: boolean): void {
    const panel = document.getElementById('settingsPanel');
    if (panel) {
      panel.classList.toggle('hidden', !show);
    }
  }

  /**
   * 显示空状态
   */
  private showEmptyState(): void {
    document.getElementById('emptyState')?.classList.remove('hidden');
    document.getElementById('loadingState')?.classList.add('hidden');
    document.getElementById('mainContent')?.classList.add('hidden');
  }

  /**
   * 显示/隐藏加载状态
   */
  private showLoading(show: boolean): void {
    document.getElementById('loadingState')?.classList.toggle('hidden', !show);
  }

  /**
   * 显示占位内容
   */
  private showPlaceholder(message: string): void {
    const placeholder = `<p style="color: var(--text-secondary)">${message}</p>`;
    const elements = ['translationText', 'tokenization', 'vocabulary', 'grammar', 'examples'];
    elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = placeholder;
    });
  }

  /**
   * 格式化时间
   */
  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return mins < 1 ? '刚刚' : `${mins}分钟前`;
    }
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return date.toLocaleDateString('zh-CN');
  }

  /**
   * 复制到剪贴板
   */
  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('已复制');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  /**
   * 显示提示
   */
  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 1000;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 启动
console.log('[Echo-X] Script loaded, waiting for DOM...');

function start() {
  console.log('[Echo-X] Starting...');
  try {
    const panel = new EchoXSidePanel();
    panel.init().then(() => {
      console.log('[Echo-X] Init success');
    }).catch(err => {
      console.error('[Echo-X] Init failed:', err);
      const errorEl = document.getElementById('errorDetail');
      if (errorEl) errorEl.textContent = '初始化失败: ' + err.message;
    });
  } catch (err) {
    console.error('[Echo-X] Fatal error:', err);
    const errorEl = document.getElementById('errorDetail');
    if (errorEl) errorEl.textContent = '致命错误: ' + (err as Error).message;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
