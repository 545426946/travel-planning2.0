# 微信小程序专用 Supabase SDK 使用说明

## 概述

本项目已成功安装并配置了专门适配微信小程序环境的 Supabase SDK，解决了标准 SDK 在微信小程序中的兼容性问题。

## 主要特性

### 🎯 微信小程序适配
- 使用 `wx.request` 替代标准 `fetch` API
- 完全兼容微信小程序的安全策略和网络限制
- 支持微信小程序的所有请求配置选项

### 🚀 功能完整
- **Edge Function 调用**：轻松调用 Supabase Edge Functions
- **数据库操作**：完整的 CRUD 操作支持
- **查询构建器**：链式调用，语法简洁
- **会话管理**：用户认证和会话状态管理

### 🛡️ 错误处理
- 完善的错误捕获和日志记录
- 网络超时和连接失败处理
- HTTP 状态码详细解析

## 快速开始

### 1. 导入 SDK

```javascript
const { WechatSupabase } = require('../../utils/supabase-client')
```

### 2. 调用 Edge Function

```javascript
// 微信登录
const result = await WechatSupabase.wechatLogin({
  code: '微信登录临时凭证',
  userInfo: {
    nickName: '用户昵称',
    avatarUrl: '头像URL'
  }
})

if (result.error) {
  console.error('登录失败:', result.error)
} else {
  console.log('登录成功:', result.data)
}
```

### 3. 数据库操作

```javascript
// 查询用户
const userResult = await WechatSupabase.getUserByOpenid('openid')
console.log('用户信息:', userResult.data)

// 创建会话
const sessionData = {
  user_id: 123,
  openid: 'user_openid',
  session_key: 'session_key',
  token: 'auth_token',
  expires_at: '2025-12-25T00:00:00Z',
  is_active: true
}
const sessionResult = await WechatSupabase.createUserSession(sessionData)
```

### 4. 高级查询

```javascript
// 使用查询构建器
const client = WechatSupabase.getClient()

// 复杂查询
const result = await client
  .from('app_users')
  .select('id, name, avatar')
  .eq('login_type', 'wechat')
  .order('created_at', { ascending: false })
  .limit(10)
  .execute()

// 插入数据
const insertResult = await client
  .from('user_sessions')
  .insert(sessionData)
  .execute()

// 更新数据
const updateResult = await client
  .from('app_users')
  .update({ last_login_time: new Date().toISOString() })
  .eq('openid', 'user_openid')
  .execute()
```

## 配置说明

### 环境变量

SDK 已预配置以下常量（在 `utils/supabase-client.js` 中）：

```javascript
const SUPABASE_URL = 'https://hmnjuntvubqvbpeyqoxw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### 微信小程序配置

确保在 `app.json` 中配置了必要的权限：

```json
{
  "permission": {
    "scope.userInfo": {
      "desc": "您的微信头像、昵称等用户信息将用于完善会员资料"
    }
  }
}
```

## 核心类和方法

### WechatSupabaseClient

主要的客户端类，提供底层的网络请求功能。

#### 方法

- `request(options)` - 通用请求方法
- `invokeFunction(functionName, data)` - 调用 Edge Function
- `from(table)` - 创建查询构建器
- `rpc(functionName, params)` - 调用 RPC 函数

### WechatSupabaseQueryBuilder

查询构建器，提供链式调用的数据库操作。

#### 查询方法

- `select(columns)` - 选择字段
- `eq(column, value)` - 等于条件
- `neq(column, value)` - 不等于条件
- `gt/gte/lt/lte(column, value)` - 大小比较
- `like/ilike(column, value)` - 模糊匹配
- `in(column, values)` - 包含在列表中
- `order(column, options)` - 排序
- `limit(count)` - 限制数量
- `single()` - 返回单条记录

#### 操作方法

- `execute()` - 执行查询
- `insert(data, options)` - 插入数据
- `update(data, options)` - 更新数据
- `delete()` - 删除数据

### WechatSupabase

高级封装，提供便捷的常用操作。

#### 方法

- `wechatLogin(loginData)` - 微信登录
- `getUserByOpenid(openid)` - 根据 openid 查询用户
- `createUserSession(sessionData)` - 创建用户会话
- `updateUser(openid, updateData)` - 更新用户信息
- `getUserSession(sessionId)` - 获取用户会话
- `getClient()` - 获取底层客户端实例

## 错误处理

### 常见错误类型

1. **网络错误**
   ```javascript
   { data: null, error: Error("网络请求失败: request:fail timeout") }
   ```

2. **HTTP 状态错误**
   ```javascript
   { data: null, error: Error("HTTP 500: 服务器内部错误") }
   ```

3. **数据库查询错误**
   ```javascript
   { data: null, error: Error("查询失败: 列不存在") }
   ```

### 错误处理最佳实践

```javascript
try {
  const result = await WechatSupabase.wechatLogin(loginData)
  
  if (result.error) {
    // 处理业务错误
    console.error('登录失败:', result.error.message)
    wx.showToast({
      title: result.error.message,
      icon: 'none'
    })
    return
  }
  
  // 处理成功结果
  console.log('登录成功:', result.data)
  
} catch (error) {
  // 处理系统异常
  console.error('系统错误:', error)
  wx.showToast({
    title: '系统错误，请重试',
    icon: 'none'
  })
}
```

## 性能优化建议

### 1. 请求优化
- 合并多个请求到单个 Edge Function
- 使用适当的查询限制（`limit`）
- 只查询需要的字段（`select`）

### 2. 缓存策略
- 将不常变化的数据缓存到本地存储
- 使用用户会话状态减少重复认证

### 3. 错误重试
- 实现指数退避重试机制
- 对网络错误进行友好提示

## 测试

运行测试脚本验证 SDK 功能：

```bash
cd "c:\Users\yy\Desktop\旅行规划轻量化项目"
node test-supabase-sdk.js
```

## 故障排除

### 常见问题

1. **请求超时**
   - 检查网络连接
   - 确认 Supabase URL 正确

2. **认证失败**
   - 验证 API Key 是否有效
   - 检查 Edge Function 权限配置

3. **数据格式错误**
   - 确认 JSON 格式正确
   - 检查字段类型匹配

### 调试技巧

```javascript
// 开启详细日志
console.log('请求参数:', requestData)
console.log('响应结果:', result)

// 使用微信开发者工具的网络面板
// 查看实际的 HTTP 请求和响应
```

## 更新日志

### v1.0.0 (2025-11-25)
- ✅ 初始版本发布
- ✅ 完整的微信小程序适配
- ✅ Edge Function 调用支持
- ✅ 数据库 CRUD 操作
- ✅ 查询构建器实现
- ✅ 错误处理和日志记录
- ✅ 测试验证通过

## 技术支持

如有问题或建议，请：
1. 查看控制台日志获取详细错误信息
2. 使用微信开发者工具的网络面板调试
3. 检查 Supabase 控制台的 Edge Function 日志

---

**注意**：本 SDK 专门为微信小程序环境优化，请勿在 Node.js 或浏览器环境中使用标准 Supabase SDK 替代本 SDK。