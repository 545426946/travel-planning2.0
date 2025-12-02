// pages/login/login.js - 支持微信登录和账号密码登录
const supabase = require('../../utils/supabase').supabase
const WeChatAuth = require('../../utils/wechat-auth').WeChatAuth
const Auth = require('../../utils/auth').Auth
const avatarModule = require('../../utils/avatar')
const AvatarManager = avatarModule.AvatarManager

console.log('🔍 模块导入检查:')
console.log('  - supabase:', supabase ? '✅' : '❌')
console.log('  - WeChatAuth:', WeChatAuth ? '✅' : '❌')
console.log('  - Auth:', Auth ? '✅' : '❌')
console.log('  - avatarModule:', avatarModule ? '✅' : '❌')
console.log('  - AvatarManager:', AvatarManager ? '✅' : '❌')

Page({
  data: {
    // 登录方式切换
    loginMethod: 'wechat', // 'wechat' | 'account'
    // 表单数据
    formData: {
      username: '',
      password: ''
    },
    // 表单验证
    formErrors: {
      username: '',
      password: ''
    },
    // 登录状态
    isLoading: false,
    // 微信登录状态
    wechatLoading: false,
    // 显示密码
    showPassword: false,
    // 记住我
    rememberMe: false,
    // 微信授权状态
    wechatAuthStatus: 'pending' // 'pending' | 'granted' | 'denied'
  },

  onLoad() {
    console.log('========================================')
    console.log('✅ 登录页面加载成功')
    console.log('当前页面 data:', this.data)
    console.log('========================================')
    
    // 检查是否已登录
    if (Auth.isLoggedIn()) {
      console.log('⚠️ 用户已登录，跳转到首页')
      this.redirectToHome()
      return
    }
    
    // 检查微信登录状态
    this.checkWechatAuthStatus()
    
    // 加载保存的用户名
    this.loadSavedUsername()
  },



  // 表单输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    const formData = Object.assign({}, this.data.formData)
    formData[field] = value
    
    this.setData({ 
      formData,
      [`formErrors.${field}`]: '' // 清除该字段的错误
    })
  },

  // 切换密码显示
  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    })
  },

  // 切换记住我
  toggleRemember() {
    this.setData({
      rememberMe: !this.data.rememberMe
    })
  },

  // 表单验证
  validateForm() {
    const formData = this.data.formData;
    const errors = {}
    let isValid = true

    if (!formData.username.trim()) {
      errors.username = '请输入用户名/邮箱/手机号'
      isValid = false
    }

    if (!formData.password.trim()) {
      errors.password = '请输入密码'
      isValid = false
    } else if (formData.password.length < 6) {
      errors.password = '密码至少6位'
      isValid = false
    }

    this.setData({ formErrors: errors })
    return isValid
  },

  // 切换登录方式
  switchLoginMethod(e) {
    const method = e.currentTarget.dataset.method
    this.setData({ loginMethod: method })
    
    if (method === 'wechat') {
      // 尝试微信登录
      this.performWechatLogin()
    }
  },

  // 检查微信授权状态
  checkWechatAuthStatus() {
    wx.getSetting({
      success: (res) => {
        const authSetting = res.authSetting
        if (authSetting['scope.userInfo']) {
          this.setData({ wechatAuthStatus: 'granted' })
        } else {
          this.setData({ wechatAuthStatus: 'denied' })
        }
      }
    })
  },

  // 执行微信登录
  async performWechatLogin() {
    this.setData({ wechatLoading: true })
    
    try {
      let preProfile = null
      try {
        preProfile = await WeChatAuth.getUserProfile()
      } catch (e) {}
      if (preProfile && preProfile.nickName) {
        this.setData({ wechatAuthStatus: 'granted' })
      }
      const result = await WeChatAuth.wechatLogin({
        getUserProfile: false,
        userProfile: preProfile
      })

      if (result.success && result.userInfo) {
        let avatarDisplayUrl = ''
        
        // 安全地获取头像显示URL
        try {
          if (result.userInfo.id) {
            avatarDisplayUrl = await AvatarManager.getAvatarDisplayUrl(result.userInfo.id, result.userInfo)
          } else {
            // 如果没有用户ID，优先使用微信头像
            if (preProfile && preProfile.avatarUrl) {
              avatarDisplayUrl = preProfile.avatarUrl
            } else {
              avatarDisplayUrl = AvatarManager.generateDefaultAvatar(result.userInfo.name || '用户')
            }
          }
        } catch (avatarError) {
          console.warn('头像处理失败，使用默认头像:', avatarError)
          avatarDisplayUrl = AvatarManager.generateDefaultAvatar(result.userInfo.name || '用户')
        }
        
        // 更新用户信息中的头像URL
        result.userInfo.avatar = avatarDisplayUrl
        
        // 构建登录用户信息
        const numericId = (() => {
          const id = result.userInfo.id
          return (typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id))) ? id : null
        })()
        const normalizedUsername = (result.userInfo.username || `wx_${(result.userInfo.openid || '').replace(/^wx_/, '').substring(0, 8)}`).replace(/^wx_wx_/, 'wx_')
        const loginUserInfo = {
          id: numericId,
          openid: result.userInfo.openid,
          username: normalizedUsername,
          name: result.userInfo.name || preProfile?.nickName || '微信用户',
          avatar: avatarDisplayUrl,
          avatar_type: (result.userInfo.avatar_type || (preProfile?.avatarUrl ? 'wechat' : 'default')),
          loginType: 'wechat',
          loginTime: new Date().toISOString(),
          token: result.userInfo.token || Auth.generateToken(result.userInfo.openid)
        }

        // 保存登录状态
        Auth.saveUserLogin(loginUserInfo, true)
        
        wx.showToast({
          title: '微信登录成功',
          icon: 'success'
        })

        setTimeout(() => {
          this.redirectToHome()
        }, 1500)
      } else {
        throw new Error(result.message || '微信登录失败')
      }

    } catch (error) {
      console.error('微信登录失败:', error)
      if (this.data.wechatAuthStatus !== 'granted') {
        wx.showToast({ title: '请授权获取微信头像与昵称', icon: 'none' })
      }
      wx.showToast({
        title: error.message || '微信登录失败',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({ wechatLoading: false })
    }
  },

  // 账号密码登录
  async accountLogin() {
    if (!this.validateForm()) {
      return
    }

    this.setData({ isLoading: true })

    try {
      const formData = this.data.formData;
      const rememberMe = this.data.rememberMe;

      // 查询用户信息 - 支持用户名、邮箱、手机号登录
      const queryResult = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${formData.username},email.eq.${formData.username},phone.eq.${formData.username}`)
        .eq('status', 'active')
        .limit(1)

      const users = queryResult.data;
      const queryError = queryResult.error;

      console.log('登录查询结果:', { users, queryError, username: formData.username });

      if (queryError) {
        console.error('查询用户数据库错误:', queryError);
        throw new Error('查询用户失败：' + queryError.message)
      }

      if (!users || users.length === 0) {
        console.log('未找到用户，查询条件:', { username: formData.username });
        throw new Error('用户不存在或已被禁用')
      }

      const user = users[0]

      if (user.password !== formData.password) {
        throw new Error('密码错误')
      }

      // 更新最后登录时间和登录次数
      if (user && user.id) {
        await supabase
          .from('users')
          .update({ 
            last_login: new Date().toISOString(),
            login_count: (user.login_count || 0) + 1
          })
          .eq('id', user.id)
      } else {
        console.warn('用户ID无效，跳过登录信息更新:', { user })
      }

      // 获取头像显示URL
      const avatarDisplayUrl = await AvatarManager.getAvatarDisplayUrl(user.id, user)

      // 构建用户信息
      const userInfo = {
        id: user.id,
        name: user.name || user.username,
        username: user.username,
        email: user.email,
        phone: user.phone,
        avatar: avatarDisplayUrl,
        avatar_type: user.avatar_type || 'default',
        loginType: 'account',
        loginTime: new Date().toISOString(),
        token: Auth.generateToken(user.id)
      }

      // 保存用户名（如果选择了记住我）
      if (rememberMe) {
        wx.setStorageSync('savedUsername', formData.username)
      } else {
        wx.removeStorageSync('savedUsername')
      }

      // 使用Auth工具保存用户信息
      Auth.saveUserLogin(userInfo, rememberMe)

      // 登录成功
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })

      setTimeout(() => {
        this.redirectToHome()
      }, 1500)

    } catch (error) {
      console.error('账号登录失败:', error)
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },





  // 加载保存的用户名
  loadSavedUsername() {
    const savedUsername = wx.getStorageSync('savedUsername')
    if (savedUsername) {
      this.setData({
        'formData.username': savedUsername,
        rememberMe: true
      })
    }
  },

  // 跳转到首页
  redirectToHome() {
    wx.reLaunch({
      url: '/index/index'
    })
  },

  // 忘记密码
  forgotPassword() {
    wx.showModal({
      title: '忘记密码',
      content: '请联系客服重置密码\n客服电话：400-123-4567',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 跳转到注册页面
  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    })
  },

  // 查看用户协议
  viewUserAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '使用本应用即表示您同意我们的服务条款和隐私政策。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 查看隐私政策
  viewPrivacyPolicy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私，所有用户数据都将得到保护。',
      showCancel: false,
      confirmText: '知道了'
    })
  },




})
