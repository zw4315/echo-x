// Echo-X Q&A 历史记录
// 保存在 IndexedDB，用于复习，不受强制刷新影响

const DB_NAME = 'EchoXCache';
const DB_VERSION = 2; // 升级版本以添加新的 store
const QA_STORE_NAME = 'qa_history';

// Q&A 记录接口
export interface QARecord {
  id: string;           // 唯一 ID
  postUrl: string;      // 帖子 URL
  postText: string;     // 帖子原文（前 200 字）
  question: string;     // 用户问题
  answer: string;       // AI 回答
  references?: string[]; // 引用内容
  timestamp: number;    // 时间戳
  model: string;        // 使用的模型
}

// 打开数据库（带升级处理）
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 创建 Q&A 历史存储
      if (!db.objectStoreNames.contains(QA_STORE_NAME)) {
        const store = db.createObjectStore(QA_STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('postUrl', 'postUrl', { unique: false });
      }
    };
  });
}

// 生成唯一 ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 保存 Q&A 记录
export async function saveQARecord(record: Omit<QARecord, 'id' | 'timestamp'>): Promise<QARecord> {
  try {
    const db = await openDB();
    
    const fullRecord: QARecord = {
      ...record,
      id: generateId(),
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([QA_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QA_STORE_NAME);
      const request = store.add(fullRecord);
      
      request.onsuccess = () => {
        console.log('[Echo-X QA] Saved:', fullRecord.id);
        resolve(fullRecord);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X QA] Save error:', error);
    throw error;
  }
}

// 获取当前帖子的所有 Q&A 记录
export async function getQAHistoryByUrl(postUrl: string): Promise<QARecord[]> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([QA_STORE_NAME], 'readonly');
      const store = transaction.objectStore(QA_STORE_NAME);
      const index = store.index('postUrl');
      const request = index.getAll(postUrl);
      
      request.onsuccess = () => {
        const records = request.result as QARecord[];
        // 按时间倒序排列
        records.sort((a, b) => b.timestamp - a.timestamp);
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X QA] Get history error:', error);
    return [];
  }
}

// 获取所有 Q&A 记录
export async function getAllQAHistory(): Promise<QARecord[]> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([QA_STORE_NAME], 'readonly');
      const store = transaction.objectStore(QA_STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const records = request.result as QARecord[];
        records.sort((a, b) => b.timestamp - a.timestamp);
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X QA] Get all history error:', error);
    return [];
  }
}

// 删除单条 Q&A 记录
export async function deleteQARecord(id: string): Promise<void> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([QA_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QA_STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log('[Echo-X QA] Deleted:', id);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X QA] Delete error:', error);
    throw error;
  }
}

// 清空所有 Q&A 记录
export async function clearQAHistory(): Promise<void> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([QA_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QA_STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('[Echo-X QA] All history cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Echo-X QA] Clear error:', error);
    throw error;
  }
}

// 获取 Q&A 统计
export async function getQAStats(): Promise<{
  totalCount: number;
  todayCount: number;
  postCount: number;
}> {
  try {
    const records = await getAllQAHistory();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    const uniquePosts = new Set(records.map(r => r.postUrl));
    
    return {
      totalCount: records.length,
      todayCount: records.filter(r => r.timestamp >= todayTimestamp).length,
      postCount: uniquePosts.size
    };
  } catch (error) {
    console.error('[Echo-X QA] Stats error:', error);
    return { totalCount: 0, todayCount: 0, postCount: 0 };
  }
}
