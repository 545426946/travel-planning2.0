// pages/register/register.js
// 使用真实的 Supabase 连接（需要配置域名白名单）
const supabase = require('../../utils/supabase').supabase
// const supabase = require('../../utils/supabase-mock').supabase
const Auth = require('../../utils/auth').Auth
const app = getApp()

Page({
  data: {
    // 表单数据
    formData: {
      username: '',
      password: '',
      confirmPassword: ''
    },
    // 表单验证
    formErrors: {
      username: '',
      password: '',
      confirmPassword: ''
    },
    // 显示密码
    showPassword: false,
    showConfirmPassword: false,
    // 注册状态
    isLoading: false,
    // 是否同意协议
    agreeTerms: false
  },

  onLoad() {
    console.log('注册页面加载')
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

  toggleConfirmPassword() {
    this.setData({
      showConfirmPassword: !this.data.showConfirmPassword
    })
  },

  // 切换同意协议
  toggleAgree() {
    this.setData({
      agreeTerms: !this.data.agreeTerms
    })
  },

  // 表单验证
  validateForm() {
    const formData = this.data.formData;
    const errors = {}
    let isValid = true

    // 验证用户名
    if (!formData.username.trim()) {
      errors.username = '请输入用户名'
      isValid = false
    } else if (formData.username.length < 3) {
      errors.username = '用户名至少3位'
      isValid = false
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = '用户名只能包含字母、数字和下划线'
      isValid = false
    }

    // 验证密码
    if (!formData.password.trim()) {
      errors.password = '请输入密码'
      isValid = false
    } else if (formData.password.length < 6) {
      errors.password = '密码至少6位'
      isValid = false
    }

    // 验证确认密码
    if (!formData.confirmPassword.trim()) {
      errors.confirmPassword = '请确认密码'
      isValid = false
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致'
      isValid = false
    }

    // 验证协议同意
    if (!this.data.agreeTerms) {
      wx.showToast({
        title: '请同意用户协议和隐私政策',
        icon: 'none'
      })
      isValid = false
    }

    this.setData({ formErrors: errors })
    return isValid
  },

  // 检查用户名是否存在
  async checkUsernameExists(username) {
    try {
      console.log('检查用户名是否存在:', username)
      const result = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .limit(1)

      const data = result.data;
      const error = result.error;

      console.log('用户名检查结果:', { data, error });

      if (error) throw error
      return data && data.length > 0
    } catch (error) {
      console.error('检查用户名失败:', error)
      return false
    }
  },



  // 注册账号
  async register() {
    if (!this.validateForm()) {
      return
    }

    this.setData({ isLoading: true })

    try {
      const formData = this.data.formData;

      // 检查用户名是否已存在
      const usernameExists = await this.checkUsernameExists(formData.username)
      if (usernameExists) {
        this.setData({ 'formErrors.username': '用户名已存在' })
        return
      }

      // 创建新用户
      const newUser = {
        username: formData.username,
        password: formData.password, // 实际项目中应该加密
        name: formData.username, // 使用用户名作为默认显示名
        login_type: 'account',
        status: 'active',
        avatar: 'https://s1.aigei.com/src/img/png/40/401c73a8ae5043528a2ac0b2a41a1e13.png?imageMogr2/auto-orient/thumbnail/!282x282r/gravity/Center/crop/282x282/quality/85/%7CimageView2/2/w/282&e=2051020800&token=P7S2Xpzfz11vAkASLTkfHN7Fw-oOZBecqeJaxypL:lHzyX4Iuq2P-fNxU-t9ookog1Qo='
      }

      const result = await supabase
        .from('users')
        .insert(newUser)
        .select()
        .single()

      const data = result.data;
      const error = result.error;

      console.log('注册结果:', { data, error });

      if (error || !data) {
        console.error('注册数据库错误:', error);
        throw new Error('注册失败：' + (error?.message || '未知错误'))
      }

      // 构建用户信息对象
      const userInfo = {
        id: data.id,
        username: data.username,
        name: data.name,
        avatar: data.avatar,
        loginType: 'account',
        token: Auth.generateToken(data.id)
      }

      console.log('注册成功，构建的用户信息:', userInfo);

      // 使用Auth工具保存登录状态
      Auth.saveUserLogin(userInfo, false)

      wx.showToast({
        title: '注册成功',
        icon: 'success'
      })

      // 延迟跳转到首页
      setTimeout(() => {
        wx.reLaunch({
          url: '/index/index'
        })
      }, 1500)

    } catch (error) {
      console.error('注册失败:', error)
      wx.showToast({
        title: error.message || '注册失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 查看用户协议
  viewUserAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '1. 用户需年满16周岁\n2. 用户需提供真实信息\n3. 用户不得发布违法内容\n4. 用户需保护账号安全\n5. 平台有权违规内容',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 查看隐私政策
  viewPrivacyPolicy() {
    wx.showModal({
      title: '隐私政策',
      content: '1. 我们收集必要的个人信息\n2. 我们不会泄露用户隐私\n3. 用户数据加密存储\n4. 用户有权删除个人信息\n5. 我们会定期更新隐私保护措施',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 返回登录页面
  goToLogin() {
    wx.navigateBack()
  }
})
