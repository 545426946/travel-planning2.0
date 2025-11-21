# API 快速测试指南

## 🚀 快速开始

### 方法一：在微信开发者工具控制台直接测试

1. 打开微信开发者工具
2. 打开项目
3. 打开控制台（Console）
4. 复制粘贴以下代码测试：

#### 测试 Supabase 连接
```javascript
const supabase = require('./utils/supabase').supabase

supabase
  .from('users')
  .select('id')
  .limit(1)
  .then(result => {
    if (result.error) {
      console.error('❌ Supabase 连接失败:', result.error)
    } else {
      console.log('✅ Supabase 连接成功!')
      console.log('数据:', result.data)
    }
  })
```

#### 测试 AI API 连接
```javascript
wx.request({
  url: 'https://api.mistral.ai/v1/chat/completions',
  method: 'POST',
  header: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer E8L3fryNUIsAoWvROdNrumpwFTtfuCBL',
    'Accept': 'application/json'
  },
  data: {
    model: 'mistral-small-latest',
    messages: [
      {
        role: 'user',
        content: '你好，请简短回复这是一个测试。'
      }
    ],
    temperature: 0.7,
    max_tokens: 50
  },
  success: (res) => {
    if (res.statusCode === 200) {
      console.log('✅ AI API 连接成功!')
      console.log('AI 回复:', res.data.choices[0].message.content)
    } else {
      console.error('❌ AI API 连接失败:', res.data)
    }
  },
  fail: (err) => {
    console.error('❌ 请求失败:', err)
  }
})
```

### 方法二：在页面中添加测试按钮

1. 在 `index/index.wxml` 首页添加测试按钮：
```xml
<button class=\"test-api-btn\" bindtap=\"testAPIConnection\">测试 API 连接</button>
```

2. 在 `index/index.js` 添加测试方法：
```javascript
// 测试 API 连接
testAPIConnection() {
  wx.showLoading({ title: '测试中...' })
  
  const apiTest = require('../utils/api-test')
  
  apiTest.testAllConnections().then(results => {
    wx.hideLoading()
    
    let message = ''
    results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      message += `${status} ${result.service}\n`
    })
    
    wx.showModal({
      title: 'API 测试结果',
      content: message,
      showCancel: false
    })
  }).catch(error => {
    wx.hideLoading()
    wx.showToast({
      title: '测试失败',
      icon: 'error'
    })
    console.error('API 测试错误:', error)
  })
},
```

### 方法三：使用完整的测试工具

在任何页面的 `onLoad` 中添加：

```javascript
onLoad() {
  // ... 其他代码
  
  // 开发模式下自动测试 API
  if (this.data.debug) {
    this.runAPITests()
  }
},

runAPITests() {
  console.log('=== 开始 API 连接测试 ===')
  
  const apiTest = require('../utils/api-test')
  
  // 测试 Supabase
  apiTest.testSupabaseConnection().then(result => {
    if (result.success) {
      console.log('✅ Supabase:', result.message)
    } else {
      console.error('❌ Supabase 失败:', result.error)
    }
  })
  
  // 测试 AI API
  apiTest.testAIConnection().then(result => {
    if (result.success) {
      console.log('✅ AI API:', result.message)
    } else {
      console.error('❌ AI API 失败:', result.error)
    }
  })
}
```

## 🧪 测试 AI 功能

### 测试 AI 行程规划
```javascript
const aiIntegration = require('./utils/ai-integration').aiIntegration

// 获取当前用户ID
const userId = require('./utils/auth').Auth.getCurrentUserId()

// 测试 AI 规划
aiIntegration.generateItinerary(userId, {
  destination: '云南大理',
  days: 3,
  budget: 3000,
  preferences: ['自然风光', '古镇']
}).then(result => {
  if (result.success) {
    console.log('✅ AI 规划成功!')
    console.log('行程:', result.itinerary)
  } else {
    console.error('❌ AI 规划失败:', result.error)
  }
})
```

### 测试 AI 问答
```javascript
const aiIntegration = require('./utils/ai-integration').aiIntegration
const userId = require('./utils/auth').Auth.getCurrentUserId()

aiIntegration.askTravelQuestion(
  userId,
  '云南大理最佳旅游时间是什么时候？'
).then(result => {
  if (result.success) {
    console.log('✅ AI 回答:', result.answer)
  } else {
    console.error('❌ AI 回答失败')
  }
})
```

## 🔍 常见问题排查

### 1. Supabase 连接失败
**问题**: 返回 401 或 403 错误
**解决**:
- 检查 `SUPABASE_ANON_KEY` 是否正确
- 确认 Supabase 项目 URL 正确
- 在 Supabase 后台检查表的访问权限

### 2. AI API 返回 401
**问题**: API Key 无效
**解决**:
- 确认 API Key 格式正确
- 检查 API Key 是否过期
- 尝试重新生成 API Key

### 3. AI API 返回 422
**问题**: 请求参数错误
**解决**:
- 检查 `model` 参数是否正确
- 确认 `messages` 格式符合要求
- 减小 `max_tokens` 值

### 4. 请求超时
**问题**: 网络连接慢或不稳定
**解决**:
- 检查网络连接
- 增加超时时间
- 使用真机测试而非模拟器

## 📊 测试清单

- [ ] Supabase 基础连接测试
- [ ] Supabase 用户表查询测试
- [ ] Supabase 数据插入测试
- [ ] AI API 基础连接测试
- [ ] AI 简单对话测试
- [ ] AI 行程规划功能测试
- [ ] AI 景点推荐测试
- [ ] AI 问答助手测试
- [ ] 登录功能 + 数据库联动测试
- [ ] 完整的创建行程流程测试

## 💡 测试技巧

1. **使用控制台**: 最快的测试方式，实时查看结果
2. **分步测试**: 先测试基础连接，再测试复杂功能
3. **查看日志**: 所有 API 调用都有详细日志
4. **真机测试**: 某些网络问题只在真机上出现
5. **错误信息**: 仔细阅读错误信息，通常包含解决线索

## 🎯 下一步

测试通过后，你可以：
1. 开始使用 AI 功能创建智能行程
2. 测试用户注册登录流程
3. 创建和管理旅行计划
4. 使用 AI 问答助手
5. 收藏景点和路线

---

**提示**: 建议在开发过程中保持控制台打开，随时查看 API 调用状态。
