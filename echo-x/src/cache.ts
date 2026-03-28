// Echo-X 分析结果缓存系统
// 使用 IndexedDB 存储，避免重复分析浪费 token

const DB_NAME = 'EchoXCache';
const DB_VERSION = 2; // 升级以兼容 qa-history
const STORE_NAME = 'analysis_cache';

// 缓存条目接口
export interface CacheEntry {
  key: string;           // 缓存键（帖子内容 hash）
  url: string;           // 帖子 URL
  text: string;          // 帖子原文（前 200 字符用于显示）
  result: unknown;       // 分析结果
  timestamp: number;     // 缓存时间
  model: string;         // 使用的模型
  isReply?: boolean;     // 是否为回复
}

// 打开数据库
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      
      // 创建或更新 analysis_cache store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('url', 'url', { unique: false });
      }
      
      // 如果是从旧版本升级，确保 qa_history store 也存在（兼容性）
      if (oldVersion < 2 && !db.objectStoreNames.contains('qa_history')) {
        const qaStore = db.createObjectStore('qa_history', { keyPath: 'id' });
        qaStore.createIndex('timestamp', 'timestamp', { unique: false });
        qaStore.createIndex('postUrl', 'postUrl', { unique: false });
      }
    };
  });
}

// 生成内容 hash（简单的字符串 hash）
function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32bit 整数
  }
  return Math.abs(hash).toString(16);
}

function buildCacheKey(text: string, isReply: boolean = false): string {
  return hashContent(text) + (isReply ? ':reply' : '');
}

// 获取缓存
export async function getCachedAnalysis(text: string, isReply: boolean = false): Promise<CacheEntry | null> {
  try {
    const db = await openDB();
    const key = buildCacheKey(text, isReply);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result as CacheEntry | undefined;
        if (result) {
          console.log('[Echo-X Cache] Hit:', key);
        }
        resolve(result || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X Cache] Get error:', error);
    return null;
  }
}

// 保存缓存
export async function saveCachedAnalysis(
  text: string,
  url: string,
  result: unknown,
  model: string,
  isReply: boolean = false
): Promise<void> {
  try {
    const db = await openDB();
    const key = buildCacheKey(text, isReply);
    
    const entry: CacheEntry = {
      key,
      url,
      text: text.substring(0, 200),
      result,
      timestamp: Date.now(),
      model,
      isReply
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);
      
      request.onsuccess = () => {
        console.log('[Echo-X Cache] Saved:', key);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X Cache] Save error:', error);
  }
}

// 清空缓存
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('[Echo-X Cache] Cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X Cache] Clear error:', error);
  }
}

// 获取缓存统计
export async function getCacheStats(): Promise<{
  count: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        if (entries.length === 0) {
          resolve({ count: 0, oldestTimestamp: null, newestTimestamp: null });
          return;
        }
        
        const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b);
        resolve({
          count: entries.length,
          oldestTimestamp: timestamps[0],
          newestTimestamp: timestamps[timestamps.length - 1]
        });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X Cache] Stats error:', error);
    return { count: 0, oldestTimestamp: null, newestTimestamp: null };
  }
}

// 删除指定缓存
export async function deleteCachedAnalysis(text: string, isReply: boolean = false): Promise<void> {
  try {
    const db = await openDB();
    const key = buildCacheKey(text, isReply);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X Cache] Delete error:', error);
  }
}
