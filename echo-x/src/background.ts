// Echo-X Background Service Worker (TypeScript 版本)

import type { ExtensionSettings } from './types/index.js';

// 默认设置
const DEFAULT_SETTINGS: ExtensionSettings = {
  apiProvider: 'openai',
  apiKey: '',
  apiModel: 'gpt-4o-mini',
  apiBaseUrl: '',
  targetLanguage: 'zh-CN',
  nativeLanguage: 'zh-CN',
  learningLanguage: 'auto',
  autoAnalyze: true
};

// 重新导出类型供使用
export type { ExtensionSettings };

/**
 * 点击扩展图标时打开侧边栏
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

/**
 * 消息路由
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // 转发提取相关的消息到 side panel
  if (message.type === 'POST_EXTRACTED' || 
      message.type === 'EXTRACTION_ERROR' ||
      message.type === 'ANALYSIS_COMPLETE') {
    // 转发到所有 side panel 实例
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel 可能未打开，忽略错误
    });
  }

  // 从 side panel 到 content script 的消息
  if (message.type === 'GET_CURRENT_POST' ||
      message.type === 'ANALYZE_POST') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch((error) => {
          sendResponse({ error: error.message });
        });
      }
    });
    return true; // 保持通道开放
  }

  return false;
});

/**
 * 初始化默认设置
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set(DEFAULT_SETTINGS);
  console.log('[Echo-X] Extension installed, default settings saved');
});
