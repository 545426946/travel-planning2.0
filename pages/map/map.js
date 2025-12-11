/**
 * 足迹地图主页 - 圆周旅迹风格
 * 展示用户旅行足迹、统计数据、省份点亮
 */

const Auth = require('../../utils/auth').Auth
const footprintService = require('../../utils/footprint-service')
const mapConfig = require('../../config/map-config')

// 省份颜色
const PROVINCE_COLORS = {
  visited: '#4facfe',
  unvisited: '#e8e8e8'
}

Page({
  data: {
    // 地图数据
    latitude: 35.86166,
    longitude: 104.195397,
    scale: 4,
    markers: [],
    polyline: [],

    // 统计数据
    stats: {
      totalProvinces: 0,
      totalCities: 0,
      totalAttractions: 0,
      totalDistance: 0
    },

    // 足迹数据
    footprints: [],
    visitedProvinces: [],
    
    // 省份列表
    provinces: mapConfig.provinces,

    // UI状态
    loading: true,
    currentTab: 'map', // map | list | stats
    showCheckinBtn: true,
    
    // 用户位置
    userLocation: null
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    // 每次显示页面时刷新数据
    if (!this.data.loading) {
      this.loadData()
    }
  },

  /**
   * 初始化页面
   */
  async initPage() {
    // 获取用户位置
    this.getUserLocation()
    
    // 检查登录 - 未登录也可以查看地图，但不能打卡
    if (!Auth.isLoggedIn()) {
      this.setData({ loading: false })
      return
    }
    
    // 加载数据
    await this.loadData()
  },

  /**
   * 加载所有数据
   */
  async loadData() {
    const userId = Auth.getCurrentUserId()
    if (!userId) {
      // 未登录也显示空地图
      this.setData({ loading: false })
      return
    }

    this.setData({ loading: true })

    try {
      // 并行加载数据
      const [statsResult, footprintsResult, provincesResult] = await Promise.all([
        footprintService.getStats(userId).catch(e => ({ success: false, error: e })),
        footprintService.getFootprints(userId, { limit: 50 }).catch(e => ({ success: false, data: [] })),
        footprintService.getVisitedProvinces(userId).catch(e => ({ success: false, data: [] }))
      ])

      // 更新统计
      if (statsResult.success && statsResult.data) {
        this.setData({
          stats: {
            totalProvinces: statsResult.data.total_provinces || 0,
            totalCities: statsResult.data.total_cities || 0,
            totalAttractions: statsResult.data.total_attractions || 0,
            totalDistance: statsResult.data.total_distance || 0
          }
        })
      }

      // 更新足迹列表
      if (footprintsResult.success) {
        this.setData({ footprints: footprintsResult.data || [] })
        this.updateMapMarkers(footprintsResult.data || [])
      }

      // 更新已访问省份
      if (provincesResult.success) {
        this.setData({ visitedProvinces: provincesResult.data || [] })
      }

    } catch (error) {
      console.error('[Map] 加载数据失败:', error)
      // 不显示错误提示，允许用户继续使用
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 获取用户位置
   */
  getUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        })
      },
      fail: (err) => {
        console.log('[Map] 获取位置失败:', err)
      }
    })
  },

  /**
   * 更新地图标记
   */
  updateMapMarkers(footprints) {
    if (!footprints || footprints.length === 0) {
      this.setData({ markers: [], polyline: [] })
      return
    }

    // 创建标记
    const markers = footprints.slice(0, 100).map((item, index) => ({
      id: index,
      latitude: item.latitude,
      longitude: item.longitude,
      title: item.name,
      iconPath: '/images/marker.png',
      width: 24,
      height: 30,
      callout: {
        content: item.name,
        color: '#333',
        fontSize: 12,
        borderRadius: 6,
        bgColor: '#fff',
        padding: 6,
        display: 'BYCLICK'
      },
      data: item
    }))

    // 创建轨迹线
    const points = footprints.slice(0, 100).map(f => ({
      latitude: f.latitude,
      longitude: f.longitude
    }))

    const polyline = points.length >= 2 ? [{
      points: points,
      color: '#ff6b6b80',
      width: 2,
      dottedLine: true
    }] : []

    this.setData({ markers, polyline })
  },

  /**
   * 切换Tab
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })

    if (tab === 'map') {
      // 切换到地图时，调整视野
      this.fitMapView()
    }
  },

  /**
   * 调整地图视野以显示所有足迹
   */
  fitMapView() {
    const { footprints } = this.data
    
    if (!footprints || footprints.length === 0) {
      // 默认显示中国全景
      this.setData({
        latitude: 35.86166,
        longitude: 104.195397,
        scale: 4
      })
      return
    }

    if (footprints.length === 1) {
      this.setData({
        latitude: footprints[0].latitude,
        longitude: footprints[0].longitude,
        scale: 12
      })
      return
    }

    // 计算边界
    const lats = footprints.map(f => f.latitude)
    const lngs = footprints.map(f => f.longitude)
    
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2
    const maxDiff = Math.max(maxLat - minLat, maxLng - minLng)

    let scale = 10
    if (maxDiff > 20) scale = 3
    else if (maxDiff > 10) scale = 4
    else if (maxDiff > 5) scale = 5
    else if (maxDiff > 2) scale = 7
    else if (maxDiff > 1) scale = 8
    else if (maxDiff > 0.5) scale = 9

    this.setData({
      latitude: centerLat,
      longitude: centerLng,
      scale: scale
    })
  },

  /**
   * 定位到当前位置
   */
  locateMe() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          scale: 14,
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        })
        wx.showToast({ title: '定位成功', icon: 'success' })
      },
      fail: () => {
        wx.showModal({
          title: '定位失败',
          content: '请在设置中开启位置权限',
          showCancel: false
        })
      }
    })
  },

  /**
   * 显示全部足迹
   */
  showAllFootprints() {
    this.fitMapView()
  },

  /**
   * 点击标记
   */
  onMarkerTap(e) {
    const markerId = e.markerId
    const marker = this.data.markers.find(m => m.id === markerId)
    
    if (marker && marker.data) {
      this.showFootprintDetail(marker.data)
    }
  },

  /**
   * 显示足迹详情
   */
  showFootprintDetail(footprint) {
    const time = this.formatTime(footprint.checkin_time)
    
    wx.showActionSheet({
      itemList: ['查看详情', '导航前往', '删除足迹'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.viewFootprintDetail(footprint)
            break
          case 1:
            this.navigateTo(footprint)
            break
          case 2:
            this.deleteFootprint(footprint)
            break
        }
      }
    })
  },

  /**
   * 查看足迹详情
   */
  viewFootprintDetail(footprint) {
    const time = this.formatTime(footprint.checkin_time)
    
    wx.showModal({
      title: footprint.name,
      content: `📍 ${footprint.address || '暂无地址'}\n🕐 ${time}\n📝 ${footprint.note || '暂无备注'}`,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /**
   * 导航前往
   */
  navigateTo(footprint) {
    wx.openLocation({
      latitude: footprint.latitude,
      longitude: footprint.longitude,
      name: footprint.name,
      address: footprint.address || '',
      scale: 16
    })
  },

  /**
   * 删除足迹
   */
  deleteFootprint(footprint) {
    wx.showModal({
      title: '删除足迹',
      content: `确定删除"${footprint.name}"的足迹吗？`,
      success: async (res) => {
        if (res.confirm) {
          const userId = Auth.getCurrentUserId()
          const result = await footprintService.deleteFootprint(userId, footprint.id)
          
          if (result.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadData()
          } else {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  /**
   * 去打卡
   */
  goCheckin() {
    // 检查登录
    if (!Auth.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '请先登录后打卡',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }
    wx.navigateTo({ url: '/pages/checkin/checkin' })
  },

  /**
   * 点击足迹列表项
   */
  onFootprintTap(e) {
    const index = e.currentTarget.dataset.index
    const footprint = this.data.footprints[index]
    
    if (footprint) {
      // 切换到地图并定位
      this.setData({
        currentTab: 'map',
        latitude: footprint.latitude,
        longitude: footprint.longitude,
        scale: 15
      })
    }
  },

  /**
   * 点击省份
   */
  onProvinceTap(e) {
    const province = e.currentTarget.dataset.province
    const isVisited = this.data.visitedProvinces.includes(province.name)
    
    if (isVisited) {
      // 显示该省份的足迹
      const provinceFootprints = this.data.footprints.filter(
        f => f.province && f.province.includes(province.name)
      )
      
      if (provinceFootprints.length > 0) {
        wx.showModal({
          title: province.name,
          content: `已打卡 ${provinceFootprints.length} 个地点`,
          confirmText: '查看',
          success: (res) => {
            if (res.confirm) {
              // 定位到该省份
              this.setData({
                currentTab: 'map',
                latitude: province.center[1],
                longitude: province.center[0],
                scale: 7
              })
            }
          }
        })
      }
    } else {
      wx.showToast({
        title: `${province.name}还未点亮`,
        icon: 'none'
      })
    }
  },

  /**
   * 格式化时间
   */
  formatTime(timeStr) {
    if (!timeStr) return ''
    const date = new Date(timeStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${month}月${day}日 ${hour}:${minute}`
  },

  /**
   * 格式化距离
   */
  formatDistance(km) {
    if (km >= 10000) {
      return (km / 10000).toFixed(1) + '万'
    }
    return km.toLocaleString()
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    const { stats } = this.data
    return {
      title: `我已点亮${stats.totalProvinces}个省份，打卡${stats.totalAttractions}个景点！`,
      path: '/pages/map/map'
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})
