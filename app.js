// app.js
// AI Travel 微信小程序

const supabase = require('./utils/supabase').supabase
const Auth = require('./utils/auth').Auth
const { wechatLogin } = require('./utils/wechat-login')

App({
  onLaunch() {
    console.log('小程序启动')
    
    this.checkLoginStatus()
    
    // 获取系统信息
    wx.getWindowInfo({
      success: (res) => {
        this.globalData.systemInfo = res
        console.log('窗口信息:', res)
      }
    })
  },

  onShow() {
    console.log('小程序显示')
  },

  onHide() {
    console.log('小程序隐藏')
  },

  checkLoginStatus() {
    const userInfo = Auth.getCurrentUser()
    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.isLoggedIn = true
      if (Auth.isLoginExpired(30)) {
        Auth.clearUserLogin()
        this.globalData.isLoggedIn = false
        return
      }
      this.updateUserInfo(userInfo)
      setTimeout(async () => {
        const valid = await Auth.validateSessionToken(supabase)
        if (!valid) {
          Auth.clearUserLogin()
          this.globalData.isLoggedIn = false
        }
      }, 0)
    }
  },

  // 更新用户信息
  async updateUserInfo(localUserInfo) {
    const updatedUserInfo = await Auth.refreshUserInfo(supabase)
    if (updatedUserInfo) {
      this.globalData.userInfo = updatedUserInfo
    }
  },

  login() {
    return wechatLogin.login()
  },

  // 退出登录
  logout() {
    Auth.clearUserLogin()
    this.globalData.userInfo = null
    this.globalData.isLoggedIn = false
    console.log('退出登录')
  },

  // 全局数据
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    systemInfo: null,
    supabase: supabase,
    // 高德地图API Key
    amapKey: '26e18d3799a5a6bc8b2bf34e454777a5',
    config: {
      // AI 服务配置
      AI_API_KEY: 'E8L3fryNUIsAoWvROdNrumpwFTtfuCBL',
      AI_API_URL: 'https://api.mistral.ai/v1/chat/completions',
      AI_MODEL: 'mistral-small-latest',
      // Supabase 配置
      SUPABASE_URL: 'https://hmnjuntvubqvbpeyqoxw.supabase.co',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtbmp1bnR2dWJxdmJwZXlxb3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MjEwNDYsImV4cCI6MjA3ODk5NzA0Nn0.BCp0_8M3OhlIhLQ4fz54le-sWqZeUx9JDRXr1XRsX8g'
    }
  }
})
