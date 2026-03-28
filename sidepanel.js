// Echo-X MVP - Side Panel Logic
// Sprint 1: 最小可用版本

class EchoXSidePanel {
  constructor() {
    this.settings = {
      apiKey: '',
      apiModel: 'gpt-4o-mini',
      targetLanguage: 'zh-CN',
      learningLanguage: 'auto'
    };
    this.currentPost = null;
    this.analysisResult = null;
    this.selectedTone = 'friendly';
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.initEventListeners();
    this.initReplyAssistant();
    this.checkAndExtract();
  }

  // ========== 设置管理 ==========
  async loadSettings() {
    const result = await chrome.storage.local.get([
      'apiKey', 'apiModel', 'targetLanguage', 'learningLanguage'
    ]);
    this.settings = { ...this.settings, ...result };
    
    // 更新表单
    const apiKeyEl = document.getElementById('apiKey');
    const aiModelEl = document.getElementById('aiModel');
    const learningLangEl = document.getElementById('learningLanguage');
    const targetLangEl = document.getElementById('targetLanguage');
    
    if (apiKeyEl) apiKeyEl.value = this.settings.apiKey || '';
    if (aiModelEl) aiModelEl.value = this.settings.apiModel;
    if (learningLangEl) learningLangEl.value = this.settings.learningLanguage;
    if (targetLangEl) targetLangEl.value = this.settings.targetLanguage;
  }

  async saveSettings() {
    this.settings = {
      apiKey: document.getElementById('apiKey').value.trim(),
      apiModel: document.getElementById('aiModel').value,
      learningLanguage: document.getElementById('learningLanguage').value,
      targetLanguage: document.getElementById('targetLanguage').value
    };
    
    await chrome.storage.local.set(this.settings);
    this.showSettings(false);
    this.showToast('设置已保存');
    
    if (this.currentPost && this.settings.apiKey) {
      this.analyzePost();
    }
  }

  // ========== 事件监听 ==========
  initEventListeners() {
    // 设置面板
    document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettings(true));
    document.getElementById('closeSettings')?.addEventListener('click', () => this.showSettings(false));
    document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());
    
    // 刷新
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.checkAndExtract());
    
    // 复制
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

  initReplyAssistant() {
    // 语气选择
    document.querySelectorAll('.reply-tone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.reply-tone-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTone = btn.dataset.tone;
      });
    });
    document.querySelector('[data-tone="friendly"]')?.classList.add('active');

    // 生成回复
    document.getElementById('generateReplyBtn')?.addEventListener('click', () => this.generateReply());
    document.getElementById('quickReplyBtn')?.addEventListener('click', () => this.quickReply());

    // 回车发送
    document.getElementById('replyInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.generateReply();
      }
    });
  }

  // ========== 帖子提取 ==========
  async checkAndExtract() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const url = tab.url || '';
      const isValidPage = url.includes('x.com/') && url.includes('/status/');

      if (!isValidPage) {
        this.showEmptyState();
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_POST' });
      
      if (response.success) {
        this.handlePostExtracted(response.data);
      } else {
        this.handleError(response.error);
      }
    } catch (error) {
      if (error.message.includes('Could not establish connection')) {
        await this.injectContentScript();
      } else {
        console.error('[Echo-X] Error:', error);
      }
    }
  }

  async injectContentScript() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      setTimeout(() => this.checkAndExtract(), 500);
    } catch (error) {
      this.handleError('无法初始化扩展，请刷新页面后重试');
    }
  }

  handlePostExtracted(data) {
    this.currentPost = data;
    this.renderPost(data);
    
    if (this.settings.apiKey) {
      this.analyzePost();
    } else {
      this.showPlaceholder('请在设置中配置 OpenAI API Key');
    }
  }

  handleError(error) {
    console.error('[Echo-X]', error);
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
      emptyState.querySelector('h3').textContent = '出错了';
      emptyState.querySelector('p').textContent = typeof error === 'string' ? error : '请确保你在 X 帖子页面';
      this.showEmptyState();
    }
  }

  renderPost(data) {
    document.getElementById('emptyState')?.classList.add('hidden');
    document.getElementById('loadingState')?.classList.add('hidden');
    document.getElementById('mainContent')?.classList.remove('hidden');

    document.getElementById('authorName').textContent = data.author.displayName;
    document.getElementById('authorHandle').textContent = `@${data.author.handle}`;
    document.getElementById('postTime').textContent = this.formatTime(data.timestamp);
    document.getElementById('originalText').textContent = data.text;

    // 图片
    const imagesContainer = document.getElementById('postImages');
    if (imagesContainer) {
      imagesContainer.innerHTML = '';
      if (data.images?.length > 0) {
        data.images.forEach(img => {
          const imgEl = document.createElement('img');
          imgEl.src = img.url;
          imgEl.alt = img.alt || '';
          imagesContainer.appendChild(imgEl);
        });
      }
    }
  }

  // ========== AI 分析 ==========
  async analyzePost() {
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

      this.analysisResult = await this.callAI(prompt, true);
      this.renderAnalysis(this.analysisResult);
    } catch (error) {
      console.error('[Echo-X] Analysis error:', error);
      this.showPlaceholder('分析失败，请检查 API Key');
    } finally {
      this.showLoading(false);
    }
  }

  renderAnalysis(result) {
    // 翻译
    const translationEl = document.getElementById('translationText');
    if (translationEl) translationEl.textContent = result.translation || '暂无翻译';

    // 分词
    const tokenContainer = document.getElementById('tokenization');
    if (tokenContainer) {
      tokenContainer.innerHTML = result.tokenization?.map(t => `
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
      vocabCount.textContent = result.vocabulary.length;
      vocabContainer.innerHTML = result.vocabulary.map(v => `
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
      grammarContainer.innerHTML = result.grammar?.map(g => `
        <div class="grammar-item">
          <div class="grammar-pattern">${g.pattern}</div>
          <div class="grammar-explanation">${g.explanation}</div>
        </div>
      `).join('') || '<p style="color: var(--text-secondary)">暂无语法要点</p>';
    }

    // 例句
    const examplesContainer = document.getElementById('examples');
    if (examplesContainer) {
      examplesContainer.innerHTML = result.examples?.map(e => `
        <div class="example-item">
          <div class="example-sentence">${e.sentence}</div>
          <div class="example-translation">${e.translation}</div>
          <div class="example-context">📍 ${e.context}</div>
        </div>
      `).join('') || '<p style="color: var(--text-secondary)">暂无例句</p>';
    }
  }

  // ========== 回复助手 ==========
  async generateReply() {
    const input = document.getElementById('replyInput')?.value.trim();
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
      const toneMap = {
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

      const result = await this.callAI(prompt, true);
      this.displayGeneratedReply(result);
      document.getElementById('replyInput').value = '';
    } catch (error) {
      this.showToast('生成失败: ' + error.message);
    } finally {
      this.setReplyLoading(false);
    }
  }

  async quickReply() {
    if (!this.settings.apiKey) {
      this.showToast('请先配置 API Key');
      return;
    }

    this.setReplyLoading(true);

    try {
      const toneMap = {
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

      const result = await this.callAI(prompt, true);
      this.displayGeneratedReply(result);
    } catch (error) {
      this.showToast('生成失败: ' + error.message);
    } finally {
      this.setReplyLoading(false);
    }
  }

  displayGeneratedReply(reply) {
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
    replyEl.querySelector('.copy-btn').addEventListener('click', (e) => {
      this.copyToClipboard(e.target.dataset.text);
      e.target.textContent = '✓ 已复制';
      setTimeout(() => e.target.textContent = '📋 复制', 2000);
    });

    replyEl.querySelector('.use-btn').addEventListener('click', (e) => {
      this.useReply(e.target.dataset.text);
    });
  }

  setReplyLoading(loading) {
    const btn = document.getElementById('generateReplyBtn');
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

  async useReply(text) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { type: 'FILL_REPLY', text });
        this.showToast('已填入回复框');
      }
    } catch {
      this.copyToClipboard(text);
      this.showToast('已复制，请手动粘贴');
    }
  }

  // ========== AI API 调用 ==========
  async callAI(prompt, jsonResponse = false) {
    const { apiKey, apiModel } = this.settings;
    
    if (!apiKey) throw new Error('API Key not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: apiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '你是语言学习助手，擅长语法纠正和自然表达。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        ...(jsonResponse && { response_format: { type: 'json_object' } })
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return jsonResponse ? JSON.parse(content) : content;
  }

  // ========== UI 工具 ==========
  showSettings(show) {
    const panel = document.getElementById('settingsPanel');
    if (panel) {
      panel.classList.toggle('hidden', !show);
    }
  }

  showEmptyState() {
    document.getElementById('emptyState')?.classList.remove('hidden');
    document.getElementById('loadingState')?.classList.add('hidden');
    document.getElementById('mainContent')?.classList.add('hidden');
  }

  showLoading(show) {
    document.getElementById('loadingState')?.classList.toggle('hidden', !show);
  }

  showPlaceholder(message) {
    const placeholder = `<p style="color: var(--text-secondary)">${message}</p>`;
    document.getElementById('translationText').innerHTML = placeholder;
    document.getElementById('tokenization').innerHTML = placeholder;
    document.getElementById('vocabulary').innerHTML = placeholder;
    document.getElementById('grammar').innerHTML = placeholder;
    document.getElementById('examples').innerHTML = placeholder;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return mins < 1 ? '刚刚' : `${mins}分钟前`;
    }
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return date.toLocaleDateString('zh-CN');
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('已复制');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  showToast(message) {
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 启动
document.readyState === 'loading' 
  ? document.addEventListener('DOMContentLoaded', () => new EchoXSidePanel())
  : new EchoXSidePanel();
