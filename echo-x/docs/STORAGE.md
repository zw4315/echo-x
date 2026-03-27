# Echo-X 存储技术说明

## IndexedDB vs SQLite

| 特性 | IndexedDB | SQLite |
|------|-----------|--------|
| 类型 | NoSQL (对象存储) | 关系型数据库 |
| API | JavaScript 原生 | 需要 C 驱动 |
| 存储格式 | 对象/二进制 | 结构化表 |
| 查询 | 键值 + 索引 | SQL 语句 |
| 事务 | 支持 | 支持 |

**结论**: IndexedDB 不是 SQLite，它是浏览器内置的 NoSQL 数据库

## Echo-X 实际使用的存储

```typescript
// 代码中使用的是 Chrome Storage API，不是直接 IndexedDB
chrome.storage.local.set({ settings: {...} })
chrome.storage.local.get(['settings'])
```

Chrome Storage API 底层可能使用 IndexedDB，但开发者无需关心。

## 存储位置

### Windows
```
%LocalAppData%\Microsoft\Edge\User Data\Default\Local Storage\
%LocalAppData%\Microsoft\Edge\User Data\Default\IndexedDB\
```

### macOS
```
~/Library/Application Support/Microsoft Edge/Default/Local Storage/
~/Library/Application Support/Microsoft Edge/Default/IndexedDB/
```

### 查找具体位置
1. Edge 地址栏输入: `edge://version/`
2. 查看「个人资料路径」
3. 在该目录下找 `Local Storage` 或 `IndexedDB`

## 存储限制

| 存储类型 | 限制 | 说明 |
|----------|------|------|
| chrome.storage.local | 5MB | 可扩展到 unlimited |
| chrome.storage.sync | 100KB | 同步到 Google/Microsoft 账号 |
| IndexedDB (直接) | 磁盘 50% | 需申请权限 |

## 数据备份/导出

```javascript
// 在扩展的 DevTools Console 执行
chrome.storage.local.get(null, (data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'echo-x-backup.json';
  a.click();
});
```

## Sprint 2 计划

后续会添加自动备份功能，支持:
- 定期导出到本地文件
- 可选的云端同步
- 数据迁移工具
