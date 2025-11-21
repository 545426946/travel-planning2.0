// pages/login/login.js
const supabase = require('../../utils/supabase').supabase
const Auth = require('../../utils/auth').Auth
const app = getApp()

Page({
  data: {
    // 登录方式：0 - 账号密码，1 - 微信登录
    loginType: 0,
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
    // 显示密码
    showPassword: false,
    // 记住我
    rememberMe: false
  },

  onLoad() {
    console.log('登录页面加载')
    // 检查是否已登录
    if (Auth.isLoggedIn()) {
      this.redirectToHome()
    }
    
    // 加载保存的用户名
    this.loadSavedUsername()
  },

  // 切换登录方式
  switchLoginType(e) {
    const type = parseInt(e.currentTarget.dataset.type)
    this.setData({ loginType: type })
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

  // 账号密码登录
  async accountLogin() {
    if (!this.validateForm()) {
      return
    }

    this.setData({ isLoading: true })

    try {
      const formData = this.data.formData;
      const rememberMe = this.data.rememberMe;

      // 查询用户信息
      const queryResult = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${formData.username},email.eq.${formData.username},phone.eq.${formData.username}`)
        .limit(1)

      const users = queryResult.data;
      const queryError = queryResult.error;

      if (queryError) {
        throw new Error('查询用户失败：' + queryError.message)
      }

      if (!users || users.length === 0) {
        throw new Error('用户不存在')
      }

      const user = users[0]

      // 验证密码（这里需要根据实际密码加密方式调整）
      if (user.password !== formData.password) {
        throw new Error('密码错误')
      }

      // 构建用户信息
      const userInfo = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar || 'https://ai-public.mastergo.com/ai/img_res/65805eacde859672f105ac7cb9520d50.jpg',
        loginType: 'account',
        token: Auth.generateToken(user.id)
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
        icon: 'none'
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 微信一键登录 - 简化版本，不依赖getUserProfile
  wechatLogin() {
    console.log('=== 微信登录(简化版) ===')
    
    this.setData({ isLoading: true })

    // 方案1: 使用模拟数据直接登录（用于测试）
    wx.showModal({
      title: '提示',
      content: '检测到您正在使用开发版。是否使用测试账号登录？',
      confirmText: '使用测试账号',
      cancelText: '尝试真实登录',
      success: (res) => {
        if (res.confirm) {
          // 使用测试账号
          this.loginWithMockData()
        } else {
          // 尝试真实微信登录
          this.loginWithWechat()
        }
      },
      fail: () => {
        this.setData({ isLoading: false })
      }
    })
  },

  // 使用模拟数据登录
  loginWithMockData() {
    console.log('✅ 使用测试账号登录')
    
    const mockUserInfo = {
      id: Date.now(),
      name: '测试用户_' + Math.floor(Math.random() * 1000),
      avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL0FKx4ciche8Pia1W2ib3OQTmN2ib0C7EibnGCuEbHAsSEQMlcOWXx0iaGn70kxOv9icVhLLaAfAUz5iajw/132',
      gender: 1,
      city: '深圳',
      province: '广东',
      country: '中国',
      loginType: 'wechat',
      token: Auth.generateToken(Date.now())
    }

    // 保存登录状态
    Auth.saveUserLogin(mockUserInfo, true)

    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    })

    setTimeout(() => {
      this.redirectToHome()
    }, 1500)

    this.setData({ isLoading: false })
  },

  // 真实微信登录
  async loginWithWechat() {
    try {
      console.log('=== 尝试真实微信登录 ===')

      // 先调用 wx.login 获取 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      console.log('✅ wx.login 成功:', loginRes.code)

      // 然后获取用户信息
      const userInfoRes = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: resolve,
          fail: reject
        })
      })

      console.log('✅ 获取用户信息成功:', userInfoRes.userInfo)

      const timestamp = Date.now()
      const userData = {
        id: timestamp,
        name: userInfoRes.userInfo.nickName || '微信用户',
        avatar: userInfoRes.userInfo.avatarUrl || 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL0FKx4ciche8Pia1W2ib3OQTmN2ib0C7EibnGCuEbHAsSEQMlcOWXx0iaGn70kxOv9icVhLLaAfAUz5iajw/132',
        gender: userInfoRes.userInfo.gender || 0,
        city: userInfoRes.userInfo.city || '',
        province: userInfoRes.userInfo.province || '',
        country: userInfoRes.userInfo.country || '',
        loginType: 'wechat',
        token: Auth.generateToken(timestamp)
      }

      // 保存登录状态
      Auth.saveUserLogin(userData, true)

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      })

      setTimeout(() => {
        this.redirectToHome()
      }, 1500)

    } catch (error) {
      console.error('❌ 微信登录失败:', error)
      
      let errorMsg = '微信登录失败'
      if (error.errMsg) {
        if (error.errMsg.includes('auth deny')) {
          errorMsg = '您拒绝了授权'
        } else if (error.errMsg.includes('getUserProfile')) {
          errorMsg = '获取用户信息失败，请使用测试账号'
        }
      }
      
      wx.showToast({
        title: errorMsg,
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
    wx.switchTab({
      url: '/pages/index/index'
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
  }
})
