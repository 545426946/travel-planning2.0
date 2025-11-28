// app.js
const supabase = require('./utils/supabase').supabase
const Auth = require('./utils/auth').Auth

App({
  onLaunch() {
    console.log('小程序启动')
    
    // 检查登录状态
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

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = Auth.getCurrentUser()
    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.isLoggedIn = true
      
      // 检查登录是否过期
      if (Auth.isLoginExpired(30)) {
        console.log('登录已过期，需要重新登录')
        Auth.clearUserLogin()
        this.globalData.isLoggedIn = false
        return
      }
      
      // 检查用户信息是否完整，如果不完整则尝试从数据库更新
      if (!userInfo.id || !userInfo.name) {
        this.updateUserInfo(userInfo)
      }
    }
  },

  // 更新用户信息
  async updateUserInfo(localUserInfo) {
    const updatedUserInfo = await Auth.refreshUserInfo(supabase)
    if (updatedUserInfo) {
      this.globalData.userInfo = updatedUserInfo
    }
  },

  // 微信登录方法（支持获取真实用户信息）
  wechatLogin(userInfo = null) {
    return new Promise((resolve, reject) => {
      // 微信登录获取code
      wx.login({
        success: (loginRes) => {
          if (loginRes.code) {
            console.log('微信登录成功，code:', loginRes.code)
            
            // 生成临时openid（实际应该通过后端用code换取真实openid）
            const timestamp = Date.now()
            const openid = userInfo && userInfo.openid 
              ? userInfo.openid 
              : `wx_${loginRes.code.substring(0, 10)}_${timestamp}`
            
            // 构建用户信息
            const finalUserInfo = {
              id: userInfo?.id || timestamp,
              name: userInfo?.name || userInfo?.nickName || '微信用户',
              avatar: userInfo?.avatar || userInfo?.avatarUrl || 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL0FKx4ciche8Pia1W2ib3OQTmN2ib0C7EibnGCuEbHAsSEQMlcOWXx0iaGn70kxOv9icVhLLaAfAUz5iajw/132',
              token: loginRes.code,
              openid: openid,
              gender: userInfo?.gender || 0,
              city: userInfo?.city || '',
              province: userInfo?.province || '',
              country: userInfo?.country || '',
              loginType: 'wechat'
            }
            
            // 尝试保存用户到数据库
            supabase
              .from('users')
              .upsert({
                openid: finalUserInfo.openid,
                name: finalUserInfo.name,
                avatar: finalUserInfo.avatar,
                gender: finalUserInfo.gender,
                city: finalUserInfo.city,
                province: finalUserInfo.province,
                country: finalUserInfo.country,
                login_type: 'wechat',
                last_login: new Date().toISOString()
              })
              .select()
              .then((result) => {
                const data = result.data;
                const error = result.error;
                if (error) {
                  console.warn('保存用户到数据库失败:', error)
                } else if (data && data.length > 0) {
                  finalUserInfo.id = data[0].id
                  console.log('用户信息已保存到数据库:', data[0])
                }
                
                this.globalData.userInfo = finalUserInfo
                this.globalData.isLoggedIn = true
                
                // 保存用户信息到本地存储
                Auth.saveUserLogin(finalUserInfo, true)
                
                resolve(finalUserInfo)
              })
              .catch((dbError) => {
                console.warn('数据库操作出错:', dbError)
                // 即使数据库操作失败，也继续登录流程
                this.globalData.userInfo = finalUserInfo
                this.globalData.isLoggedIn = true
                Auth.saveUserLogin(finalUserInfo, true)
                resolve(finalUserInfo)
              })
          } else {
            reject(new Error('获取微信登录code失败'))
          }
        },
        fail: (error) => {
          console.error('微信登录失败:', error)
          reject(error)
        }
      })
    })
  },

  // 通用登录方法（保持向后兼容）
  login() {
    return this.wechatLogin()
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
    baseUrl: 'https://your-api-domain.com/api', // API基础URL
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