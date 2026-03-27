# Icons 文件夹

需要以下尺寸的 PNG 图标：
- icon16.png (16x16)
- icon32.png (32x32)  
- icon48.png (48x48)
- icon128.png (128x128)

## 快速生成图标

### 方法 1: 使用在线工具
1. 访问 https://favicon.io/favicon-generator/
2. 选择背景色: `#0f0f0f` (深色)
3. 选择文字颜色: `#1d9bf0` (蓝色)
4. 输入文字: "E" 或 "📚"
5. 下载所有尺寸

### 方法 2: 使用 Figma
1. 打开 https://www.figma.com/
2. 创建 128x128 的画布
3. 设计你的图标
4. 导出为 PNG

### 方法 3: 使用现有图标
从 icon.svg 转换：
```bash
# 如果你有 ImageMagick
convert -background none icon.svg -resize 128x128 icon128.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 32x32 icon32.png
convert -background none icon.svg -resize 16x16 icon16.png
```

## 图标设计建议

Echo-X 的品牌元素：
- **主色**: `#1d9bf0` (X 蓝色)
- **强调色**: `#8b5cf6` (紫色)
- **背景**: `#0f0f0f` (深色)
- **概念**: 声波、回声、学习、对话气泡
