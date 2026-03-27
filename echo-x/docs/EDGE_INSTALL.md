# Edge 浏览器安装指南

## 开发者模式加载 (推荐)

1. **打开扩展页面**
   - 在 Edge 地址栏输入: `edge://extensions/`
   - 或点击菜单 → 扩展 → 管理扩展

2. **开启开发者模式**
   - 打开左下角的「开发人员模式」开关

3. **加载扩展**
   - 点击「加载解压缩的扩展」按钮
   - 选择 `echo-x/dist` 文件夹

4. **固定到工具栏**
   - 点击工具栏的拼图图标 🧩
   - 找到 Echo-X，点击「固定」

## 打包安装 (分享给朋友)

```bash
# 1. 先构建
cd /Users/edwardwu/repo/echo-x/echo-x
npm run build

# 2. 在 edge://extensions/ 点击「打包扩展」
# 3. 选择 dist 文件夹
# 4. 生成 echo-x.crx 和 echo-x.pem
# 5. 拖拽 .crx 文件到 Edge 即可安装
```

## 与 Chrome 的区别

| 功能 | Chrome | Edge |
|------|--------|------|
| 扩展页面 | `chrome://extensions/` | `edge://extensions/` |
| 同步 | Google 账号 | Microsoft 账号 |
| 兼容性 | 100% | 100% (都是 Chromium) |
