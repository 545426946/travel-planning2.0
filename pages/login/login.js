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

  // 微信一键登录
  async wechatLogin() {
    this.setData({ isLoading: true })

    try {
      console.log('开始微信登录流程...')

      // 1. 先获取用户信息（必须在用户手势中调用，如button的bindtap）
      const userInfoRes = await this.getUserProfile()
      console.log('获取用户信息成功:', userInfoRes.userInfo)

      // 2. 调用微信登录获取code
      const loginRes = await this.wechatLoginRequest()
      
      if (!loginRes.code) {
        throw new Error('微信登录授权失败')
      }

      console.log('微信登录code:', loginRes.code)

      // 3. 构建用户数据
      // 注意：在生产环境中，应该将code发送到后端，后端调用微信API换取openid和session_key
      // 这里我们使用code作为临时标识（仅用于演示）
      const timestamp = Date.now()
      const openid = `wx_${loginRes.code.substring(0, 10)}_${timestamp}` // 模拟openid
      
      const userData = {
        openid: openid,
        name: userInfoRes.userInfo.nickName || '微信用户',
        avatar: userInfoRes.userInfo.avatarUrl || 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL0FKx4ciche8Pia1W2ib3OQTmN2ib0C7EibnGCuEbHAsSEQMlcOWXx0iaGn70kxOv9icVhLLaAfAUz5iajw/132',
        gender: userInfoRes.userInfo.gender || 0,
        city: userInfoRes.userInfo.city || '',
        province: userInfoRes.userInfo.province || '',
        country: userInfoRes.userInfo.country || '',
        loginType: 'wechat'
      }

      console.log('用户数据:', userData)

      // 4. 查询数据库中是否已存在该用户
      const existingUserResult = await new Promise((resolve) => {
        supabase
          .from('users')
          .select('*')
          .eq('openid', userData.openid)
          .limit(1)
          .then(resolve)
      })

      let finalUserInfo

      if (existingUserResult.data && existingUserResult.data.length > 0) {
        // 用户已存在，更新登录时间和头像
        console.log('用户已存在，更新信息')
        const updateResult = await new Promise((resolve) => {
          supabase
            .from('users')
            .update({
              name: userData.name,
              avatar: userData.avatar,
              last_login: new Date().toISOString()
            })
            .eq('openid', userData.openid)
            .select()
            .then(resolve)
        })

        if (updateResult.data && updateResult.data.length > 0) {
          finalUserInfo = updateResult.data[0]
        } else {
          finalUserInfo = existingUserResult.data[0]
        }
      } else {
        // 新用户，创建账号
        console.log('新用户，创建账号')
        const insertResult = await new Promise((resolve) => {
          supabase
            .from('users')
            .insert({
              openid: userData.openid,
              name: userData.name,
              avatar: userData.avatar,
              gender: userData.gender,
              city: userData.city,
              province: userData.province,
              country: userData.country,
              login_type: 'wechat',
              created_at: new Date().toISOString(),
              last_login: new Date().toISOString()
            })
            .select()
            .then(resolve)
        })

        if (insertResult.error) {
          console.error('创建用户失败:', insertResult.error)
          throw new Error('创建用户失败')
        }

        finalUserInfo = insertResult.data[0]
      }

      console.log('最终用户信息:', finalUserInfo)

      // 5. 构建登录用户信息
      const loginUserInfo = {
        id: finalUserInfo.id,
        name: finalUserInfo.name,
        avatar: finalUserInfo.avatar,
        openid: finalUserInfo.openid,
        gender: finalUserInfo.gender,
        city: finalUserInfo.city,
        province: finalUserInfo.province,
        country: finalUserInfo.country,
        loginType: 'wechat',
        token: Auth.generateToken(finalUserInfo.id)
      }

      // 6. 使用Auth工具保存登录状态
      Auth.saveUserLogin(loginUserInfo, true) // 微信登录默认记住登录状态

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      })

      // 7. 延迟跳转到首页
      setTimeout(() => {
        this.redirectToHome()
      }, 1500)

    } catch (error) {
      console.error('微信登录失败:', error)
      
      // 根据不同的错误类型显示不同的提示
      let errorMsg = '微信登录失败'
      if (error.errMsg && error.errMsg.includes('getUserProfile:fail auth deny')) {
        errorMsg = '您拒绝了授权，无法登录'
      } else if (error.message) {
        errorMsg = error.message
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

  // 封装微信登录API
  wechatLoginRequest() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          console.log('wx.login 成功:', res)
          resolve(res)
        },
        fail: (err) => {
          console.error('wx.login 失败:', err)
          reject(err)
        }
      })
    })
  },

  // 获取用户信息（使用 getUserProfile）
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料，提供更好的旅行规划服务',
        success: (res) => {
          console.log('getUserProfile 成功:', res)
          resolve(res)
        },
        fail: (err) => {
          console.error('getUserProfile 失败:', err)
          reject(err)
        }
      })
    })
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