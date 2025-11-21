# API 连接配置说明

## 📋 项目使用的 API 服务

### 1. Supabase 数据库 API ✅
**用途**: 存储用户数据、行程计划、景点信息等

**配置信息**:
- URL: `https://hmnjuntvubqvbpeyqoxw.supabase.co`
- Anon Key: 已配置 (存储在 `.env` 文件中)
- 状态: ✅ 已连接

**支持的功能**:
- 用户注册和登录
- 行程计划的增删改查
- 景点信息管理
- 用户收藏管理
- 数据实时同步

### 2. Mistral AI API ✅
**用途**: 提供智能旅行规划、路线推荐、问答助手等 AI 功能

**配置信息**:
- API URL: `https://api.mistral.ai/v1/chat/completions`
- API Key: 已配置 (存储在 `.env` 文件中)
- 模型: `mistral-small-latest`
- 状态: ✅ 已连接

**支持的功能**:
- AI 智能行程规划
- 景点推荐
- 旅行问答助手
- 路线优化建议

## 🔧 配置文件说明

### 主配置文件
1. **`.env`** - 环境变量配置
   ```env
   # Supabase 配置
   VITE_SUPABASE_URL=https://hmnjuntvubqvbpeyqoxw.supabase.co
   VITE_SUPABASE_ANON_KEY=你的密钥
   
   # Mistral AI 配置
   VITE_AI_API_KEY=你的密钥
   VITE_AI_API_URL=https://api.mistral.ai/v1/chat/completions
   VITE_AI_MODEL=mistral-small-latest
   ```

2. **`app.js`** - 全局配置
   ```javascript
   globalData: {
     config: {
       AI_API_KEY: 'E8L3fryNUIsAoWvROdNrumpwFTtfuCBL',
       AI_API_URL: 'https://api.mistral.ai/v1/chat/completions',
       AI_MODEL: 'mistral-small-latest',
       SUPABASE_URL: 'https://hmnjuntvubqvbpeyqoxw.supabase.co',
       SUPABASE_ANON_KEY: '你的密钥'
     }
   }
   ```

3. **`utils/config.js`** - 配置管理模块
   - 统一管理所有 API 配置
   - 支持从 app.js 动态读取配置
   - 提供默认配置

4. **`utils/supabase.js`** - Supabase 客户端
   - 封装数据库操作
   - 使用微信小程序的 `wx.request` 进行 HTTP 调用

5. **`utils/ai-service.js`** - AI 服务模块
   - 封装 AI API 调用
   - 支持多个 AI 提供商切换
   - 自动重试和错误处理

## 🧪 API 测试

### 使用测试工具
项目包含 `utils/api-test.js` 测试工具，可以在小程序中测试 API 连接：

```javascript
const apiTest = require('./utils/api-test')

// 测试所有 API 连接
apiTest.testAllConnections().then(results => {
  console.log('测试完成:', results)
})

// 单独测试 Supabase
apiTest.testSupabaseConnection().then(result => {
  console.log('Supabase 测试:', result)
})

// 单独测试 AI API
apiTest.testAIConnection().then(result => {
  console.log('AI API 测试:', result)
})
```

### 在页面中测试
可以在任何页面的 `onLoad` 方法中添加测试代码：

```javascript
onLoad() {
  const apiTest = require('../../utils/api-test')
  
  // 测试 API 连接
  apiTest.testAllConnections().then(results => {
    results.forEach(result => {
      if (result.success) {
        wx.showToast({
          title: `${result.service} 连接成功`,
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: `${result.service} 连接失败`,
          icon: 'error'
        })
      }
    })
  })
}
```

## 🔐 API 密钥安全

### 当前配置
- API 密钥存储在 `.env` 文件和 `app.js` 中
- `.env` 文件应该添加到 `.gitignore` 避免上传到 GitHub

### 安全建议
1. ⚠️ **不要将 API 密钥直接提交到 GitHub**
2. 使用环境变量管理敏感信息
3. 对于生产环境，建议使用后端服务器代理 API 调用
4. 定期更换 API 密钥

### 配置 .gitignore
确保 `.gitignore` 文件包含：
```
.env
.env.local
.env.*.local
```

## 📊 API 使用示例

### Supabase 数据库操作
```javascript
const supabase = require('./utils/supabase').supabase

// 查询数据
supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .then(result => {
    if (result.data) {
      console.log('用户数据:', result.data)
    }
  })

// 插入数据
supabase
  .from('travel_plans')
  .insert({
    title: '云南大理',
    user_id: userId,
    destination: '大理'
  })
  .select()
  .then(result => {
    console.log('创建成功:', result.data)
  })
```

### AI API 调用
```javascript
const aiIntegration = require('./utils/ai-integration').aiIntegration

// AI 行程规划
const result = await aiIntegration.generateItinerary(userId, {
  destination: '云南大理',
  days: 5,
  budget: 5000,
  preferences: ['自然风光', '古镇']
})

if (result.success) {
  console.log('AI 规划结果:', result.itinerary)
}
```

## 🚀 API 性能优化

### 1. 请求缓存
- 对于不经常变化的数据(如景点信息)使用本地缓存
- 减少重复的 API 调用

### 2. 请求合并
- 批量操作时使用数组形式的插入/更新
- 减少网络请求次数

### 3. 超时设置
- 所有 API 请求都设置了超时时间
- Supabase: 默认超时
- AI API: 30秒超时

### 4. 错误重试
- AI API 支持多提供商自动切换
- 失败自动重试机制

## 📞 API 状态监控

### 在控制台查看
所有 API 调用都会在控制台输出详细日志：
- 请求参数
- 响应状态
- 错误信息
- 性能指标

### 错误处理
项目中所有 API 调用都包含错误处理：
```javascript
try {
  const result = await apiCall()
  if (result.error) {
    // 处理错误
    console.error('API 错误:', result.error)
    wx.showToast({
      title: '操作失败',
      icon: 'none'
    })
  }
} catch (error) {
  console.error('异常:', error)
}
```

## 🛠️ 故障排查

### Supabase 连接失败
1. 检查网络连接
2. 确认 Supabase URL 和 Anon Key 正确
3. 检查表名和字段名是否匹配
4. 查看 Supabase 后台是否有权限限制

### AI API 调用失败
1. 检查 API Key 是否有效
2. 确认请求参数格式正确
3. 检查是否超出 API 使用限额
4. 尝试切换到备用 AI 提供商

## 📝 更新日志

### 2025-11-21
- ✅ 配置 Supabase 数据库 API
- ✅ 配置 Mistral AI API
- ✅ 创建 API 测试工具
- ✅ 添加多提供商支持
- ✅ 优化错误处理机制

---

**注意**: 本文档会随着项目发展持续更新。如有问题，请查看控制台日志或联系开发团队。
