// Echo-X 分析结果渲染器
// 负责渲染 AI 分析结果：翻译、分词、词汇、语法

import { AnalysisResult, TokenItem, VocabularyItem, GrammarItem } from '../../types/index.js';
import { createSpeechButton, isSpeechSupported, getCurrentLanguage } from '../../utils/speech.js';
import { escapeHtml, renderRubyText, getLevelClass } from './dom.js';

/**
 * 渲染完整分析结果
 */
export function renderAnalysis(result: AnalysisResult): void {
  renderTranslation(result);
  renderTokens(result.tokens);
  renderVocabulary(result.vocabulary);
  renderGrammar(result.grammar);
  renderSuggestions(result.suggestions);
}

/**
 * 渲染翻译区域
 */
function renderTranslation(result: AnalysisResult): void {
  const translationEl = document.getElementById('translationText');
  if (translationEl) {
    translationEl.innerHTML = `
      <div style="color:var(--text-secondary);font-size:12px;margin-bottom:4px;">难度: ${escapeHtml(result.difficulty || '')}</div>
      <div>${escapeHtml(result.translation || '')}</div>
    `;
  }
}

/**
 * 渲染分词
 */
function renderTokens(tokens: TokenItem[] | undefined): void {
  const tokenizationEl = document.getElementById('tokenization');
  if (!tokenizationEl || !tokens) return;
  
  tokenizationEl.innerHTML = '';
  
  tokens.forEach(t => {
    const tokenDiv = document.createElement('div');
    tokenDiv.className = 'token';
    
    // 单词和朗读按钮容器
    const wordContainer = document.createElement('div');
    wordContainer.className = 'token-word-container';
    
    const wordSpan = document.createElement('span');
    wordSpan.className = 'token-word';
    wordSpan.textContent = t.word;
    wordContainer.appendChild(wordSpan);
    
    // 添加朗读按钮
    if (isSpeechSupported()) {
      const speechBtn = createSpeechButton(t.word, getCurrentLanguage());
      speechBtn.classList.add('token-speech-btn');
      wordContainer.appendChild(speechBtn);
    }
    
    tokenDiv.appendChild(wordContainer);
    
    // 读音
    if (t.reading) {
      const readingSpan = document.createElement('span');
      readingSpan.className = 'token-reading';
      readingSpan.textContent = t.reading;
      tokenDiv.appendChild(readingSpan);
    }
    
    // 词性
    const posSpan = document.createElement('span');
    posSpan.className = 'token-pos';
    posSpan.textContent = t.pos || '';
    tokenDiv.appendChild(posSpan);
    
    // 含义
    const meaningSpan = document.createElement('span');
    meaningSpan.className = 'token-meaning';
    meaningSpan.textContent = t.meaning;
    tokenDiv.appendChild(meaningSpan);
    
    tokenizationEl.appendChild(tokenDiv);
  });
}

/**
 * 渲染词汇
 */
function renderVocabulary(vocabulary: VocabularyItem[] | undefined): void {
  const vocabularyEl = document.getElementById('vocabulary');
  const vocabCount = document.getElementById('vocabCount');
  if (!vocabularyEl) return;
  
  if (vocabCount) vocabCount.textContent = String(vocabulary?.length || 0);
  vocabularyEl.innerHTML = '';
  
  if (!vocabulary) return;
  
  vocabulary.forEach(v => {
    const vocabDiv = document.createElement('div');
    vocabDiv.className = 'vocab-item';
    
    // 单词和朗读按钮
    const wordDiv = document.createElement('div');
    wordDiv.className = 'vocab-word-container';
    
    const wordSpan = document.createElement('span');
    wordSpan.className = 'vocab-word';
    wordSpan.textContent = v.word;
    wordDiv.appendChild(wordSpan);
    
    if (isSpeechSupported()) {
      const speechBtn = createSpeechButton(v.word, getCurrentLanguage());
      speechBtn.classList.add('vocab-speech-btn');
      wordDiv.appendChild(speechBtn);
    }
    
    const levelSpan = document.createElement('span');
    levelSpan.className = `vocab-level ${getLevelClass(v.level)}`;
    levelSpan.textContent = v.level;
    wordDiv.appendChild(levelSpan);
    
    vocabDiv.appendChild(wordDiv);
    
    // 含义
    const meaningDiv = document.createElement('div');
    meaningDiv.className = 'vocab-meaning';
    meaningDiv.textContent = v.meaning;
    vocabDiv.appendChild(meaningDiv);
    
    // 例句
    if (v.example) {
      const exampleDiv = document.createElement('div');
      exampleDiv.className = 'vocab-example';
      
      const exampleTextRow = document.createElement('div');
      exampleTextRow.className = 'vocab-example-text';
      
      if (v.exampleReading) {
        const rubyContainer = document.createElement('span');
        rubyContainer.className = 'vocab-ruby-text';
        renderRubyText(rubyContainer, v.example, v.exampleReading);
        exampleTextRow.appendChild(rubyContainer);
      } else {
        exampleTextRow.textContent = v.example;
      }
      
      if (isSpeechSupported()) {
        const exampleSpeechBtn = createSpeechButton(v.example, getCurrentLanguage());
        exampleSpeechBtn.classList.add('example-speech-btn');
        exampleTextRow.appendChild(exampleSpeechBtn);
      }
      
      exampleDiv.appendChild(exampleTextRow);
      
      if (v.exampleTranslation) {
        const translationDiv = document.createElement('div');
        translationDiv.className = 'vocab-example-translation';
        translationDiv.textContent = v.exampleTranslation;
        exampleDiv.appendChild(translationDiv);
      }
      
      vocabDiv.appendChild(exampleDiv);
    }
    
    vocabularyEl.appendChild(vocabDiv);
  });
}

/**
 * 渲染语法
 */
function renderGrammar(grammar: GrammarItem[] | undefined): void {
  const grammarEl = document.getElementById('grammar');
  if (!grammarEl || !grammar) return;
  
  grammarEl.innerHTML = '';
  
  grammar.forEach(g => {
    const grammarDiv = document.createElement('div');
    grammarDiv.className = 'grammar-item';
    
    // 语法结构
    const patternDiv = document.createElement('div');
    patternDiv.className = 'grammar-pattern';
    patternDiv.textContent = g.pattern;
    
    if (isSpeechSupported()) {
      const patternSpeechBtn = createSpeechButton(g.pattern, getCurrentLanguage());
      patternSpeechBtn.classList.add('grammar-speech-btn');
      patternDiv.appendChild(patternSpeechBtn);
    }
    
    grammarDiv.appendChild(patternDiv);
    
    // 解释
    const explanationDiv = document.createElement('div');
    explanationDiv.className = 'grammar-explanation';
    explanationDiv.textContent = g.explanation;
    grammarDiv.appendChild(explanationDiv);
    
    // 例句
    if (g.example) {
      const exampleDiv = document.createElement('div');
      exampleDiv.className = 'grammar-example';
      
      if (g.exampleReading) {
        const rubyContainer = document.createElement('span');
        rubyContainer.className = 'grammar-ruby-text';
        renderRubyText(rubyContainer, g.example, g.exampleReading);
        exampleDiv.appendChild(rubyContainer);
      } else {
        const exampleText = document.createElement('span');
        exampleText.className = 'grammar-example-text';
        exampleText.textContent = g.example;
        exampleDiv.appendChild(exampleText);
      }
      
      if (isSpeechSupported()) {
        const exampleSpeechBtn = createSpeechButton(g.example, getCurrentLanguage());
        exampleSpeechBtn.classList.add('example-speech-btn');
        exampleDiv.appendChild(exampleSpeechBtn);
      }
      
      grammarDiv.appendChild(exampleDiv);
    }
    
    grammarEl.appendChild(grammarDiv);
  });
}

/**
 * 渲染建议
 */
function renderSuggestions(suggestions: string[] | undefined): void {
  const suggestionsEl = document.getElementById('suggestions');
  if (!suggestionsEl || !suggestions) return;
  
  suggestionsEl.innerHTML = suggestions.map(s => `
    <div class="suggestion-item">💡 ${escapeHtml(s)}</div>
  `).join('');
}

/**
 * 显示分析加载状态
 */
export function showAnalysisLoading(loading: boolean): void {
  const tokenizationEl = document.getElementById('tokenization');
  if (tokenizationEl) {
    tokenizationEl.style.opacity = loading ? '0.5' : '1';
  }
}

/**
 * 显示分析错误
 */
export function showAnalysisError(error: string): void {
  const translationEl = document.getElementById('translationText');
  if (translationEl) {
    translationEl.textContent = `AI 分析失败: ${error}`;
    translationEl.setAttribute('style', 'color:#f00;');
  }
}

/**
 * 清空分析结果
 */
export function clearAnalysis(): void {
  const translationEl = document.getElementById('translationText');
  if (translationEl) translationEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:16px 0;">分析中...</div>';
  
  const tokenizationEl = document.getElementById('tokenization');
  if (tokenizationEl) tokenizationEl.innerHTML = '';
  
  const vocabularyEl = document.getElementById('vocabulary');
  if (vocabularyEl) vocabularyEl.innerHTML = '';
  
  const grammarEl = document.getElementById('grammar');
  if (grammarEl) grammarEl.innerHTML = '';
  
  const suggestionsEl = document.getElementById('suggestions');
  if (suggestionsEl) suggestionsEl.innerHTML = '';
}
