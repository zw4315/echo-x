// Echo-X 语音朗读功能
// 使用 Web Speech API，支持多语言

let synth: SpeechSynthesis | null = null;
let isSpeaking = false;
let detectedLanguage = 'en-US'; // 默认英语

// 语言代码映射 (ISO 639-1 -> Web Speech API locale)
const LANGUAGE_MAP: Record<string, string> = {
  'ja': 'ja-JP',      // 日语
  'en': 'en-US',      // 英语
  'ko': 'ko-KR',      // 韩语
  'zh': 'zh-CN',      // 中文
  'es': 'es-ES',      // 西班牙语
  'fr': 'fr-FR',      // 法语
  'de': 'de-DE',      // 德语
  'it': 'it-IT',      // 意大利语
  'ru': 'ru-RU',      // 俄语
  'pt': 'pt-BR',      // 葡萄牙语
  'ar': 'ar-SA',      // 阿拉伯语
  'hi': 'hi-IN',      // 印地语
  'th': 'th-TH',      // 泰语
  'vi': 'vi-VN',      // 越南语
  'pl': 'pl-PL',      // 波兰语
  'tr': 'tr-TR',      // 土耳其语
  'nl': 'nl-NL',      // 荷兰语
};

// 初始化
export function initSpeech(): boolean {
  if (typeof window === 'undefined') return false;
  
  synth = window.speechSynthesis;
  return !!synth;
}

// 检查是否支持语音
export function isSpeechSupported(): boolean {
  return !!window.speechSynthesis;
}

// 设置检测到的语言
export function setDetectedLanguage(lang: string): void {
  const code = lang.split('-')[0].toLowerCase();
  detectedLanguage = LANGUAGE_MAP[code] || 'en-US';
  console.log('[Echo-X Speech] Language set to:', detectedLanguage);
}

// 获取当前语言
export function getCurrentLanguage(): string {
  return detectedLanguage;
}

// 朗读文本
export function speak(text: string, lang?: string, onEnd?: () => void): boolean {
  if (!synth && !initSpeech()) {
    console.error('[Echo-X Speech] Speech synthesis not supported');
    return false;
  }
  
  // 使用指定语言或当前检测的语言
  const targetLang = lang || detectedLanguage;
  
  console.log('[Echo-X Speech] Speaking:', text.substring(0, 30) + '...', 'Language:', targetLang);
  
  // 如果正在朗读，先停止
  stop();
  
  // 创建 utterance
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = targetLang;
  utterance.rate = 0.85; // 稍慢一点，便于学习
  utterance.pitch = 1;
  
  // 事件监听
  utterance.onstart = () => {
    isSpeaking = true;
    updateSpeakingUI(text, true);
  };
  
  utterance.onend = () => {
    isSpeaking = false;
    updateSpeakingUI(text, false);
    onEnd?.();
  };
  
  utterance.onerror = (e) => {
    console.error('[Echo-X Speech] Error:', e);
    isSpeaking = false;
    updateSpeakingUI(text, false);
  };
  
  synth!.speak(utterance);
  
  return true;
}

// 停止朗读
export function stop(): void {
  if (synth) {
    synth.cancel();
    isSpeaking = false;
  }
}

// 暂停/继续
export function pause(): void {
  if (synth && isSpeaking) {
    synth.pause();
  }
}

export function resume(): void {
  if (synth) {
    synth.resume();
  }
}

// 更新朗读按钮的 UI 状态
function updateSpeakingUI(text: string, speaking: boolean) {
  document.querySelectorAll('.speech-btn').forEach(btn => {
    const button = btn as HTMLButtonElement;
    const btnText = button.dataset.text;
    
    if (btnText && text.includes(btnText.substring(0, 20))) {
      button.classList.toggle('speaking', speaking);
      button.innerHTML = speaking ? getPauseIcon() : getPlayIcon();
      button.title = speaking ? '点击停止' : '点击朗读';
    } else if (!speaking) {
      button.classList.remove('speaking');
      button.innerHTML = getPlayIcon();
      button.title = '点击朗读';
    }
  });
}

// 获取播放图标
function getPlayIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>`;
}

// 获取暂停图标
function getPauseIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>`;
}

// 创建朗读按钮
export function createSpeechButton(text: string, lang?: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'speech-btn';
  btn.dataset.text = text;
  btn.dataset.lang = lang || detectedLanguage;
  btn.innerHTML = getPlayIcon();
  btn.title = '点击朗读';
  
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (btn.classList.contains('speaking')) {
      stop();
    } else {
      speak(text, lang || detectedLanguage);
    }
  });
  
  return btn;
}

// 更新所有朗读按钮的语言设置
export function updateAllSpeechButtonsLanguage(lang: string): void {
  const targetLang = lang || detectedLanguage;
  console.log('[Echo-X Speech] Updating all buttons to:', targetLang);
  
  document.querySelectorAll('.speech-btn').forEach(btn => {
    const button = btn as HTMLButtonElement;
    button.dataset.lang = targetLang;
  });
}
