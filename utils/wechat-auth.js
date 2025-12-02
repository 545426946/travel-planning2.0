// utils/wechat-auth.js - 微信授权登录专用工具
const supabase = require('./supabase').supabase
const Auth = require('./auth').Auth

/**
 * 微信授权登录管理类
 */
class WeChatAuth {
  /**
   * 微信登录完整流程
   * @param {Object} options 登录选项
   * @param {boolean} options.getUserProfile 是否获取用户详细信息
   * @param {boolean} options.saveToDatabase 是否保存到数据库
   * @returns {Promise<Object>} 登录结果
   */
  static async wechatLogin(options = {}) {
    const { getUserProfile = true, userProfile = null } = options
    
    try {
      console.log('🚀 开始微信登录流程...')
      
      // 第一步：获取微信登录凭证 (code)
      const loginCode = await this.getWechatLoginCode()
      if (!loginCode) {
        throw new Error('获取微信登录凭证失败')
      }
      
      console.log('✅ 微信登录凭证获取成功')
      
      // 第二步：获取用户信息（可选）
      let userInfo = userProfile || null
      if (!userInfo && getUserProfile) {
        userInfo = await this.getUserProfile()
        console.log('✅ 用户信息获取成功')
      }
      
      // 第三步：通过后端Edge Function获取真实openid并返回用户信息
      const wechatUserInfo = await this.processWechatLogin(loginCode, userInfo)
      console.log('✅ 微信用户信息处理完成')
      
      // 第四步：设置登录状态（Edge Function已负责创建/更新用户）
      this.setLoginState(wechatUserInfo)
      console.log('✅ 登录状态设置完成')
      
      return {
        success: true,
        userInfo: wechatUserInfo,
        message: '微信登录成功'
      }
      
    } catch (error) {
      console.error('❌ 微信登录失败:', error)
      return {
        success: false,
        error: error.message,
        message: '微信登录失败'
      }
    }
  }

  /**
   * 获取微信登录凭证
   * @returns {Promise<string>} 登录凭证code
   */
  static getWechatLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            console.log('微信登录code:', res.code)
            resolve(res.code)
          } else {
            console.error('获取微信登录code失败:', res.errMsg)
            reject(new Error('获取微信登录凭证失败'))
          }
        },
        fail: (error) => {
          console.error('wx.login失败:', error)
          reject(error)
        }
      })
    })
  }

  /**
   * 获取用户详细信息
   * @returns {Promise<Object>} 用户信息
   */
  static getUserProfile() {
    return new Promise((resolve, reject) => {
      // 检查微信版本是否支持getUserProfile
      if (wx.getUserProfile) {
        wx.getUserProfile({
          desc: '用于完善用户资料', // 声明获取用户个人信息后的用途
          success: (res) => {
            console.log('获取用户信息成功:', res.userInfo)
            resolve(res.userInfo)
          },
          fail: (error) => {
            console.warn('获取用户信息失败，使用默认信息:', error)
            resolve(null) // 返回null，不阻止登录流程
          }
        })
      } else {
        // 兼容旧版本微信
        wx.getUserInfo({
          success: (res) => {
            console.log('获取用户信息成功（旧版本）:', res.userInfo)
            resolve(res.userInfo)
          },
          fail: (error) => {
            console.warn('获取用户信息失败（旧版本）:', error)
            resolve(null)
          }
        })
      }
    })
  }

  /**
   * 处理微信登录信息
   * @param {string} code 微信登录凭证
   * @param {Object} userInfo 用户信息
   * @returns {Promise<Object>} 处理后的用户信息
   */
  static async processWechatLogin(code, userInfo) {
    try {
      const { SUPABASE_CONFIG } = require('./config')
      const match = SUPABASE_CONFIG.url.match(/^https?:\/\/([^\.]+)\.supabase\.co/)
      const projectRef = match ? match[1] : null
      if (!projectRef) {
        throw new Error('无法解析 Supabase 项目标识')
      }

      const fnUrl = `https://${projectRef}.functions.supabase.co/wechat-login`

      const payload = {
        code,
        userInfo: userInfo ? {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
          gender: userInfo.gender,
          city: userInfo.city,
          province: userInfo.province,
          country: userInfo.country,
          language: userInfo.language
        } : null
      }

      const result = await new Promise((resolve) => {
        wx.request({
          url: fnUrl,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
          },
          data: payload,
          success: (res) => resolve({ status: res.statusCode, data: res.data }),
          fail: (err) => resolve({ status: 0, error: err })
        })
      })

      if (result.status === 200 && result.data && result.data.success) {
        const ui = result.data.userInfo
        const wechatUserInfo = {
          id: ui.id,
          openid: ui.openid,
          name: ui.name || (userInfo?.nickName || '微信用户'),
          avatar: ui.avatar || (userInfo?.avatarUrl || ''),
          gender: ui.gender || (userInfo?.gender || 0),
          city: ui.city || (userInfo?.city || ''),
          province: ui.province || (userInfo?.province || ''),
          country: ui.country || (userInfo?.country || ''),
          language: userInfo?.language || 'zh_CN',
          loginType: 'wechat',
          loginTime: new Date().toISOString(),
          token: result.data.token || Auth.generateToken(ui.openid)
        }
        return wechatUserInfo
      }

      let persistedOpenid = ''
      try {
        persistedOpenid = wx.getStorageSync('persistentOpenid') || ''
      } catch (e) {}
      if (!persistedOpenid) {
        const rand = Math.random().toString(36).slice(2, 10)
        persistedOpenid = `wx_${rand}`
        try { wx.setStorageSync('persistentOpenid', persistedOpenid) } catch (e) {}
      }

      const minimalUserInfo = {
        nickName: userInfo?.nickName || '微信用户',
        avatarUrl: userInfo?.avatarUrl || '',
        language: userInfo?.language || 'zh_CN'
      }

      const loginResult = await Auth.handleWechatLogin({ openid: persistedOpenid, userInfo: minimalUserInfo }, supabase)
      if (!loginResult || !loginResult.success || !loginResult.user || !loginResult.user.id) {
        throw new Error('微信登录服务失败')
      }

      const fallbackUser = {
        id: loginResult.user.id,
        openid: persistedOpenid,
        name: minimalUserInfo.nickName,
        avatar: minimalUserInfo.avatarUrl,
        gender: userInfo?.gender || 0,
        city: userInfo?.city || '',
        province: userInfo?.province || '',
        country: userInfo?.country || '',
        language: minimalUserInfo.language,
        loginType: 'wechat',
        loginTime: new Date().toISOString(),
        token: Auth.generateToken(persistedOpenid)
      }
      return fallbackUser

    } catch (error) {
      console.error('处理微信登录信息失败:', error)
      throw new Error(error.message || '处理微信登录信息失败')
    }
  }

  /**
   * 保存用户到数据库
   * @param {Object} userInfo 用户信息
   */
  static async saveUserToDatabase() {}

  /**
   * 设置登录状态
   * @param {Object} userInfo 用户信息
   */
  static setLoginState(userInfo) {
    // 保存到全局状态
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.userInfo = userInfo
      app.globalData.isLoggedIn = true
    }

    // 保存到本地存储
    Auth.saveUserLogin(userInfo, true)
    
    console.log('登录状态设置完成:', userInfo.name)
  }

  /**
   * 检查微信登录状态
   * @returns {Object|null} 当前微信用户信息
   */
  static checkWechatLoginStatus() {
    const userInfo = Auth.getCurrentUser()
    
    if (userInfo && userInfo.loginType === 'wechat') {
      return userInfo
    }
    
    return null
  }

  /**
   * 退出微信登录
   */
  static wechatLogout() {
    // 清除全局状态
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.userInfo = null
      app.globalData.isLoggedIn = false
    }

    // 清除本地存储
    Auth.clearUserLogin()
    
    console.log('微信登录已退出')
  }

  /**
   * 获取微信用户手机号（需要用户授权）
   * @returns {Promise<string>} 手机号
   */
  static getPhoneNumber() {
    return new Promise((resolve, reject) => {
      wx.getPhoneNumber({
        success: (res) => {
          console.log('获取手机号成功:', res)
          // 注意：这里返回的是加密数据，需要后端解密
          resolve(res.encryptedData)
        },
        fail: (error) => {
          console.warn('获取手机号失败:', error)
          reject(error)
        }
      })
    })
  }

  /**
   * 检查登录是否需要重新授权
   * @returns {boolean} 是否需要重新授权
   */
  static needsReauthorization() {
    const userInfo = this.checkWechatLoginStatus()
    
    if (!userInfo) {
      return true
    }
    
    // 检查登录时间，超过24小时建议重新授权
    const loginTime = new Date(userInfo.loginTime)
    const now = new Date()
    const hoursDiff = (now - loginTime) / (1000 * 60 * 60)
    
    return hoursDiff > 24
  }

  /**
   * 静默登录（不弹出授权框）
   * @returns {Promise<Object>} 登录结果
   */
  static async silentLogin() {
    try {
      console.log('🤫 开始静默登录...')
      
      // 只获取登录凭证，不获取用户信息
      const loginCode = await this.getWechatLoginCode()
      
      // 检查是否有已登录的用户
      const existingUser = this.checkWechatLoginStatus()
      
      if (existingUser) {
        // 更新登录时间
        existingUser.loginTime = new Date().toISOString()
        this.setLoginState(existingUser)
        
        return {
          success: true,
          userInfo: existingUser,
          message: '静默登录成功'
        }
      } else {
        // 没有已登录用户，无法静默登录
        return {
          success: false,
          message: '无登录信息，需要用户授权'
        }
      }
      
    } catch (error) {
      console.error('静默登录失败:', error)
      return {
        success: false,
        error: error.message,
        message: '静默登录失败'
      }
    }
  }
}

module.exports = { WeChatAuth }
