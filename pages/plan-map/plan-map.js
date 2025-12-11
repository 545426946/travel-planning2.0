/**
 * 旅行计划地图页面 - 重写版本
 * 显示行程中的景点位置和游览路线
 */

const Auth = require('../../utils/auth').Auth
const supabase = require('../../utils/supabase').supabase
const attractionsDB = require('../../config/attractions-database')
const mapConfig = require('../../config/map-config')

// 标记颜色
const COLORS = ['#FF5722', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#00BCD4', '#E91E63', '#3F51B5']

Page({
  data: {
    // 地图
    latitude: 39.908823,
    longitude: 116.397470,
    scale: 12,
    markers: [],
    polyline: [],

    // 数据
    planId: null,
    plan: null,
    city: '',
    attractions: [],

    // 状态
    loading: true,
    loadingText: '加载中...',
    loadingProgress: '',

    // UI
    showPanel: false,
    selectedAttraction: null,
    selectedAttractionId: null,
    showAttractionList: true,
    showDebugInfo: false,

    // 统计
    totalDistance: 0,
    totalTimeText: '0分钟',
    
    // 调试信息
    debugInfo: {
      extractedNames: [],
      successCount: 0,
      failedCount: 0,
      rawText: ''
    }
  },

  onLoad(options) {
    console.log('[PlanMap] 页面加载, options:', options)
    
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    
    this.setData({ planId: options.id })
    this.loadPlan()
  },

  /**
   * 加载计划数据
   */
  async loadPlan() {
    const userId = Auth.getCurrentUserId()
    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 1500)
      return
    }

    try {
      this.setData({ loading: true, loadingText: '加载行程数据...' })

      const { data, error } = await supabase
        .from('travel_plans')
        .select('*')
        .eq('id', this.data.planId)
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('[PlanMap] 数据库错误:', error)
        throw error
      }
      
      if (!data) {
        wx.showToast({ title: '行程不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      console.log('[PlanMap] 加载到行程:', data.title)
      console.log('[PlanMap] 目的地:', data.destination)
      console.log('[PlanMap] 行程内容长度:', data.itinerary?.length || 0)

      // 分析城市
      const city = this.analyzeCity(data)
      console.log('[PlanMap] 分析出城市:', city)
      
      this.setData({ plan: data, city })

      // 定位到城市中心
      const cityCoords = this.getCityCoords(city)
      this.setData({
        latitude: cityCoords.latitude,
        longitude: cityCoords.longitude,
        scale: cityCoords.scale || 12
      })

      // 解析并定位景点
      await this.parseAndLocateAttractions(data)

    } catch (error) {
      console.error('[PlanMap] 加载失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败: ' + (error.message || '未知错误'), icon: 'none' })
    }
  },

  /**
   * 分析城市
   */
  analyzeCity(plan) {
    const { destination = '', title = '', itinerary = '' } = plan
    
    const cities = [
      '北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '西安', '武汉', '重庆',
      '天津', '苏州', '青岛', '大连', '厦门', '三亚', '昆明', '长沙', '郑州', '济南',
      '哈尔滨', '沈阳', '南宁', '桂林', '丽江', '大理', '黄山', '张家界', '九寨沟',
      '拉萨', '敦煌', '西宁', '兰州', '乌鲁木齐', '无锡', '宁波', '珠海', '海口', '贵阳'
    ]

    // 优先从destination获取
    for (const city of cities) {
      if (destination.includes(city)) return city
    }

    // 从标题获取
    for (const city of cities) {
      if (title.includes(city)) return city
    }

    // 从行程内容获取
    const textToSearch = `${destination} ${title} ${itinerary.substring(0, 500)}`
    for (const city of cities) {
      if (textToSearch.includes(city)) return city
    }

    return destination || '北京'
  },

  /**
   * 获取城市坐标
   */
  getCityCoords(city) {
    const coords = mapConfig.cityCoordinates || {}
    if (!city) return { latitude: 39.904989, longitude: 116.405285, scale: 12 }
    if (coords[city]) return coords[city]
    
    for (const [name, data] of Object.entries(coords)) {
      if (city.includes(name) || name.includes(city)) return data
    }
    return { latitude: 39.904989, longitude: 116.405285, scale: 12 }
  },

  /**
   * 解析并定位景点 - 核心方法
   */
  async parseAndLocateAttractions(plan) {
    const itinerary = plan.itinerary || plan.description || ''
    
    // 保存原始文本用于调试
    this.setData({ 
      'debugInfo.rawText': itinerary.substring(0, 800)
    })
    
    if (!itinerary.trim()) {
      this.finishLoading([])
      wx.showToast({ title: '行程内容为空', icon: 'none' })
      return
    }

    this.setData({ loadingText: '解析景点名称...' })
    console.log('[PlanMap] 开始解析行程文本, 长度:', itinerary.length)

    // 第一步：提取景点名称
    const extractedNames = this.extractAttractionNames(itinerary, this.data.city)
    
    this.setData({ 
      'debugInfo.extractedNames': extractedNames,
      loadingProgress: `提取到 ${extractedNames.length} 个景点`
    })
    
    console.log('[PlanMap] 提取到景点名称:', extractedNames)

    if (extractedNames.length === 0) {
      this.finishLoading([])
      wx.showToast({ title: '未识别到景点', icon: 'none' })
      return
    }

    // 第二步：定位景点
    this.setData({ loadingText: '定位景点坐标...' })
    
    const attractions = []
    let successCount = 0
    let failedCount = 0

    for (let i = 0; i < extractedNames.length; i++) {
      const name = extractedNames[i]
      this.setData({ loadingProgress: `${i + 1}/${extractedNames.length}: ${name}` })
      
      // 尝试定位
      const location = await this.locateAttraction(name, this.data.city)
      
      if (location) {
        attractions.push({
          id: attractions.length + 1,
          ...location
        })
        successCount++
        console.log(`[PlanMap] ✓ 定位成功: ${name} -> (${location.latitude}, ${location.longitude})`)
      } else {
        failedCount++
        console.log(`[PlanMap] ✗ 定位失败: ${name}`)
      }
      
      // API调用间隔
      if (i < extractedNames.length - 1) {
        await this.delay(150)
      }
    }

    // 更新调试信息
    this.setData({
      'debugInfo.successCount': successCount,
      'debugInfo.failedCount': failedCount
    })

    console.log(`[PlanMap] 定位完成: 成功 ${successCount}, 失败 ${failedCount}`)

    // 完成加载
    this.finishLoading(attractions)

    if (attractions.length > 0) {
      wx.showToast({
        title: `定位 ${attractions.length} 个景点`,
        icon: 'success'
      })
    } else {
      wx.showToast({ title: '景点定位失败', icon: 'none' })
    }
  },

  /**
   * 提取景点名称 - 多策略提取
   */
  extractAttractionNames(text, city) {
    const foundNames = new Set()
    
    // 策略1: 直接匹配本地数据库中的景点名称（最可靠）
    const dbNames = Object.keys(attractionsDB)
    // 按长度降序排列，优先匹配长名称
    dbNames.sort((a, b) => b.length - a.length)
    
    for (const name of dbNames) {
      if (text.includes(name)) {
        foundNames.add(name)
        console.log(`[Extract] 数据库匹配: ${name}`)
      }
    }
    
    // 策略2: 使用正则提取带有景点后缀的名称
    const suffixPatterns = [
      /[\u4e00-\u9fa5]{2,8}(景区|风景区|公园|博物馆|纪念馆|古城|古镇|老街)/g,
      /[\u4e00-\u9fa5]{2,6}(寺|庙|宫|殿|塔|山|湖|海|岛|洞|峡|谷)/g,
      /[\u4e00-\u9fa5]{2,6}(广场|大街|步行街|故居|遗址)/g
    ]
    
    for (const pattern of suffixPatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const name = match[0]
        if (this.isValidAttractionName(name)) {
          // 检查是否在数据库中或其变体在数据库中
          const dbMatch = this.findInDatabase(name)
          if (dbMatch) {
            foundNames.add(dbMatch)
            console.log(`[Extract] 后缀匹配: ${name} -> ${dbMatch}`)
          }
        }
      }
    }
    
    // 策略3: 提取动作词后的景点名称
    const actionPatterns = [
      /(?:参观|游览|前往|到达|打卡|游玩|逛|去|抵达|来到|探访|体验|欣赏|登上|漫步)[：:\s]*([^\n,，。！!？?]{2,15})/g
    ]
    
    for (const pattern of actionPatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim()
        if (this.isValidAttractionName(name)) {
          const dbMatch = this.findInDatabase(name)
          if (dbMatch) {
            foundNames.add(dbMatch)
            console.log(`[Extract] 动作词匹配: ${name} -> ${dbMatch}`)
          }
        }
      }
    }
    
    // 策略4: 提取引号内的内容
    const quotePattern = /["「『【"']([^"」』】"']{2,12})["」』】"']/g
    let match
    while ((match = quotePattern.exec(text)) !== null) {
      const name = match[1].trim()
      if (this.isValidAttractionName(name)) {
        const dbMatch = this.findInDatabase(name)
        if (dbMatch) {
          foundNames.add(dbMatch)
          console.log(`[Extract] 引号匹配: ${name} -> ${dbMatch}`)
        }
      }
    }

    // 去重并限制数量
    const result = Array.from(foundNames).slice(0, 15)
    return result
  },

  /**
   * 在数据库中查找景点（支持模糊匹配）
   */
  findInDatabase(name) {
    if (!name || name.length < 2) return null
    
    // 精确匹配
    if (attractionsDB[name]) return name
    
    // 模糊匹配 - 数据库名称包含输入
    for (const dbName of Object.keys(attractionsDB)) {
      if (dbName.includes(name) && name.length >= 2) {
        return dbName
      }
    }
    
    // 模糊匹配 - 输入包含数据库名称
    for (const dbName of Object.keys(attractionsDB)) {
      if (name.includes(dbName) && dbName.length >= 2) {
        return dbName
      }
    }
    
    // 去除后缀再匹配
    const simpleName = name.replace(/景区|风景区|公园|博物馆|纪念馆|旅游区|度假区/g, '').trim()
    if (simpleName && simpleName !== name && attractionsDB[simpleName]) {
      return simpleName
    }
    
    return null
  },

  /**
   * 验证景点名称是否有效
   */
  isValidAttractionName(name) {
    if (!name || name.length < 2 || name.length > 20) return false
    
    // 排除无效词汇
    const invalidWords = [
      '上午', '下午', '晚上', '早上', '中午', '傍晚',
      '早餐', '午餐', '晚餐', '宵夜', '美食', '小吃',
      '住宿', '酒店', '民宿', '宾馆', '客栈', '旅馆',
      '餐厅', '饭店', '餐馆', '饭馆', '食堂',
      '交通', '费用', '总计', '人均', '预估', '消费', '门票', '预算',
      '打车', '公交', '地铁', '步行', '骑行', '出租车', '高铁', '飞机', '火车',
      '分钟', '小时', '天', '日', '元', '块', '人',
      '感受', '享受', '品尝', '休息', '调整', '自由活动',
      '建议', '注意', '事项', '推荐', '提示', '温馨', '备注',
      '返回', '出发', '抵达', '到达', '离开', '结束', '开始',
      '行程', '规划', '安排', '计划', '攻略', '路线',
      '购物', '商场', '超市', '便利店', '特产', '纪念品',
      '机场', '车站', '码头', '港口', '当地', '特色', '网红', '附近', '周边'
    ]

    for (const word of invalidWords) {
      if (name === word || name.includes(word)) {
        return false
      }
    }

    // 必须包含中文
    if (!/[\u4e00-\u9fa5]/.test(name)) {
      return false
    }

    return true
  },

  /**
   * 定位单个景点
   */
  async locateAttraction(name, city) {
    // 优先使用本地数据库
    const localResult = this.findInLocalDB(name)
    if (localResult) {
      console.log(`[Locate] 本地数据库命中: ${name}`)
      return localResult
    }

    // 使用高德API搜索
    try {
      const apiResult = await this.searchByAmapAPI(name, city)
      if (apiResult) {
        console.log(`[Locate] 高德API命中: ${name}`)
        return apiResult
      }
    } catch (e) {
      console.warn(`[Locate] API搜索异常: ${name}`, e)
    }

    // 使用地理编码作为备选
    try {
      const geoResult = await this.geocodeByAmap(name, city)
      if (geoResult) {
        console.log(`[Locate] 地理编码命中: ${name}`)
        return geoResult
      }
    } catch (e) {
      console.warn(`[Locate] 地理编码异常: ${name}`, e)
    }

    return null
  },

  /**
   * 从本地数据库查找
   */
  findInLocalDB(name) {
    if (!name) return null
    
    // 精确匹配
    if (attractionsDB[name]) {
      const data = attractionsDB[name]
      return {
        name: name,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address || '',
        source: 'local_db'
      }
    }
    
    // 模糊匹配
    for (const [dbName, data] of Object.entries(attractionsDB)) {
      if (dbName.includes(name) || name.includes(dbName)) {
        return {
          name: dbName,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address || '',
          source: 'local_db'
        }
      }
    }
    
    return null
  },

  /**
   * 高德POI搜索
   */
  searchByAmapAPI(keyword, city) {
    const amapKey = mapConfig.amap.key
    
    return new Promise((resolve) => {
      wx.request({
        url: 'https://restapi.amap.com/v3/place/text',
        data: {
          key: amapKey,
          keywords: keyword,
          city: city || '',
          citylimit: city ? 'true' : 'false',
          types: '110000|110100|110200|140000|150000|160000|170000|180000|190000',
          offset: 10,
          output: 'json'
        },
        timeout: 8000,
        success: (res) => {
          if (res.data?.status === '1' && res.data?.pois?.length > 0) {
            // 找最匹配的结果
            let poi = res.data.pois.find(p => p.name === keyword)
            if (!poi) poi = res.data.pois.find(p => p.name.includes(keyword) || keyword.includes(p.name))
            if (!poi) poi = res.data.pois[0]
            
            if (poi && poi.location) {
              const parts = poi.location.split(',')
              if (parts.length === 2) {
                const lng = parseFloat(parts[0])
                const lat = parseFloat(parts[1])
                if (!isNaN(lat) && !isNaN(lng) && lat > 0 && lng > 0) {
                  resolve({
                    name: poi.name,
                    latitude: lat,
                    longitude: lng,
                    address: poi.address || '',
                    source: 'amap_poi'
                  })
                  return
                }
              }
            }
          }
          resolve(null)
        },
        fail: (err) => {
          console.warn(`[API] 请求失败 ${keyword}:`, err)
          resolve(null)
        }
      })
    })
  },

  /**
   * 高德地理编码
   */
  geocodeByAmap(address, city) {
    const amapKey = mapConfig.amap.key
    const searchAddress = city ? `${city}${address}` : address
    
    return new Promise((resolve) => {
      wx.request({
        url: 'https://restapi.amap.com/v3/geocode/geo',
        data: {
          key: amapKey,
          address: searchAddress,
          city: city || '',
          output: 'json'
        },
        timeout: 6000,
        success: (res) => {
          if (res.data?.status === '1' && res.data?.geocodes?.length > 0) {
            const geo = res.data.geocodes[0]
            if (geo.location) {
              const parts = geo.location.split(',')
              if (parts.length === 2) {
                const lng = parseFloat(parts[0])
                const lat = parseFloat(parts[1])
                if (!isNaN(lat) && !isNaN(lng) && lat > 0 && lng > 0) {
                  resolve({
                    name: address,
                    latitude: lat,
                    longitude: lng,
                    address: geo.formatted_address || '',
                    source: 'amap_geo'
                  })
                  return
                }
              }
            }
          }
          resolve(null)
        },
        fail: () => resolve(null)
      })
    })
  },

  /**
   * 完成加载，更新地图显示
   */
  finishLoading(attractions) {
    // 计算每个景点到下一个的距离
    const withDistance = attractions.map((a, i) => {
      if (i < attractions.length - 1) {
        const next = attractions[i + 1]
        const dist = this.calculateDistance(
          a.latitude, a.longitude,
          next.latitude, next.longitude
        )
        return { ...a, distanceToNext: Math.round(dist * 10) / 10 }
      }
      return { ...a, distanceToNext: null }
    })
    
    // 计算总距离和时间
    const totalDistance = this.calculateTotalDistance(withDistance)
    const totalTimeText = this.formatTime(Math.round(totalDistance / 30 * 60))
    
    this.setData({
      attractions: withDistance,
      totalDistance,
      totalTimeText,
      loading: false,
      loadingText: '',
      loadingProgress: ''
    })

    // 更新地图
    if (withDistance.length > 0) {
      this.createMarkers(withDistance)
      this.createPolyline(withDistance)
      this.fitMapView(withDistance)
    }
  },


  /**
   * 创建地图标记
   */
  createMarkers(attractions) {
    const validAttractions = attractions.filter(item => {
      const lat = parseFloat(item.latitude)
      const lng = parseFloat(item.longitude)
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
    })
    
    console.log(`[PlanMap] 创建标记: ${validAttractions.length}个`)
    
    const markers = validAttractions.map((item, index) => {
      const color = COLORS[index % COLORS.length]
      return {
        id: item.id,
        latitude: parseFloat(item.latitude),
        longitude: parseFloat(item.longitude),
        title: item.name,
        iconPath: '/images/marker.png',
        width: 32,
        height: 40,
        // 气泡框 - 点击显示
        callout: {
          content: item.name,
          color: '#333',
          fontSize: 13,
          fontWeight: 'bold',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: color,
          bgColor: '#fff',
          padding: 10,
          display: 'BYCLICK',
          textAlign: 'center',
          anchorY: -5
        },
        // 序号标签 - 始终显示
        label: {
          content: ` ${index + 1} `,
          color: '#fff',
          fontSize: 11,
          fontWeight: 'bold',
          anchorX: -2,
          anchorY: -42,
          borderRadius: 12,
          bgColor: color,
          padding: 5
        },
        // 自定义数据
        customData: {
          name: item.name,
          address: item.address,
          index: index
        }
      }
    })

    this.setData({ markers })
  },

  /**
   * 创建路线
   */
  createPolyline(attractions) {
    const validPoints = attractions
      .filter(a => {
        const lat = parseFloat(a.latitude)
        const lng = parseFloat(a.longitude)
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
      })
      .map(a => ({
        latitude: parseFloat(a.latitude),
        longitude: parseFloat(a.longitude)
      }))

    if (validPoints.length < 2) {
      this.setData({ polyline: [] })
      return
    }

    console.log(`[PlanMap] 创建路线: ${validPoints.length}个点`)

    // 创建渐变色路线效果
    this.setData({
      polyline: [{
        points: validPoints,
        color: '#4facfeCC',  // 带透明度的蓝色
        width: 6,
        arrowLine: true,
        arrowIconPath: '/images/route-icon.png',
        borderColor: '#ffffff',
        borderWidth: 2,
        dottedLine: false
      }]
    })
  },

  /**
   * 调整地图视野
   */
  fitMapView(attractions) {
    const valid = attractions.filter(a => {
      const lat = parseFloat(a.latitude)
      const lng = parseFloat(a.longitude)
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
    })
    
    if (valid.length === 0) {
      const cityCoords = this.getCityCoords(this.data.city)
      this.setData({
        latitude: cityCoords.latitude,
        longitude: cityCoords.longitude,
        scale: cityCoords.scale || 12
      })
      return
    }
    
    if (valid.length === 1) {
      this.setData({
        latitude: parseFloat(valid[0].latitude),
        longitude: parseFloat(valid[0].longitude),
        scale: 15
      })
      return
    }

    const lats = valid.map(a => parseFloat(a.latitude))
    const lngs = valid.map(a => parseFloat(a.longitude))
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2
    const maxDiff = Math.max(maxLat - minLat, maxLng - minLng)

    let scale = 15
    if (maxDiff > 0.5) scale = 8
    else if (maxDiff > 0.2) scale = 10
    else if (maxDiff > 0.1) scale = 11
    else if (maxDiff > 0.05) scale = 12
    else if (maxDiff > 0.02) scale = 13
    else if (maxDiff > 0.01) scale = 14

    console.log(`[PlanMap] 调整视野: center=(${centerLat}, ${centerLng}), scale=${scale}`)
    
    this.setData({
      latitude: centerLat,
      longitude: centerLng,
      scale: scale
    })
  },

  // ========== 工具方法 ==========

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = this.toRad(lat2 - lat1)
    const dLng = this.toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  },

  calculateTotalDistance(attractions) {
    if (!attractions || attractions.length < 2) return 0
    let total = 0
    for (let i = 0; i < attractions.length - 1; i++) {
      total += this.calculateDistance(
        attractions[i].latitude, attractions[i].longitude,
        attractions[i + 1].latitude, attractions[i + 1].longitude
      )
    }
    return Math.round(total * 10) / 10
  },

  formatTime(minutes) {
    if (minutes < 60) return `${minutes}分钟`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
  },

  toRad(deg) { return deg * Math.PI / 180 },
  
  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)) },

  // ========== 用户交互 ==========

  onMarkerTap(e) {
    const id = e.detail?.markerId || e.markerId
    const attraction = this.data.attractions.find(a => a.id === id)
    
    if (attraction) {
      this.setData({
        selectedAttraction: attraction,
        showPanel: true
      })
    }
  },

  closePanel() {
    this.setData({ showPanel: false, selectedAttraction: null })
  },

  navigateTo() {
    const { selectedAttraction } = this.data
    if (!selectedAttraction) return

    wx.openLocation({
      latitude: selectedAttraction.latitude,
      longitude: selectedAttraction.longitude,
      name: selectedAttraction.name,
      address: selectedAttraction.address || '',
      scale: 18
    })
  },

  // ========== 功能按钮 ==========

  goBack() {
    wx.navigateBack()
  },

  locateMe() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          scale: 16
        })
        wx.showToast({ title: '定位成功', icon: 'success' })
      },
      fail: () => {
        wx.showModal({
          title: '定位失败',
          content: '请检查位置权限',
          showCancel: false
        })
      }
    })
  },

  showAllRoute() {
    if (this.data.attractions.length === 0) {
      wx.showToast({ title: '暂无景点', icon: 'none' })
      return
    }
    this.fitMapView(this.data.attractions)
  },

  optimizeRoute() {
    const { attractions } = this.data
    if (attractions.length < 3) {
      wx.showToast({ title: '景点数量不足', icon: 'none' })
      return
    }

    wx.showLoading({ title: '优化中...' })

    // 最近邻算法优化路线
    const remaining = [...attractions]
    const optimized = [remaining.shift()]

    while (remaining.length > 0) {
      const current = optimized[optimized.length - 1]
      let nearestIdx = 0
      let nearestDist = Infinity

      remaining.forEach((item, idx) => {
        const dist = this.calculateDistance(
          current.latitude, current.longitude,
          item.latitude, item.longitude
        )
        if (dist < nearestDist) {
          nearestDist = dist
          nearestIdx = idx
        }
      })
      optimized.push(remaining.splice(nearestIdx, 1)[0])
    }

    const reordered = optimized.map((item, idx) => ({ ...item, id: idx + 1 }))
    
    // 重新计算距离
    const withDistance = reordered.map((a, i) => {
      if (i < reordered.length - 1) {
        const next = reordered[i + 1]
        const dist = this.calculateDistance(
          a.latitude, a.longitude,
          next.latitude, next.longitude
        )
        return { ...a, distanceToNext: Math.round(dist * 10) / 10 }
      }
      return { ...a, distanceToNext: null }
    })

    const totalDistance = this.calculateTotalDistance(withDistance)
    const totalTimeText = this.formatTime(Math.round(totalDistance / 30 * 60))

    this.setData({ 
      attractions: withDistance,
      totalDistance,
      totalTimeText
    })
    
    this.createMarkers(withDistance)
    this.createPolyline(withDistance)

    wx.hideLoading()
    wx.showToast({ title: '路线已优化', icon: 'success' })
  },

  exportRoute() {
    const { plan, attractions, totalDistance } = this.data
    if (attractions.length === 0) {
      wx.showToast({ title: '暂无路线', icon: 'none' })
      return
    }

    let text = `【${plan.title}】路线导出\n\n`
    text += `📍 目的地：${plan.destination}\n`
    text += `🗺️ 景点：${attractions.length}个\n`
    text += `📏 总距离：约${totalDistance}公里\n\n`
    text += `🚶 路线顺序：\n`

    attractions.forEach((a, i) => {
      text += `${i + 1}. ${a.name}\n`
      if (a.address) text += `   📍 ${a.address}\n`
      if (a.distanceToNext) text += `   ↓ ${a.distanceToNext}km\n`
    })

    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    })
  },

  toggleList() {
    this.setData({ showAttractionList: !this.data.showAttractionList })
  },

  focusAttraction(e) {
    const id = e.currentTarget.dataset.id
    const attraction = this.data.attractions.find(a => a.id === id)
    
    if (attraction) {
      this.setData({
        latitude: attraction.latitude,
        longitude: attraction.longitude,
        scale: 16,
        selectedAttractionId: id
      })
    }
  },

  /**
   * 快速导航到景点
   */
  quickNavigate(e) {
    const id = e.currentTarget.dataset.id
    const attraction = this.data.attractions.find(a => a.id === id)
    
    if (attraction) {
      wx.openLocation({
        latitude: attraction.latitude,
        longitude: attraction.longitude,
        name: attraction.name,
        address: attraction.address || '',
        scale: 18
      })
    }
  },

  // ========== 景点管理 ==========

  moveUp(e) {
    const id = e.currentTarget.dataset.id
    const index = this.data.attractions.findIndex(a => a.id === id)
    
    if (index <= 0) return
    
    const attractions = [...this.data.attractions]
    const temp = attractions[index]
    attractions[index] = attractions[index - 1]
    attractions[index - 1] = temp
    
    this.updateAttractions(attractions)
  },

  moveDown(e) {
    const id = e.currentTarget.dataset.id
    const index = this.data.attractions.findIndex(a => a.id === id)
    
    if (index < 0 || index >= this.data.attractions.length - 1) return
    
    const attractions = [...this.data.attractions]
    const temp = attractions[index]
    attractions[index] = attractions[index + 1]
    attractions[index + 1] = temp
    
    this.updateAttractions(attractions)
  },

  removeAttraction(e) {
    const id = e.currentTarget.dataset.id

    wx.showModal({
      title: '删除景点',
      content: '确定删除？',
      success: (res) => {
        if (res.confirm) {
          let attractions = this.data.attractions.filter(a => a.id !== id)
          this.updateAttractions(attractions)
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  updateAttractions(attractions) {
    const reordered = attractions.map((a, i) => ({ ...a, id: i + 1 }))
    
    // 重新计算距离
    const withDistance = reordered.map((a, i) => {
      if (i < reordered.length - 1) {
        const next = reordered[i + 1]
        const dist = this.calculateDistance(
          a.latitude, a.longitude,
          next.latitude, next.longitude
        )
        return { ...a, distanceToNext: Math.round(dist * 10) / 10 }
      }
      return { ...a, distanceToNext: null }
    })

    const totalDistance = this.calculateTotalDistance(withDistance)
    const totalTimeText = this.formatTime(Math.round(totalDistance / 30 * 60))

    this.setData({ 
      attractions: withDistance,
      totalDistance,
      totalTimeText
    })

    if (withDistance.length > 0) {
      this.createMarkers(withDistance)
      this.createPolyline(withDistance)
    } else {
      this.setData({ markers: [], polyline: [] })
    }
  },

  // ========== 手动添加景点 ==========

  addManually() {
    wx.showModal({
      title: '添加景点',
      editable: true,
      placeholderText: '输入景点名称，如：故宫、西湖',
      success: async (res) => {
        if (!res.confirm || !res.content?.trim()) return

        const name = res.content.trim()
        wx.showLoading({ title: '定位中...' })

        try {
          const location = await this.locateAttraction(name, this.data.city)

          if (location) {
            const newAttraction = {
              id: this.data.attractions.length + 1,
              ...location,
              source: 'manual'
            }

            const updated = [...this.data.attractions, newAttraction]
            this.updateAttractions(updated)

            wx.hideLoading()
            wx.showToast({ title: '添加成功', icon: 'success' })
          } else {
            wx.hideLoading()
            wx.showModal({
              title: '未找到景点',
              content: `无法定位"${name}"，请尝试更准确的景点名称。`,
              showCancel: false
            })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '添加失败', icon: 'none' })
        }
      }
    })
  },

  // ========== 重新解析 ==========

  reparse() {
    if (!this.data.plan) return

    wx.showModal({
      title: '重新解析',
      content: '将重新分析行程并定位景点',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            attractions: [],
            markers: [],
            polyline: [],
            loading: true
          })
          this.parseAndLocateAttractions(this.data.plan)
        }
      }
    })
  },

  // ========== 调试功能 ==========

  toggleDebug() {
    this.setData({ showDebugInfo: !this.data.showDebugInfo })
  },

  // ========== 打卡功能 ==========

  checkinAttraction() {
    const { selectedAttraction, planId } = this.data
    if (!selectedAttraction) return

    const params = encodeURIComponent(JSON.stringify({
      name: selectedAttraction.name,
      latitude: selectedAttraction.latitude,
      longitude: selectedAttraction.longitude,
      address: selectedAttraction.address || '',
      planId: planId
    }))
    
    wx.navigateTo({
      url: `/pages/checkin/checkin?attraction=${params}`
    })
  },

  goToFootprint() {
    wx.navigateTo({
      url: '/pages/map/map'
    })
  },

  // ========== 生命周期 ==========

  onShow() {
    console.log('[PlanMap] onShow')
  },

  onPullDownRefresh() {
    wx.stopPullDownRefresh()
  },

  onShareAppMessage() {
    const { plan, attractions } = this.data
    return {
      title: `${plan?.title || '旅行路线'} - ${attractions.length}个景点`,
      path: `/pages/plan-map/plan-map?id=${this.data.planId}`
    }
  }
})
