// pages/login/login.js
const supabase = require('../../utils/supabase').supabase
const Auth = require('../../utils/auth').Auth
const { wechatLogin } = require('../../utils/wechat-login')

console.log('🔍 模块导入检查:')
console.log('  - supabase:', supabase ? '✅' : '❌')
console.log('  - Auth:', Auth ? '✅' : '❌')
console.log('  - wechatLogin:', wechatLogin ? '✅' : '❌')
if (wechatLogin) {
  console.log('  - wechatLogin.login:', typeof wechatLogin.login)
}

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
    
    // 加载保存的用户名
    this.loadSavedUsername()
  },

  // 切换登录方式
  switchLoginType(e) {
    const type = parseInt(e.currentTarget.dataset.type)
    console.log('🔄 切换登录方式:', type === 0 ? '账号登录' : '微信登录')
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

  // 微信授权登录主方法 - 设置loading状态
  handleWechatLogin() {
    console.log('=========================================')
    console.log('🚀 用户点击微信授权登录按钮')
    console.log('当前环境：', wx.getSystemInfoSync().platform)
    console.log('当前时间:', new Date().toLocaleString())
    console.log('=========================================')
    
    // 防抖处理
    if (this.data.isLoading) {
      console.log('⚠️ 正在登录中，忽略重复点击')
      return
    }

    // 设置loading状态，授权由按钮的open-type自动触发
    this.setData({ isLoading: true })
    console.log('✅ 设置loading状态，等待用户授权...')
  },

  // 完成微信登录（保存用户信息并跳转）- 增强版
  async completeWechatLogin(code, userInfo) {
    console.log('=========================================')
    console.log('🔄 步骤3: 处理登录数据')
    console.log('   - code:', code)
    console.log('   - userInfo:', userInfo)
    console.log('=========================================')
    
    try {
      const timestamp = Date.now()
      const isRealUser = userInfo && !userInfo.isEnhancedGuest
      const isEnhancedGuest = userInfo && userInfo.isEnhancedGuest
      
      // 构建用户数据
      const userData = {
        id: timestamp,
        openid: `wx_${code.substring(0, 10)}_${timestamp}`,
        code: code,
        name: userInfo ? (userInfo.nickName || '微信用户') : `游客${Math.floor(Math.random() * 10000)}`,
        avatar: userInfo ? (userInfo.avatarUrl || 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUl24cLiaEwdBbCHnElQzBf0x9Yc2icJ0Y9nSKhEXQnGHVicHjaNQ6GoAhjibcPA/132') : 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL0FKx4ciche8Pia1W2ib3OQTmN2ib0C7EibnGCuEbHAsSEQMlcOWXx0iaGn70kxOv9icVhLLaAfAUz5iajw/132',
        gender: userInfo ? (userInfo.gender || 0) : 0,
        city: userInfo ? (userInfo.city || '') : '',
        province: userInfo ? (userInfo.province || '') : '',
        country: userInfo ? (userInfo.country || '') : '',
        loginType: 'wechat',
        hasRealInfo: isRealUser,
        isEnhancedGuest: isEnhancedGuest,
        platform: userInfo ? userInfo.platform : 'unknown',
        loginTime: timestamp,
        token: Auth.generateToken(timestamp)
      }

      console.log('📦 构建的用户数据:')
      console.log('   - 昵称:', userData.name)
      console.log('   - 头像:', userData.avatar)
      console.log('   - 登录类型:', isRealUser ? '✅ 真实微信用户' : (isEnhancedGuest ? '🔄 增强游客模式' : '❌ 基础游客模式'))
      console.log('   - 平台:', userData.platform)

      // 尝试保存到数据库
      try {
        const { error } = await supabase
          .from('users')
          .upsert({
            openid: userData.openid,
            name: userData.name,
            avatar: userData.avatar,
            gender: userData.gender,
            city: userData.city,
            province: userData.province,
            country: userData.country,
            login_type: 'wechat',
            has_real_info: userData.hasRealInfo,
            platform: userData.platform,
            last_login_time: new Date().toISOString()
          }, {
            onConflict: 'openid'
          })

        if (error) {
          console.warn('⚠️ 保存用户信息到数据库失败:', error.message)
        } else {
          console.log('✅ 用户信息已保存到数据库')
        }
      } catch (dbError) {
        console.warn('⚠️ 数据库操作异常:', dbError)
      }

      // 保存登录状态到本地存储
      console.log('💾 保存登录状态到本地...')
      try {
        Auth.saveUserLogin(userData, true)
        console.log('✅ 登录状态已保存')
      } catch (saveError) {
        console.error('❌ 保存登录状态失败:', saveError)
        throw saveError
      }

      // 显示优化后的成功提示
      let toastTitle = '登录成功'
      if (isRealUser) {
        toastTitle = '微信登录成功'
      } else if (isEnhancedGuest) {
        toastTitle = '微信登录成功' // 不显示"游客"字样，避免用户困惑
      } else {
        toastTitle = '登录成功'
      }

      wx.showToast({
        title: toastTitle,
        icon: 'success',
        duration: 1500
      })

      console.log('✅ 微信登录完成，1.5秒后跳转首页')
      console.log('=========================================')

      // 延迟跳转到首页
      setTimeout(() => {
        this.redirectToHome()
      }, 1500)

    } catch (error) {
      console.error('❌ 处理登录数据失败:', error)
      console.error('   - 错误栈:', error.stack)
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      })
      this.setData({ isLoading: false })
    }
  },

  // 微信登录 - 使用 getUserProfile（真机支持）
  wechatLoginWithProfile() {
    console.log('=== 微信登录按钮被点击 ===')
    
    // 防抖
    if (this.data.isLoading) {
      console.log('⚠️ 正在登录中')
      return
    }

    this.setData({ isLoading: true })

    // 先调用 wx.login 获取 code
    wx.login({
      success: (loginRes) => {
        console.log('✅ wx.login 成功，code:', loginRes.code)
        
        // 然后调用 getUserProfile 获取用户信息
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: (profileRes) => {
            console.log('✅ 获取用户信息成功:', profileRes.userInfo)
            this.processWechatLogin(loginRes.code, profileRes.userInfo)
          },
          fail: (err) => {
            console.error('❌ 获取用户信息失败:', err)
            
            // 如果是用户拒绝授权
            if (err.errMsg.includes('cancel') || err.errMsg.includes('deny')) {
              wx.showToast({
                title: '您取消了授权',
                icon: 'none',
                duration: 2000
              })
              this.setData({ isLoading: false })
              return
            }
            
            // 如果是开发工具或其他原因失败，使用游客模式
            console.log('🔄 getUserProfile 不可用，使用游客模式')
            this.processWechatLogin(loginRes.code, null)
          }
        })
      },
      fail: (err) => {
        console.error('❌ wx.login 失败:', err)
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none',
          duration: 2000
        })
        this.setData({ isLoading: false })
      }
    })
  },

  // 处理微信登录数据
  async processWechatLogin(code, userInfo) {
    try {
      const timestamp = Date.now()
      
      // 构建用户数据
      const userData = {
        id: timestamp,
        openid: `wx_${code.substring(0, 10)}_${timestamp}`,
        name: userInfo ? (userInfo.nickName || '微信用户') : `游客_${Math.floor(Math.random() * 10000)}`,
        avatar: userInfo ? userInfo.avatarUrl : 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL0FKx4ciche8Pia1W2ib3OQTmN2ib0C7EibnGCuEbHAsSEQMlcOWXx0iaGn70kxOv9icVhLLaAfAUz5iajw/132',
        gender: userInfo ? (userInfo.gender || 0) : 0,
        city: userInfo ? (userInfo.city || '') : '',
        province: userInfo ? (userInfo.province || '') : '',
        country: userInfo ? (userInfo.country || '') : '',
        loginType: 'wechat',
        loginTime: timestamp,
        isRealUser: !!userInfo, // 标记是否是真实用户信息
        token: Auth.generateToken(timestamp)
      }

      console.log('📦 构建的用户数据:', userData)
      console.log(userInfo ? '✅ 使用真实微信信息' : '⚠️ 使用游客模式（开发工具或用户拒绝授权）')

      // 尝试保存到数据库（可选）
      try {
        const { error } = await supabase
          .from('users')
          .upsert({
            openid: userData.openid,
            name: userData.name,
            avatar: userData.avatar,
            gender: userData.gender,
            city: userData.city,
            province: userData.province,
            country: userData.country,
            login_type: 'wechat',
            last_login_time: new Date().toISOString()
          }, {
            onConflict: 'openid'
          })

        if (error) {
          console.warn('⚠️ 保存用户信息到数据库失败:', error.message)
        } else {
          console.log('✅ 用户信息已保存到数据库')
        }
      } catch (dbError) {
        console.warn('⚠️ 数据库操作异常:', dbError)
      }

      // 保存登录状态到本地
      Auth.saveUserLogin(userData, true)

      // 登录成功提示
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      })

      console.log('✅ 微信登录成功，即将跳转首页')

      // 延迟跳转到首页
      setTimeout(() => {
        this.redirectToHome()
      }, 1500)

    } catch (error) {
      console.error('❌ 处理登录数据失败:', error)
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 处理微信授权回调（使用 open-type="getUserInfo" 方式）- 优化版
  async handleGetUserInfo(e) {
    console.log('===========================================')
    console.log('=== handleGetUserInfo 被调用 ===')
    console.log('完整回调参数:', JSON.stringify(e))
    console.log('e.detail:', e.detail)
    console.log('e.detail.userInfo:', e.detail.userInfo)
    console.log('e.detail.rawData:', e.detail.rawData)
    console.log('e.detail.errMsg:', e.detail.errMsg)
    console.log('===========================================')

    // 防抖
    if (this.data.isLoading) {
      console.log('⚠️ 正在登录中，忽略重复点击')
      return
    }

    // 检查授权结果
    let userInfo = e.detail.userInfo
    
    if (!userInfo) {
      console.log('⚠️ 用户拒绝授权或未获取到用户信息')
      console.log('errMsg:', e.detail.errMsg)
      
      // 如果用户拒绝授权，询问是否使用游客模式
      const useGuestMode = await this.promptGuestMode()
      if (useGuestMode) {
        userInfo = this.createEnhancedGuestUser()
      } else {
        wx.showToast({
          title: '已取消登录',
          icon: 'none',
          duration: 2000
        })
        this.setData({ isLoading: false })
        return
      }
    }

    try {
      console.log('✅ 获取到用户信息:', userInfo)
      console.log('📞 正在调用 wx.login 获取 code...')

      // 在获取到用户信息后调用 wx.login 获取 code
      const loginRes = await this.getWxLoginCode()
      console.log('✅ wx.login 成功，code:', loginRes.code)

      // 使用新获取的 code 和 userInfo 完成登录
      await this.completeWechatLogin(loginRes.code, userInfo)
      
    } catch (error) {
      console.error('❌ 微信登录处理失败:', error)
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 获取微信登录码
  getWxLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject,
        timeout: 10000
      })
    })
  },

  // 提示用户是否使用游客模式
  promptGuestMode() {
    return new Promise((resolve) => {
      wx.showModal({
        title: '授权提示',
        content: '未获取到您的微信信息，是否使用游客模式继续登录？',
        confirmText: '继续登录',
        cancelText: '重新授权',
        success: (res) => {
          if (res.confirm) {
            console.log('✅ 用户选择游客模式')
            resolve(true)
          } else {
            console.log('❌ 用户选择重新授权')
            resolve(false)
          }
        },
        fail: () => resolve(false)
      })
    })
  },

  // 创建增强的游客用户信息
  createEnhancedGuestUser() {
    const timestamp = Date.now()
    const randomId = Math.floor(Math.random() * 10000)
    
    return {
      nickName: `微信用户${randomId}`,
      avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUl24cLiaEwdBbCHnElQzBf0x9Yc2icJ0Y9nSKhEXQnGHVicHjaNQ6GoAhjibcPA/132',
      gender: 0,
      city: '',
      province: '',
      country: '',
      isEnhancedGuest: true, // 标记为增强游客
      platform: wx.getSystemInfoSync().platform
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

  // 带用户信息授权的微信登录
  async handleWechatLoginWithUserInfo(e) {
    console.log('🚀 用户点击微信登录按钮（获取用户信息）')
    console.log('当前环境：', wx.getAccountInfoSync().platform)
    console.log('当前时间:', new Date().toLocaleString())
    console.log('========================================')

    this.setData({ isLoading: true })

    try {
      let userInfo = null
      
      // 检查是否获取到了用户信息
      if (e.detail && e.detail.userInfo) {
        userInfo = e.detail.userInfo
        console.log('✅ 已获取用户信息:', userInfo)
        
        // 将用户信息保存到微信登录服务中，供Edge Function使用
        if (wechatLogin.setUserInfo) {
          wechatLogin.setUserInfo(userInfo)
        }
      } else {
        console.log('⚠️ 用户未授权，将使用默认信息')
        // 如果用户没有授权，直接失败，不使用默认信息
        wx.showToast({
          title: '需要授权才能登录',
          icon: 'none',
          duration: 2000
        })
        this.setData({ isLoading: false })
        return
      }

      // 使用微信登录服务（通过Edge Function）
      console.log('📞 开始调用 wechatLogin.login()')
      const loginResult = await wechatLogin.login()
      
      if (loginResult.success) {
        console.log('✅ 微信登录成功!')
        console.log('   - token:', loginResult.token)
        console.log('   - userInfo:', loginResult.userInfo)
        
        // 登录成功提示
        wx.showToast({
          title: '微信登录成功',
          icon: 'success',
          duration: 1500
        })
        
        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          this.redirectToHome()
        }, 1500)
        
      } else {
        throw new Error(loginResult.error || '登录失败')
      }
      
    } catch (error) {
      console.error('❌ 微信登录失败:', error)
      
      wx.showToast({
        title: error.message || '登录失败，请重试',
        icon: 'none',
        duration: 2000
      })
      
    } finally {
      this.setData({ isLoading: false })
    }
  },


})
