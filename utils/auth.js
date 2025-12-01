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

  /**
   * 处理微信登录用户信息
   * @param {Object} wechatUserInfo 微信用户信息
   * @param {Object} supabase Supabase客户端实例
   * @returns {Promise<Object>} 登录结果
   */
  static async handleWechatLogin(wechatUserInfo, supabase) {
    try {
      const { openid, userInfo } = wechatUserInfo
      
      if (!openid) {
        throw new Error('微信登录失败：缺少用户标识')
      }

      // 查询数据库中是否已存在该微信用户
      const { data: existingUser, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('openid', openid)
        .single()

      let userRecord
      
      if (queryError && queryError.code !== 'PGRST116') {
        throw new Error('查询用户失败：' + queryError.message)
      }

      if (existingUser) {
        // 用户已存在，更新登录信息
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            last_login: new Date().toISOString(),
            login_count: (existingUser.login_count || 0) + 1,
            avatar: userInfo.avatarUrl || existingUser.avatar,
            name: userInfo.nickName || existingUser.name,
            language: userInfo.language || existingUser.language,
            status: 'active'
          })
          .eq('id', existingUser.id)
          .select()
          .single()

        if (updateError) {
          throw new Error('更新用户信息失败：' + updateError.message)
        }
        
        userRecord = updatedUser
      } else {
        // 新用户，创建记录
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            openid: openid,
            username: `wx_${openid.substring(0, 8)}`,
            name: userInfo.nickName || '微信用户',
            avatar: userInfo.avatarUrl || '',
            language: userInfo.language || 'zh_CN',
            login_type: 'wechat',
            status: 'active',
            login_count: 1,
            last_login: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          throw new Error('创建用户失败：' + insertError.message)
        }
        
        userRecord = newUser
      }

      // 构建用户登录信息
      const loginUserInfo = {
        id: userRecord.id,
        openid: openid,
        username: userRecord.username,
        name: userRecord.name,
        avatar: userRecord.avatar,
        language: userRecord.language,
        loginType: 'wechat',
        loginTime: new Date().toISOString(),
        token: this.generateToken(userRecord.id)
      }

      // 保存登录信息
      this.saveUserLogin(loginUserInfo, true)

      return {
        success: true,
        user: loginUserInfo,
        isNewUser: !existingUser
      }

    } catch (error) {
      console.error('微信登录处理失败:', error)
      return {
        success: false,
        message: error.message || '微信登录失败'
      }
    }
  }

  /**
   * 获取微信用户信息（兼容方法）
   * @returns {Object|null} 微信用户信息
   */
  static getWechatUser() {
    const userInfo = this.getCurrentUser()
    return userInfo && userInfo.loginType === 'wechat' ? userInfo : null
  }

  /**
   * 检查是否为微信登录用户
   * @returns {boolean} 是否为微信登录用户
   */
  static isWechatUser() {
    const userInfo = this.getCurrentUser()
    return userInfo && userInfo.loginType === 'wechat'
  }

  /**
   * 检查是否为账号登录用户
   * @returns {boolean} 是否为账号登录用户
   */
  static isAccountUser() {
    const userInfo = this.getCurrentUser()
    return userInfo && userInfo.loginType === 'account'
  }
}

module.exports = { Auth }
