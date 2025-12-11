// utils/wechat-login.js - 微信登录服务（适配 Supabase）
const supabase = require('./supabase').supabase
const Auth = require('./auth').Auth
const { SUPABASE_CONFIG } = require('./config')

// Supabase 配置
const supabaseUrl = SUPABASE_CONFIG.url
const supabaseAnonKey = SUPABASE_CONFIG.anonKey

// 微信小程序配置（请确认这些配置是否正确）
const WECHAT_APP_ID = 'wx31db19e0efdc4d9d' // 请替换为你的实际AppID
const WECHAT_APP_SECRET = 'your_app_secret_here' // 请替换为你的实际AppSecret

/**
 * 微信登录服务类
 * 按照微信官方推荐流程实现
 */
class WechatLogin {
  constructor() {
    // 微信小程序配置（需要从后台获取）
    this.appId = 'wx31db19e0efdc4d9d' // 替换为实际的 AppID
    this.serverUrl = 'your_server_url' // 替换为实际的服务器地址
    this.userInfo = null // 存储用户信息
  }

  /**
   * 设置用户信息（供Edge Function使用）
   * @param {Object} userInfo - 用户信息
   */
  setUserInfo(userInfo) {
    this.userInfo = userInfo
    console.log('✅ 用户信息已设置到登录服务:', {
      昵称: userInfo.nickName,
      头像: userInfo.avatarUrl,
      城市: userInfo.city
    })
  }

  /**
   * 1. 微信登录主流程
   */
  async login() {
    try {
      console.log('🚀 开始微信登录流程')
      
      // 步骤1: 小程序端调用 wx.login() 获取临时登录凭证 code
      const loginResult = await this.getWxLoginCode()
      console.log('✅ 步骤1: 获取到 code:', loginResult.code)
      
      // 步骤2: 将 code 发送到后端服务器
      const serverResult = await this.sendCodeToServer(loginResult.code)
      console.log('✅ 步骤2: 服务器返回结果:', serverResult)
      
      // 步骤3: 服务器返回自定义登录态 token
      if (serverResult.success && serverResult.token) {
        // 步骤4: 保存 token 到本地存储
        this.saveLoginToken(serverResult.token, serverResult.userInfo)
        
        // 保存用户信息到 Auth 工具
        if (serverResult.userInfo) {
          Auth.saveUserLogin(serverResult.userInfo, true)
        }
        
        return {
          success: true,
          token: serverResult.token,
          userInfo: serverResult.userInfo
        }
      } else {
        throw new Error(serverResult.message || '登录失败')
      }
      
    } catch (error) {
      console.error('❌ 微信登录失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 2. 获取微信登录临时凭证
   */
  getWxLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject,
        timeout: 10000
      })
    })
  }

  /**
   * 3. 调用Supabase Edge Function进行微信认证
   * @param {string} code - 微信登录临时凭证
   */
  async sendCodeToServer(code) {
    console.log('🚀 使用微信Edge Function认证')
    
    try {
      // 准备发送到Edge Function的数据
      const requestData = { 
        code: code
      }
      
      // 如果有用户信息，一起发送
      if (this.userInfo) {
        requestData.userInfo = this.userInfo
        console.log('📤 发送用户信息到Edge Function:', {
          昵称: this.userInfo.nickName,
          头像: this.userInfo.avatarUrl
        })
      }
      
      // 调用Edge Function
      const result = await this.callSupabaseFunction('wechat-login', requestData)
      console.log('✅ Edge Function认证成功')
      
      // 清除用户信息
      this.userInfo = null
      
      return result
    } catch (error) {
      console.error('❌ Edge Function认证失败:', error.message)
      
      // 清除用户信息
      this.userInfo = null
      
      // 如果Edge Function失败，不使用fallback，直接抛出错误
      throw new Error(`微信认证失败: ${error.message}`)
    }
  }

  /**
   * 4. 调用 Supabase Edge Function
   */
  async callSupabaseFunction(functionName, data) {
    return new Promise((resolve, reject) => {
      console.log('🔗 调用 Edge Function:', {
        url: `${supabaseUrl}/functions/v1/${functionName}`,
        functionName,
        hasData: !!data
      })

      wx.request({
        url: `${supabaseUrl}/functions/v1/${functionName}`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(data),
        success: (res) => {
          console.log('📨 Edge Function 响应:', {
            statusCode: res.statusCode,
            data: res.data,
            header: res.header
          })

          if (res.statusCode === 200) {
            try {
              const responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
              resolve(responseData)
            } catch (parseError) {
              console.error('解析响应数据失败:', parseError)
              reject(new Error('服务器响应格式错误'))
            }
          } else {
            console.error('Edge Function 请求失败:', res)
            reject(new Error(res.data?.message || `请求失败 (${res.statusCode})`))
          }
        },
        fail: (err) => {
          console.error('🌐 网络请求失败:', {
            errMsg: err.errMsg,
            url: `${supabaseUrl}/functions/v1/${functionName}`
          })
          reject(new Error(err.errMsg || '网络请求失败'))
        },
        timeout: 15000
      })
    })
  }





  /**
   * 6. 生成自定义登录态 token
   */
  generateCustomToken(userId) {
    return `token_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }





  /**
   * 7. 保存登录态到本地存储
   */
  saveLoginToken(token, userInfo) {
    try {
      // 保存 token
      wx.setStorageSync('authToken', token)
      
      // 保存用户信息
      wx.setStorageSync('userInfo', userInfo)
      
      // 保存登录时间
      wx.setStorageSync('loginTime', new Date().toISOString())
      
      console.log('✅ 登录态已保存到本地')
      console.log('   - token:', token)
      console.log('   - userInfo:', userInfo)
      
    } catch (error) {
      console.error('❌ 保存登录态失败:', error)
    }
  }

  /**
   * 8. 检查登录状态
   */
  isLoggedIn() {
    try {
      const token = wx.getStorageSync('authToken')
      const userInfo = wx.getStorageSync('userInfo')
      const loginTime = wx.getStorageSync('loginTime')
      
      if (!token || !userInfo || !loginTime) {
        return false
      }
      
      // 检查 token 是否过期（30天）
      const loginDate = new Date(loginTime)
      const now = new Date()
      const daysDiff = (now - loginDate) / (1000 * 60 * 60 * 24)
      
      return daysDiff < 30
    } catch (error) {
      console.error('❌ 检查登录状态失败:', error)
      return false
    }
  }

  /**
   * 9. 清除登录状态
   */
  logout() {
    try {
      wx.removeStorageSync('authToken')
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('loginTime')
      
      // 清除全局状态
      const app = getApp()
      if (app && app.globalData) {
        app.globalData.userInfo = null
        app.globalData.isLoggedIn = false
      }
      
      console.log('✅ 登录状态已清除')
    } catch (error) {
      console.error('❌ 清除登录状态失败:', error)
    }
  }

  /**
   * 10. 获取当前用户 token
   */
  getAuthToken() {
    try {
      return wx.getStorageSync('authToken')
    } catch (error) {
      console.error('❌ 获取 token 失败:', error)
      return null
    }
  }

  /**
   * 11. 带认证的请求封装
   */
  async authenticatedRequest(options) {
    const token = this.getAuthToken()
    
    if (!token) {
      throw new Error('用户未登录')
    }
    
    const requestConfig = {
      ...options,
      header: {
        'content-type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.header
      }
    }
    
    return new Promise((resolve, reject) => {
      wx.request({
        ...requestConfig,
        success: resolve,
        fail: reject
      })
    })
  }
}

// 创建单例实例
const wechatLogin = new WechatLogin()

module.exports = { wechatLogin, WechatLogin }
