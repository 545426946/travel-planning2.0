// pages/profile/profile.js - 用户个人资料页面

const AvatarManager = require('../../utils/avatar').AvatarManager
const Auth = require('../../utils/auth').Auth

Page({
  data: {
    userInfo: null,
    avatarLoading: false,
    wechatAvatarLoading: false,
    resetLoading: false,
    usernameLoading: false,
    nicknameLoading: false
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    // 页面显示时刷新用户信息
    this.loadUserInfo()
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      const userInfo = Auth.getCurrentUser()
      
      if (!userInfo) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/login/login'
          })
        }, 1500)
        return
      }

      // 获取完整的用户信息
      const { supabase } = require('../../utils/supabase')
      const { data: fullUserInfo, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userInfo.id)
        .single()

      if (error) {
        console.error('获取用户信息失败:', error)
        // 使用缓存的信息
        this.setData({ userInfo })
        return
      }

      // 获取头像显示URL
      const avatarDisplayUrl = await AvatarManager.getAvatarDisplayUrl(fullUserInfo.id, fullUserInfo)
      fullUserInfo.avatar = avatarDisplayUrl

      this.setData({ userInfo: fullUserInfo })

      // 更新缓存的用户信息
      const updatedUserInfo = {
        ...userInfo,
        ...fullUserInfo,
        loginType: fullUserInfo.login_type,
        token: userInfo.token // 保留token
      }
      Auth.saveUserLogin(updatedUserInfo)

    } catch (error) {
      console.error('加载用户信息失败:', error)
      wx.showToast({
        title: '加载用户信息失败',
        icon: 'none'
      })
    }
  },

  /**
   * 更换头像
   */
  async changeAvatar() {
    if (this.data.avatarLoading) return

    this.setData({ avatarLoading: true })

    try {
      const userId = this.data.userInfo.id
      
      // 选择并上传头像
      const result = await AvatarManager.chooseAndUploadAvatar(userId)
      
      if (result.success) {
        wx.showToast({
          title: '头像上传成功',
          icon: 'success'
        })
        
        // 重新加载用户信息
        await this.loadUserInfo()
      } else {
        throw new Error(result.error || '头像上传失败')
      }

    } catch (error) {
      console.error('更换头像失败:', error)
      wx.showToast({
        title: error.message || '更换头像失败',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({ avatarLoading: false })
    }
  },

  /**
   * 设置微信头像
   */
  async setWechatAvatar() {
    if (this.data.wechatAvatarLoading) return

    wx.showModal({
      title: '确认操作',
      content: '确定要使用微信头像吗？这将替换当前的头像。',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ wechatAvatarLoading: true })
          
          try {
            const userId = this.data.userInfo.id
            
            // 获取微信用户信息
            const WeChatAuth = require('../../utils/wechat-auth').WeChatAuth
            const userProfile = await WeChatAuth.getUserProfile()
            if (!userProfile || !userProfile.avatarUrl) {
              throw new Error('获取微信用户信息失败')
            }

            // 设置微信头像
            const avatarResult = await AvatarManager.setWechatAvatar(
              userId,
              userProfile.avatarUrl
            )
            
            if (avatarResult.success) {
              wx.showToast({
                title: '微信头像设置成功',
                icon: 'success'
              })
              
              // 重新加载用户信息
              await this.loadUserInfo()
            } else {
              throw new Error(avatarResult.error || '设置微信头像失败')
            }

          } catch (error) {
            console.error('设置微信头像失败:', error)
            wx.showToast({
              title: error.message || '设置微信头像失败',
              icon: 'none',
              duration: 2000
            })
          } finally {
            this.setData({ wechatAvatarLoading: false })
          }
        }
      }
    })
  },

  /**
   * 重置为默认头像
   */
  async resetToDefaultAvatar() {
    if (this.data.resetLoading) return

    wx.showModal({
      title: '确认操作',
      content: '确定要使用默认头像吗？这将替换当前的头像。',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ resetLoading: true })
          
          try {
            const userId = this.data.userInfo.id
            const userName = this.data.userInfo.name || this.data.userInfo.username || '用户'
            
            const result = await AvatarManager.setDefaultAvatar(userId, userName)
            
            if (result.success) {
              wx.showToast({
                title: '已使用默认头像',
                icon: 'success'
              })
              
              // 重新加载用户信息
              await this.loadUserInfo()
            } else {
              throw new Error(result.error || '设置默认头像失败')
            }

          } catch (error) {
            console.error('重置头像失败:', error)
            wx.showToast({
              title: error.message || '重置头像失败',
              icon: 'none',
              duration: 2000
            })
          } finally {
            this.setData({ resetLoading: false })
          }
        }
      }
    })
  },

  async changeUsername() {
    if (this.data.usernameLoading) return

    const currentUser = Auth.getCurrentUser()
    if (!currentUser || !currentUser.id) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '修改用户名',
      content: '请输入新用户名',
      editable: true,
      placeholderText: '3-20位字母、数字或下划线',
      success: async (res) => {
        if (!res.confirm) return
        const newUsername = (res.content || '').trim()

        if (!newUsername) {
          wx.showToast({ title: '用户名不能为空', icon: 'none' })
          return
        }

        const valid = /^[A-Za-z0-9_]{3,20}$/.test(newUsername)
        if (!valid) {
          wx.showToast({ title: '格式不合法', icon: 'none' })
          return
        }

        if (currentUser.username && newUsername === currentUser.username) {
          wx.showToast({ title: '用户名未改变', icon: 'none' })
          return
        }

        if ((currentUser.email && newUsername === currentUser.email) || (currentUser.phone && newUsername === currentUser.phone)) {
          wx.showToast({ title: '需与账号区分', icon: 'none' })
          return
        }

        this.setData({ usernameLoading: true })

        try {
          const { supabase } = require('../../utils/supabase')

          const existsRes = await supabase
            .from('users')
            .select('id')
            .eq('username', newUsername)
            .single()

          if (existsRes && existsRes.data && existsRes.data.id && String(existsRes.data.id) !== String(currentUser.id)) {
            wx.showToast({ title: '用户名已被占用', icon: 'none' })
            return
          }

          const updateRes = await supabase
            .from('users')
            .update({ username: newUsername, updated_at: new Date().toISOString() })
            .eq('id', currentUser.id)
            .select()
            .single()

          if (updateRes.error) {
            throw new Error(updateRes.error.message)
          }

          const updated = { ...currentUser, username: updateRes.data.username }
          Auth.saveUserLogin(updated, true)
          this.setData({ userInfo: updated })
          wx.showToast({ title: '修改成功', icon: 'success' })
        } catch (e) {
          wx.showToast({ title: e.message || '修改失败', icon: 'none' })
        } finally {
          this.setData({ usernameLoading: false })
        }
      }
    })
  },

  async changeNickname() {
    if (this.data.nicknameLoading) return

    const currentUser = Auth.getCurrentUser()
    if (!currentUser || !currentUser.id) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '修改昵称',
      content: '请输入新昵称',
      editable: true,
      placeholderText: '1-20个字符，支持中文',
      success: async (res) => {
        if (!res.confirm) return
        const newName = (res.content || '').trim()

        if (!newName) {
          wx.showToast({ title: '昵称不能为空', icon: 'none' })
          return
        }

        const valid = /^[\u4e00-\u9fa5A-Za-z0-9_\s]{1,20}$/.test(newName)
        if (!valid) {
          wx.showToast({ title: '格式不合法', icon: 'none' })
          return
        }

        if (currentUser.name && newName === currentUser.name) {
          wx.showToast({ title: '昵称未改变', icon: 'none' })
          return
        }

        if ((currentUser.username && newName === currentUser.username) || (currentUser.email && newName === currentUser.email) || (currentUser.phone && newName === currentUser.phone)) {
          wx.showToast({ title: '需与用户名/账号区分', icon: 'none' })
          return
        }

        this.setData({ nicknameLoading: true })

        try {
          const { supabase } = require('../../utils/supabase')

          const updateRes = await supabase
            .from('users')
            .update({ name: newName, updated_at: new Date().toISOString() })
            .eq('id', currentUser.id)
            .select()
            .single()

          if (updateRes.error) {
            throw new Error(updateRes.error.message)
          }

          const updated = { ...currentUser, name: updateRes.data.name }
          Auth.saveUserLogin(updated, true)
          this.setData({ userInfo: updated })
          wx.showToast({ title: '修改成功', icon: 'success' })
        } catch (e) {
          wx.showToast({ title: e.message || '修改失败', icon: 'none' })
        } finally {
          this.setData({ nicknameLoading: false })
        }
      }
    })
  },

  /**
   * 头像加载错误处理
   */
  onAvatarError(e) {
    console.warn('头像加载失败:', e)
    
    // 设置默认头像
    const defaultAvatar = AvatarManager.generateDefaultAvatar(
      this.data.userInfo.name || '用户'
    )
    
    this.setData({
      'userInfo.avatar': defaultAvatar,
      'userInfo.avatar_type': 'default'
    })
  },

  /**
   * 格式化日期
   */
  formatDate(dateString) {
    if (!dateString) return ''
    
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) {
        return '今天'
      } else if (diffDays === 1) {
        return '昨天'
      } else if (diffDays < 7) {
        return `${diffDays}天前`
      } else if (diffDays < 30) {
        return `${Math.floor(diffDays / 7)}周前`
      } else if (diffDays < 365) {
        return `${Math.floor(diffDays / 30)}个月前`
      } else {
        return date.toLocaleDateString()
      }
    } catch (error) {
      console.error('日期格式化失败:', error)
      return dateString
    }
  },

  /**
   * 分享功能
   */
  onShareAppMessage() {
    return {
      title: '查看我的个人资料',
      path: '/pages/profile/profile'
    }
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '旅行规划 - 个人资料'
    }
  }
})
