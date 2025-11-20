# AI智能行程规划页面说明

## 📱 页面概览

新增了一个美观、专业的AI智能行程规划页面，提供完整的旅行规划表单和智能化体验。

## 🎨 设计特点

### 1. 渐变色主题
- **主色调**: 紫色渐变 (#667eea → #764ba2)
- **卡片式设计**: 白色卡片 + 柔和阴影
- **圆角元素**: 16rpx 圆角，现代化UI

### 2. 视觉层次
- **顶部导航**: 渐变色背景 + 白色文字
- **表单区域**: 白色卡片布局，清晰分组
- **底部按钮**: 固定底部，双按钮设计

### 3. 交互体验
- **实时反馈**: 输入框聚焦高亮
- **状态切换**: 复选框、单选框动画
- **加载状态**: 按钮loading效果

## ✨ 功能特性

### 表单字段

#### 1. 必填项
- ✅ **目的地** - 文本输入
  - 占位符: "例如：北京、上海、杭州"
  - 支持多个城市输入

- ✅ **旅行天数** - 选择器
  - 选项: 1天～10天以上
  - 下拉选择交互

- ✅ **出行人数** - 数字输入
  - 数字键盘
  - 正整数验证

- ✅ **预算（元）** - 数字输入
  - 数字键盘
  - 金额验证

#### 2. 可选项

- **兴趣偏好** - 多选
  - 文化历史 🏛️
  - 自然风光 🏔️
  - 美食体验 🍜
  - 购物娱乐 🛍️
  - 冒险探索 🧗
  - 放松度假 🏖️
  - 多选复选框，渐变高亮

- **旅行风格** - 单选
  - 轻奢型 💎
  - 舒适享受 ⭐
  - 奢华体验 👑
  - 单选按钮，渐变激活

- **特殊要求** - 多行文本
  - 200字限制
  - 实时字数统计
  - 占位符提示

## 💡 使用流程

### 1. 进入页面
```javascript
// 从首页点击"AI智能规划"
wx.navigateTo({
  url: '/pages/ai-plan/ai-plan'
})
```

### 2. 填写表单
- 输入目的地、天数、人数、预算（必填）
- 选择兴趣偏好和旅行风格（可选）
- 填写特殊要求（可选）

### 3. 提交规划
- 点击"开始规划"按钮
- 系统自动验证表单
- 未登录自动跳转登录页

### 4. AI生成
- 显示"AI正在规划中..."加载状态
- 调用AI服务生成行程
- 自动保存到数据库

### 5. 查看结果
- 弹窗显示AI规划内容
- 可以复制完整内容
- 返回首页查看"我的行程"

## 🔧 技术实现

### 组件结构
```
pages/ai-plan/
├── ai-plan.wxml   - 页面结构
├── ai-plan.wxss   - 样式文件
├── ai-plan.js     - 逻辑代码
└── ai-plan.json   - 页面配置
```

### 关键代码

#### 1. 表单验证
```javascript
validateForm() {
  const { destination, days, travelers, budget } = this.data.formData

  if (!destination.trim()) {
    wx.showToast({ title: '请输入目的地', icon: 'none' })
    return false
  }

  if (!days) {
    wx.showToast({ title: '请选择旅行天数', icon: 'none' })
    return false
  }

  // ... 其他验证
  return true
}
```

#### 2. AI提示词生成
```javascript
generatePrompt() {
  const { destination, days, travelers, budget } = this.data.formData
  
  const selectedInterests = this.data.interests
    .filter(item => item.checked)
    .map(item => item.label)
    .join('、')

  let prompt = `我想去${destination}旅行，计划${days}，${travelers}人出行，预算${budget}元。`
  
  if (selectedInterests) {
    prompt += `我喜欢${selectedInterests}。`
  }
  
  // 添加更多上下文...
  return prompt
}
```

#### 3. AI服务调用
```javascript
async onSubmit() {
  if (!this.validateForm()) return
  if (!Auth.requireLogin()) return

  const userId = Auth.getCurrentUserId()
  const userInput = this.generatePrompt()

  this.setData({ isLoading: true })

  const result = await aiIntegration.planIntelligentItinerary(userId, userInput, {}, false)

  if (result.success) {
    // 规划成功，返回并刷新列表
    wx.navigateBack()
  }
}
```

## 🎯 样式特色

### 1. 渐变主题
```css
/* 顶部渐变背景 */
.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 提交按钮渐变 */
.btn-submit {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 选中状态渐变 */
.checkbox-item.checked {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
}
```

### 2. 卡片阴影
```css
.form-section {
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  border-radius: 16rpx;
}
```

### 3. 动画过渡
```css
.checkbox-item,
.radio-item,
.form-input {
  transition: all 0.3s;
}
```

## 📐 布局响应

### 1. 灵活布局
- 使用 Flexbox 布局
- 自适应不同屏幕尺寸
- 半宽字段并排显示

### 2. 滚动区域
```css
.form-container {
  flex: 1;
  overflow-y: auto;
}
```

### 3. 固定底部
```css
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}
```

## 🔄 页面交互

### 1. 登录检查
- 提交前自动检查登录状态
- 未登录跳转登录页
- 登录后返回继续

### 2. 表单反馈
- 输入框聚焦高亮边框
- 必填项红色星号标记
- 错误提示Toast

### 3. 加载状态
- 提交按钮显示loading
- 按钮文字变为"AI正在规划中..."
- 禁用重复提交

### 4. 结果处理
- 成功: 显示结果弹窗
- 失败: 显示错误提示
- 返回: 刷新上一页数据

## 🎨 UI组件

### 1. 输入框
- 圆角设计 (12rpx)
- 浅灰背景 (#f5f7fa)
- 聚焦时白色背景 + 紫色边框

### 2. 选择器
- 统一样式设计
- 右侧箭头图标
- 选中/占位文字颜色区分

### 3. 复选框
- 方形带勾选样式
- 选中时紫色背景
- 圆角胶囊外观

### 4. 单选按钮
- 圆形单选图标
- 内部圆点显示
- 选中时紫色高亮

### 5. 文本域
- 支持多行输入
- 实时字数统计
- 200字限制

## 📱 适配说明

### 1. 颜色适配
- 导航栏: 紫色渐变
- 状态栏文字: 白色
- 背景色: 浅灰 (#f5f7fa)

### 2. 字体大小
- 标题: 44rpx 加粗
- 副标题: 28rpx
- 表单标签: 30rpx
- 输入文字: 28rpx
- 按钮文字: 30rpx

### 3. 间距规范
- 页面边距: 30rpx
- 卡片间距: 24rpx
- 内部间距: 20rpx

## 🚀 后续优化建议

1. **日期选择器** - 添加出发日期选择
2. **地图选择** - 集成地图选择目的地
3. **模板选择** - 提供常用行程模板
4. **历史记录** - 保存规划历史
5. **分享功能** - 分享行程给好友
6. **离线缓存** - 缓存表单数据

## 📝 使用示例

### 示例1：周末游
```
目的地: 杭州
旅行天数: 2天
出行人数: 2人
预算: 2000元
兴趣偏好: 自然风光、美食体验
旅行风格: 舒适享受
特殊要求: 希望住在西湖附近
```

### 示例2：深度游
```
目的地: 云南大理丽江
旅行天数: 5天
出行人数: 4人
预算: 6000元
兴趣偏好: 自然风光、文化历史、放松度假
旅行风格: 轻奢型
特殊要求: 带老人出行，希望行程不要太紧张
```

## 🎉 效果展示

页面特点：
- ✅ 美观的渐变色主题
- ✅ 清晰的表单布局
- ✅ 流畅的交互体验
- ✅ 完善的表单验证
- ✅ 智能的AI提示词生成
- ✅ 自动的登录检查
- ✅ 友好的错误提示

现在用户可以通过这个美观的页面轻松创建AI智能行程规划！🎊
