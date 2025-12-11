/**
 * 打卡页面 - 记录旅行足迹
 */

const Auth = require('../../utils/auth').Auth
const footprintService = require('../../utils/footprint-service')

Page({
  data: {
    // 位置信息
    latitude: null,
    longitude: null,
    address: '',
    province: '',
    city: '',
    district: '',
    
    // 打卡信息
    name: '',
    note: '',
    photos: [],
    
    // 附近景点
    nearbyPois: [],
    selectedPoi: null,
    
    // 状态
    loading: true,
    locating: true,
    submitting: false,
    showPoiPicker: false
  },

  onLoad(options) {
    // 检查是否从行程地图传入景点信息
    if (options.attraction) {
      try {
        const attraction = JSON.parse(decodeURIComponent(options.attraction))
        this.setData({
          name: attraction.name || '',
          latitude: attraction.latitude,
          longitude: attraction.longitude,
          address: attraction.address || '',
          planId: attraction.planId || null,
          selectedPoi: {
            name: attraction.name,
            latitude: attraction.latitude,
            longitude: attraction.longitude,
            address: attraction.address,
            distance: 0
          }
        })
        // 获取地址详情
        this.reverseGeocode(attraction.latitude, attraction.longitude)
        this.setData({ loading: false, locating: false })
        return
      } catch (e) {
        console.error('[Checkin] 解析景点参数失败:', e)
      }
    }
    
    this.initPage()
  },

  /**
   * 初始化页面
   */
  async initPage() {
    // 检查登录
    if (!Auth.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '请先登录后打卡',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          } else {
            wx.navigateBack()
          }
        }
      })
      return
    }

    // 获取位置
    await this.getLocation()
  },

  /**
   * 获取当前位置
   */
  async getLocation() {
    this.setData({ locating: true })

    wx.getLocation({
      type: 'gcj02',
      success: async (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude
        })

        // 逆地理编码获取地址
        await this.reverseGeocode(res.latitude, res.longitude)
        
        // 搜索附近景点
        await this.searchNearby(res.latitude, res.longitude)
      },
      fail: (err) => {
        console.error('[Checkin] 获取位置失败:', err)
        this.setData({ locating: false, loading: false })
        
        wx.showModal({
          title: '定位失败',
          content: '无法获取您的位置，请检查位置权限设置',
          confirmText: '去设置',
          cancelText: '手动输入',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting()
            }
          }
        })
      }
    })
  },

  /**
   * 逆地理编码
   */
  async reverseGeocode(latitude, longitude) {
    const result = await footprintService.reverseGeocode(latitude, longitude)
    
    if (result.success) {
      this.setData({
        address: result.data.address,
        province: result.data.province,
        city: result.data.city,
        district: result.data.district,
        name: result.data.neighborhood || result.data.township || ''
      })
    }
    
    this.setData({ locating: false, loading: false })
  },

  /**
   * 搜索附近景点
   */
  async searchNearby(latitude, longitude) {
    const result = await footprintService.searchNearby(latitude, longitude, '景点|公园|博物馆', 3000)
    
    if (result.success && result.data.length > 0) {
      this.setData({ nearbyPois: result.data })
    }
  },

  /**
   * 重新定位
   */
  relocate() {
    this.getLocation()
  },

  /**
   * 输入打卡名称
   */
  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  /**
   * 输入备注
   */
  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  /**
   * 选择照片
   */
  choosePhoto() {
    const remaining = 9 - this.data.photos.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多9张照片', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newPhotos = res.tempFiles.map(f => f.tempFilePath)
        this.setData({
          photos: [...this.data.photos, ...newPhotos]
        })
      }
    })
  },

  /**
   * 删除照片
   */
  removePhoto(e) {
    const index = e.currentTarget.dataset.index
    const photos = [...this.data.photos]
    photos.splice(index, 1)
    this.setData({ photos })
  },

  /**
   * 预览照片
   */
  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: this.data.photos
    })
  },

  /**
   * 显示附近景点选择器
   */
  showPoiPicker() {
    if (this.data.nearbyPois.length === 0) {
      wx.showToast({ title: '附近没有找到景点', icon: 'none' })
      return
    }
    this.setData({ showPoiPicker: true })
  },

  /**
   * 隐藏景点选择器
   */
  hidePoiPicker() {
    this.setData({ showPoiPicker: false })
  },

  /**
   * 选择景点
   */
  selectPoi(e) {
    const index = e.currentTarget.dataset.index
    const poi = this.data.nearbyPois[index]
    
    this.setData({
      selectedPoi: poi,
      name: poi.name,
      latitude: poi.latitude,
      longitude: poi.longitude,
      address: poi.address || this.data.address,
      showPoiPicker: false
    })
  },

  /**
   * 清除选择的景点
   */
  clearSelectedPoi() {
    this.setData({
      selectedPoi: null,
      name: ''
    })
  },

  /**
   * 提交打卡
   */
  async submit() {
    // 验证
    if (!this.data.latitude || !this.data.longitude) {
      wx.showToast({ title: '请先获取位置', icon: 'none' })
      return
    }

    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入打卡地点名称', icon: 'none' })
      return
    }

    // 检查登录
    if (!Auth.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '请先登录后打卡',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }

    this.setData({ submitting: true })

    try {
      const userId = Auth.getCurrentUserId()
      
      // 准备数据
      const footprintData = {
        type: this.data.selectedPoi ? 'attraction' : 'custom',
        name: this.data.name.trim(),
        province: this.data.province,
        city: this.data.city,
        district: this.data.district,
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        address: this.data.address,
        photos: this.data.photos,
        note: this.data.note.trim(),
        checkinTime: new Date().toISOString()
      }

      // 提交
      const result = await footprintService.addFootprint(userId, footprintData)

      this.setData({ submitting: false })

      if (result.success) {
        wx.showToast({
          title: '打卡成功！',
          icon: 'success',
          duration: 1500
        })

        // 返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        // 如果是数据库表不存在的错误，给出提示
        const errorMsg = result.error || ''
        if (errorMsg.includes('does not exist') || errorMsg.includes('relation')) {
          wx.showModal({
            title: '功能未启用',
            content: '足迹功能需要先配置数据库，请联系管理员',
            showCancel: false
          })
        } else {
          wx.showModal({
            title: '打卡失败',
            content: result.error || '请稍后重试',
            showCancel: false
          })
        }
      }
    } catch (error) {
      console.error('[Checkin] 提交失败:', error)
      this.setData({ submitting: false })
      wx.showToast({ title: '打卡失败', icon: 'none' })
    }
  },

  /**
   * 返回
   */
  goBack() {
    wx.navigateBack()
  }
})
