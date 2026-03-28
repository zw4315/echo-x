// Echo-X Background Service Worker

// 点击扩展图标时打开侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// 消息路由
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 转发提取相关的消息到 side panel
  if (message.type === 'POST_EXTRACTED' || 
      message.type === 'EXTRACTION_ERROR' ||
      message.type === 'ANALYSIS_COMPLETE') {
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel 可能未打开，忽略错误
    });
  }

  // 从 side panel 到 content script 的消息
  if (message.type === 'GET_CURRENT_POST' ||
      message.type === 'ANALYZE_POST') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch((error) => {
          sendResponse({ error: error.message });
        });
      }
    });
    return true;
  }

  return false;
});

// 初始化默认设置
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    apiProvider: 'openai', // 默认使用 OpenAI
    apiModel: 'gpt-4o-mini',
    targetLanguage: 'zh-CN', // 翻译目标语言
    nativeLanguage: 'zh-CN', // 用户母语
    learningLanguage: 'auto', // 学习的语言，auto 表示自动检测
    autoAnalyze: true // 是否自动分析
  });
});
