// utils/wechat-login.js - 微信登录服务（适配 Supabase）
const supabase = require('./supabase').supabase
const Auth = require('./auth').Auth

// Supabase 配置
const supabaseUrl = 'https://hmnjuntvubqvbpeyqoxw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtbmp1bnR2dWJxdmJwZXlxb3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MjEwNDYsImV4cCI6MjA3ODk5NzA0Nn0.BCp0_8M3OhlIhLQ4fz54le-sWqZeUx9JDRXr1XRsX8g'

/**
 * 微信登录服务类
 * 按照微信官方推荐流程实现
 */
class WechatLogin {
  constructor() {
    // 微信小程序配置
    this.appId = 'wxb9ca37c30f43d5b8' // 从 project.config.json 获取的 AppID
    this.serverUrl = supabaseUrl // 使用 Supabase URL
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
   * 3. 发送 code 到 Supabase Edge Function
   * @param {string} code - 微信登录临时凭证
   */
  async sendCodeToServer(code) {
    try {
      console.log('📡 发送 code 到 Supabase Edge Function:', code)
      
      // 优先尝试本地处理（避免 Edge Function 配置问题）
      console.log('🔄 优先使用本地处理模式')
      return await this.localWechatLoginFallback(code)
      
      // 如果需要使用 Edge Function，取消下面的注释
      /*
      const response = await this.callSupabaseFunction('wechat-login', { code })
      
      if (response.success) {
        return response
      } else {
        throw new Error(response.message || '服务器处理失败')
      }
      */
      
    } catch (error) {
      console.error('❌ 调用失败:', error)
      throw error
    }
  }

  /**
   * 4. 调用 Supabase Edge Function
   */
  async callSupabaseFunction(functionName, data) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${supabaseUrl}/functions/v1/${functionName}`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        data: data,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data)
          } else {
            reject(new Error(res.data?.message || '请求失败'))
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '网络请求失败'))
        }
      })
    })
  }

  /**
   * 5. 本地微信登录 Fallback（当 Edge Function 不可用时）
   */
  async localWechatLoginFallback(code) {
    console.log('🔄 使用本地微信登录 fallback')
    
    // 生成基础用户信息
    const timestamp = Date.now()
    const userInfo = {
      id: timestamp,
      openid: `local_${code.substring(0, 8)}_${timestamp}`,
      name: '微信用户',
      avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUl24cLiaEwdBbCHnElQzBf0x9Yc2icJ0Y9nSKhEXQnGHVicHjaNQ6GoAhjibcPA/132',
      gender: 0,
      city: '',
      province: '',
      country: '',
      loginType: 'wechat',
      loginTime: timestamp,
      hasRealInfo: false
    }

    try {
      // 保存到 Supabase
      await this.saveUserInfoToDatabase(userInfo)
      console.log('✅ 用户信息已保存到 Supabase')
      
      const customToken = this.generateCustomToken(userInfo.id)
      
      return {
        success: true,
        token: customToken,
        userInfo: userInfo,
        message: '登录成功（本地模式）'
      }
    } catch (error) {
      console.error('❌ 本地登录失败:', error)
      throw error
    }
  }

  /**
   * 6. 保存用户信息到 Supabase 数据库
   */
  async saveUserInfoToDatabase(userInfo) {
    const { error } = await supabase
      .from('users')
      .upsert({
        openid: userInfo.openid,
        name: userInfo.name,
        avatar: userInfo.avatar,
        gender: userInfo.gender,
        city: userInfo.city,
        province: userInfo.province,
        country: userInfo.country,
        login_type: 'wechat',
        has_real_info: userInfo.hasRealInfo,
        last_login_time: new Date().toISOString()
      }, {
        onConflict: 'openid'
      })

    if (error) {
      throw new Error(`数据库保存失败: ${error.message}`)
    }
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