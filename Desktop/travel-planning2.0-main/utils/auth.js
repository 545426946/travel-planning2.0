// utils/auth.js - 用户认证和权限管理工具

/**
 * 权限验证工具类
 */
class Auth {
  /**
   * 安全获取App实例
   * @returns {Object|null} App实例或null
   */
  static getAppInstance() {
    try {
      return getApp()
    } catch (error) {
      // App实例还未初始化
      return null
    }
  }

  /**
   * 获取当前登录用户信息
   * @returns {Object|null} 用户信息对象，未登录返回null
   */
  static getCurrentUser() {
    // 优先从全局状态获取
    const app = this.getAppInstance()
    if (app && app.globalData && app.globalData.userInfo) {
      return app.globalData.userInfo
    }
    
    // 从本地存储获取
    try {
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        // 同步到全局状态
        if (app && app.globalData) {
          app.globalData.userInfo = userInfo
          app.globalData.isLoggedIn = true
        }
        return userInfo
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
    
    return null
  }

  /**
   * 获取当前用户ID
   * @returns {string|number|null} 用户ID，未登录返回null
   */
  static getCurrentUserId() {
    const user = this.getCurrentUser()
    return user ? user.id : null
  }

  /**
   * 检查是否已登录
   * @returns {boolean} 是否已登录
   */
  static isLoggedIn() {
    return this.getCurrentUser() !== null
  }

  /**
   * 检查登录状态，未登录则跳转到登录页
   * @param {boolean} showToast 是否显示提示信息
   * @returns {boolean} 是否已登录
   */
  static requireLogin(showToast = true) {
    if (!this.isLoggedIn()) {
      if (showToast) {
        wx.showToast({
          title: '请先登录',
          icon: 'none',
          duration: 2000
        })
      }
      
      // 延迟跳转，让提示先显示
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login'
        })
      }, 500)
      
      return false
    }
    return true
  }

  /**
   * 检查用户是否有权访问指定资源
   * @param {string|number} resourceUserId 资源所属用户ID
   * @returns {boolean} 是否有权访问
   */
  static canAccess(resourceUserId) {
    const currentUserId = this.getCurrentUserId()
    if (!currentUserId) {
      return false
    }
    
    // 转换为字符串比较，避免类型不匹配
    return String(currentUserId) === String(resourceUserId)
  }

  /**
   * 验证访问权限，无权限则显示提示
   * @param {string|number} resourceUserId 资源所属用户ID
   * @param {string} errorMessage 错误提示信息
   * @returns {boolean} 是否有权访问
   */
  static requireAccess(resourceUserId, errorMessage = '无权访问此资源') {
    if (!this.canAccess(resourceUserId)) {
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      })
      return false
    }
    return true
  }

  /**
   * 保存用户登录信息
   * @param {Object} userInfo 用户信息
   * @param {boolean} rememberMe 是否记住登录
   */
  static saveUserLogin(userInfo, rememberMe = false) {
    // 保存到全局状态
    const app = this.getAppInstance()
    if (app && app.globalData) {
      app.globalData.userInfo = userInfo
      app.globalData.isLoggedIn = true
    }

    // 保存到本地存储
    try {
      wx.setStorageSync('userInfo', userInfo)
      
      // 如果选择记住我，保存用户名
      if (rememberMe && userInfo.username) {
        wx.setStorageSync('savedUsername', userInfo.username)
      } else {
        wx.removeStorageSync('savedUsername')
      }

      // 记录登录时间
      wx.setStorageSync('loginTime', new Date().toISOString())
      
      console.log('用户登录信息已保存:', userInfo.username || userInfo.name)
    } catch (error) {
      console.error('保存用户信息失败:', error)
    }
  }

  /**
   * 清除用户登录信息
   */
  static clearUserLogin() {
    // 清除全局状态
    const app = this.getAppInstance()
    if (app && app.globalData) {
      app.globalData.userInfo = null
      app.globalData.isLoggedIn = false
    }

    // 清除本地存储
    try {
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('loginTime')
      console.log('用户登录信息已清除')
    } catch (error) {
      console.error('清除用户信息失败:', error)
    }
  }

  /**
   * 检查登录是否过期
   * @param {number} expiryDays 过期天数，默认30天
   * @returns {boolean} 是否已过期
   */
  static isLoginExpired(expiryDays = 30) {
    try {
      const loginTime = wx.getStorageSync('loginTime')
      if (!loginTime) {
        return true
      }

      const loginDate = new Date(loginTime)
      const now = new Date()
      const daysDiff = (now - loginDate) / (1000 * 60 * 60 * 24)

      return daysDiff > expiryDays
    } catch (error) {
      console.error('检查登录过期失败:', error)
      return true
    }
  }

  /**
   * 刷新用户信息（从数据库重新获取）
   * @param {Object} supabase Supabase客户端实例
   * @returns {Promise<Object|null>} 更新后的用户信息
   */
  static async refreshUserInfo(supabase) {
    const currentUser = this.getCurrentUser()
    if (!currentUser) {
      return null
    }

    try {
      let query = supabase.from('users').select('*')
      
      // 根据不同的登录标识查询用户
      if (currentUser.id) {
        query = query.eq('id', currentUser.id)
      } else if (currentUser.openid) {
        query = query.eq('openid', currentUser.openid)
      } else if (currentUser.username) {
        query = query.eq('username', currentUser.username)
      } else {
        return null
      }

      const result = await query.single()
      const data = result.data
      const error = result.error

      if (data && !error) {
        // 合并新旧信息，保留token等登录状态字段
        const updatedUserInfo = {
          ...currentUser,
          ...data,
          token: currentUser.token,
          loginType: currentUser.loginType
        }

        // 更新存储
        this.saveUserLogin(updatedUserInfo)
        return updatedUserInfo
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error)
    }

    return null
  }

  /**
   * 生成简单的token
   * @param {string|number} userId 用户ID
   * @returns {string} token字符串
   */
  static generateToken(userId) {
    return `token_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

module.exports = { Auth }
