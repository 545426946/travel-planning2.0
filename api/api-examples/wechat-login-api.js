// api-examples/wechat-login-api.js - 微信登录后端 API 示例
/**
 * 这是一个后端 API 示例，展示如何按照微信官方推荐流程处理登录
 * 实际项目中需要在你的服务器上实现这些 API
 */

const express = require('express')
const axios = require('axios')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

// 微信小程序配置
const WECHAT_CONFIG = {
  appId: 'wx31db19e0efdc4d9d',      // 替换为你的小程序 AppID
  appSecret: 'your_mini_program_appsecret', // 替换为你的小程序 AppSecret
  grantType: 'authorization_code',
  apiDomain: 'https://api.weixin.qq.com'
}

// 数据库模拟（实际项目中使用真实数据库）
const users = new Map() // Map<openid, userInfo>
const sessions = new Map() // Map<token, {openid, sessionKey, expires}>

/**
 * 1. 微信登录 API
 * 接收小程序端的 code，向微信服务器换取 OpenID 和 session_key
 */
app.post('/api/wechat/login', async (req, res) => {
  try {
    const { code } = req.body
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: '缺少登录凭证 code'
      })
    }

    console.log('📡 收到登录请求，code:', code)

    // 2. 向微信服务器发送请求，换取 OpenID 和 session_key
    const wechatResponse = await getWechatUserInfo(code)
    
    if (!wechatResponse.success) {
      return res.status(400).json({
        success: false,
        message: wechatResponse.message || '微信登录失败'
      })
    }

    const { openid, session_key } = wechatResponse.data
    console.log('✅ 微信服务器返回:', { openid, session_key: '***' })

    // 3. 查找或创建用户
    let userInfo = users.get(openid)
    if (!userInfo) {
      // 新用户，创建用户记录
      userInfo = {
        openid,
        created_at: new Date().toISOString(),
        login_count: 0,
        last_login_time: null
      }
      users.set(openid, userInfo)
      console.log('👤 创建新用户:', openid)
    }

    // 更新用户登录信息
    userInfo.login_count += 1
    userInfo.last_login_time = new Date().toISOString()
    users.set(openid, userInfo)

    // 4. 生成自定义登录态 token
    const customToken = generateCustomToken(openid, session_key)
    
    // 5. 保存会话信息
    sessions.set(customToken, {
      openid,
      session_key,
      created_at: new Date().toISOString(),
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天过期
    })

    console.log('🔐 生成自定义 token:', customToken.substring(0, 20) + '...')

    // 6. 返回自定义 token 和用户信息给小程序
    res.json({
      success: true,
      token: customToken,
      userInfo: {
        openid,
        login_count: userInfo.login_count,
        last_login_time: userInfo.last_login_time
      },
      message: '登录成功'
    })

  } catch (error) {
    console.error('❌ 登录 API 错误:', error)
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    })
  }
})

/**
 * 2. 获取微信用户信息（向微信服务器请求）
 */
async function getWechatUserInfo(code) {
  try {
    const url = `${WECHAT_CONFIG.apiDomain}/sns/jscode2session`
    const params = {
      appid: WECHAT_CONFIG.appId,
      secret: WECHAT_CONFIG.appSecret,
      js_code: code,
      grant_type: WECHAT_CONFIG.grantType
    }

    console.log('📡 向微信服务器请求:', url)
    console.log('📋 请求参数:', { ...params, secret: '***' })

    const response = await axios.get(url, { params })
    
    if (response.data.errcode) {
      console.error('❌ 微信服务器返回错误:', response.data)
      return {
        success: false,
        message: getWechatErrorMessage(response.data.errcode)
      }
    }

    console.log('✅ 成功获取用户信息')
    return {
      success: true,
      data: {
        openid: response.data.openid,
        session_key: response.data.session_key,
        unionid: response.data.unionid // 可选字段
      }
    }

  } catch (error) {
    console.error('❌ 请求微信服务器失败:', error.message)
    return {
      success: false,
      message: '网络请求失败'
    }
  }
}

/**
 * 3. 生成自定义登录态 token
 */
function generateCustomToken(openid, sessionKey) {
  const payload = {
    openid,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30天过期
  }
  
  // 使用 JWT 签名（需要设置一个密钥）
  return jwt.sign(payload, 'your_jwt_secret_key', { algorithm: 'HS256' })
}

/**
 * 4. 验证自定义 token 的中间件
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '缺少认证 token'
    })
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret_key')
    const session = sessions.get(token)
    
    if (!session || new Date() > new Date(session.expires)) {
      return res.status(401).json({
        success: false,
        message: 'token 已过期'
      })
    }

    req.user = {
      openid: decoded.openid,
      session_key: session.session_key
    }
    
    next()
  } catch (error) {
    console.error('❌ Token 验证失败:', error.message)
    return res.status(403).json({
      success: false,
      message: 'token 无效'
    })
  }
}

/**
 * 5. 受保护的 API 示例
 */
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const userInfo = users.get(req.user.openid)
  
  res.json({
    success: true,
    data: userInfo
  })
})

/**
 * 6. 获取微信错误码对应的消息
 */
function getWechatErrorMessage(errcode) {
  const errorMap = {
    40013: '无效的 AppID',
    40014: '无效的 AppSecret',
    40029: 'code 无效',
    45011: 'API 调用太频繁，请稍后再试',
    40125: '无效的密钥',
    40007: '获取用户信息失败'
  }
  
  return errorMap[errcode] || `未知错误码: ${errcode}`
}

/**
 * 7. 启动服务器
 */
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 微信登录 API 服务器运行在端口 ${PORT}`)
  console.log('📋 API 端点:')
  console.log('  POST /api/wechat/login - 微信登录')
  console.log('  GET  /api/user/profile - 获取用户信息（需要认证）')
})

module.exports = app