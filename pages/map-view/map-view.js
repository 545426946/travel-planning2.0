// pages/map-view/map-view.js - 地图页面
const TencentMapManager = require('../../utils/tencent-map').TencentMapManager

Page({
  data: {
    // 地图相关数据
    longitude: 116.397428, // 默认经度（天安门）
    latitude: 39.90923,    // 默认纬度（天安门）
    scale: 12,
    markers: [],
    polyline: [],
    includePoints: null,
    
    // 路线相关数据
    routeInfo: null,
    startPoint: null,
    endPoint: null,
    
    // 天气数据
    weatherInfo: null,
    
    // 加载状态
    loading: false,
    showRoute: false
  },

  onLoad(options) {
    console.log('地图页面加载，参数：', options)
    
    // 获取腾讯地图API密钥
    this.initMapConfig()
    
    // 如果有行程ID，加载行程路线
    if (options.planId) {
      this.loadTravelPlanRoute(options.planId)
    } else if (options.destination) {
      // 如果有目的地，显示目的地地图
      this.showDestinationMap(options.destination)
    }
  },

  onShow() {
    // 获取当前位置
    this.getCurrentLocation()
  },

  /**
   * 初始化地图配置
   */
  initMapConfig() {
    // 从配置文件获取腾讯地图密钥
    const { APP_CONFIG } = require('../../utils/config')
    const mapKey = APP_CONFIG.TENCENT_MAP_KEY || 'YOUR_TENCENT_MAP_KEY'
    
    if (mapKey === 'YOUR_TENCENT_MAP_KEY') {
      wx.showModal({
        title: '配置提示',
        content: '请先配置腾讯地图API密钥',
        showCancel: false
      })
      return
    }
    
    TencentMapManager.initConfig(mapKey)
    console.log('腾讯地图配置初始化完成')
  },

  /**
   * 获取当前位置
   */
  getCurrentLocation() {
    wx.getLocation({
      type: 'gcj02', // 使用国测局坐标系
      success: (res) => {
        console.log('当前位置：', res)
        this.setData({
          longitude: res.longitude,
          latitude: res.latitude
        })
        
        // 获取当前位置的天气信息
        this.getCurrentWeather(res.latitude, res.longitude)
      },
      fail: (error) => {
        console.error('获取位置失败：', error)
        wx.showToast({
          title: '无法获取当前位置',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 加载旅行计划路线
   */
  async loadTravelPlanRoute(planId) {
    wx.showLoading({ title: '加载行程路线...' })
    
    try {
      // 从数据库获取真实行程数据
      const Auth = require('../../utils/auth').Auth
      const supabase = require('../../utils/supabase').supabase
      
      const userId = Auth.getCurrentUserId()
      if (!userId) {
        throw new Error('用户未登录')
      }

      // 从数据库获取行程
      const { data: results, error } = await supabase
        .from('travel_plans')
        .select('*')
        .eq('id', planId)
        .eq('user_id', userId)
        .single()

      if (error) {
        throw new Error('查询行程失败: ' + error.message)
      }

      if (!results) {
        throw new Error('行程不存在')
      }

      // 解析行程数据，转换为地图需要的格式
      const plan = this.convertPlanForMap(results)
      
      await this.displayTravelPlan(plan)
      wx.hideLoading()
      
    } catch (error) {
      wx.hideLoading()
      console.error('加载行程路线失败：', error)
      wx.showToast({
        title: '加载行程失败',
        icon: 'none'
      })
    }
  },

  /**
   * 显示目的地地图
   */
  async showDestinationMap(destination) {
    wx.showLoading({ title: '搜索目的地...' })
    
    try {
      let geoResult
      
      try {
        // 尝试地理编码获取目的地坐标
        geoResult = await TencentMapManager.geocode(destination)
      } catch (error) {
        console.warn('地理编码失败，使用默认坐标:', error)
        // 如果地理编码失败，使用热门目的地的默认坐标
        const defaultCoordinates = {
          '北京': { lat: 39.90923, lng: 116.397428 },
          '上海': { lat: 31.230416, lng: 121.473701 },
          '杭州': { lat: 30.274084, lng: 120.155107 },
          '三亚': { lat: 18.252847, lng: 109.512646 },
          '西安': { lat: 34.265831, lng: 108.954097 },
          '成都': { lat: 30.572816, lng: 104.066803 }
        }
        
        const defaultCoord = defaultCoordinates[destination] || defaultCoordinates['北京']
        geoResult = {
          success: true,
          location: {
            lat: defaultCoord.lat,
            lng: defaultCoord.lng
          }
        }
      }
      
      if (geoResult.success) {
        this.setData({
          longitude: geoResult.location.lng,
          latitude: geoResult.location.lat,
          markers: [{
            id: 1,
            longitude: geoResult.location.lng,
            latitude: geoResult.location.lat,
            title: destination,
            callout: {
              content: destination,
              color: '#333333',
              fontSize: 14,
              borderRadius: 4,
              bgColor: '#ffffff',
              padding: 8,
              display: 'ALWAYS'
            }
          }]
        })
        
        // 获取目的地天气
        this.getCurrentWeather(geoResult.location.lat, geoResult.location.lng, destination)
      }
      
      wx.hideLoading()
      
    } catch (error) {
      wx.hideLoading()
      console.error('显示目的地地图失败：', error)
      wx.showToast({
        title: '搜索目的地失败',
        icon: 'none'
      })
    }
  },

  /**
   * 切换路线显示
   */
  toggleRoute() {
    this.setData({
      showRoute: !this.data.showRoute
    })
  },

  /**
   * 转换行程数据为地图格式
   */
  convertPlanForMap(planData) {
    console.log('原始行程数据:', planData)
    
    // 解析行程内容
    let itineraryContent = planData.itinerary || '暂无详细行程'
    let parsedItinerary = null
    
    // 尝试解析JSON格式的行程
    if (itineraryContent && typeof itineraryContent === 'string' && 
        (itineraryContent.trim().startsWith('{') || itineraryContent.trim().startsWith('['))) {
      try {
        parsedItinerary = JSON.parse(itineraryContent)
        console.log('JSON解析成功:', parsedItinerary)
      } catch (e) {
        console.warn('JSON解析失败，使用文本解析:', e)
        parsedItinerary = null
      }
    }
    
    // 如果不是JSON，尝试文本解析
    if (!parsedItinerary) {
      parsedItinerary = this.parseItineraryFromText(itineraryContent)
    }
    
    // 获取days数组
    const days = parsedItinerary.days || (Array.isArray(parsedItinerary) ? parsedItinerary : [])
    
    // 转换为标准格式
    const mapPlan = {
      title: planData.title || '未命名行程',
      destination: planData.destination || '未知目的地',
      start_date: planData.start_date,
      end_date: planData.end_date,
      itinerary: {
        days: days.map((dayData, index) => ({
          day: dayData.day || (index + 1),
          items: this.extractAttractionsFromDay(dayData)
        }))
      }
    }
    
    console.log('转换后的地图行程:', mapPlan)
    return mapPlan
  },

  /**
   * 从行程文本中解析景点
   */
  parseItineraryFromText(itineraryContent) {
    const days = []
    const daySections = []
    
    // 按天分割行程内容
    const dayPattern = /(?:Day|第)(\d+)(?:天|日)/gi
    let match
    let lastIndex = 0
    
    while ((match = dayPattern.exec(itineraryContent)) !== null) {
      if (match.index > lastIndex) {
        const previousContent = itineraryContent.substring(lastIndex, match.index).trim()
        if (daySections.length === 0 && previousContent.length > 10) {
          // 第一个可能是前言
        }
      }
      daySections.push({
        day: parseInt(match[1]),
        startIndex: match.index
      })
      lastIndex = match.index + match[0].length
    }
    
    // 处理最后一个day的内容
    if (daySections.length > 0) {
      for (let i = 0; i < daySections.length; i++) {
        const daySection = daySections[i]
        const nextSection = daySections[i + 1]
        const endIndex = nextSection ? nextSection.startIndex : itineraryContent.length
        
        let content = itineraryContent.substring(daySection.startIndex, endIndex).trim()
        
        // 移除日期标识
        content = content.replace(/^(?:Day|第)\d+(?:天|日)[：:\s]*/, '')
        
        days.push({
          day: daySection.day,
          content: content,
          items: [] // 将在下一步解析
        })
      }
    } else {
      // 如果没有找到day格式，按3天默认分割
      const totalDays = 3
      const avgLength = Math.floor(itineraryContent.length / totalDays)
      
      for (let i = 0; i < totalDays; i++) {
        const start = i * avgLength
        const end = i === totalDays - 1 ? itineraryContent.length : (i + 1) * avgLength
        
        days.push({
          day: i + 1,
          content: itineraryContent.substring(start, end).trim(),
          items: []
        })
      }
    }
    
    return { days }
  },

  /**
   * 从每天内容中提取景点
   */
  extractAttractionsFromDay(dayData) {
    const attractions = []
    const content = dayData.content || ''
    
    // 景点关键词和地址模式
    const attractionPatterns = [
      // 带地址的景点：故宫博物院（地址：北京市东城区景山前街4号）
      /([^，。；\n]{2,20})(?:[（(]地址[：:]\s*([^）)]{5,30})[）)])/g,
      // 景点+位置：在故宫博物院参观
      /(?:在|前往|参观|游览|去)([^，。；\n]{2,20})/g,
      // 纯景点名称：故宫博物院
      /([^，。；\n]*(?:故宫|长城|颐和园|天安门|天坛|北海|景山|什刹海|鸟巢|水立方|南锣鼓巷|王府井|外滩|东方明珠|豫园|南京路|城隍庙|西湖|灵隐寺|雷峰塔|断桥|苏堤|三亚|天涯海角|亚龙湾|大东海|兵马俑|大雁塔|古城墙|回民街|钟楼|鼓楼|宽窄巷子|锦里|武侯祠)[^，。；\n]*)/g
    ]
    
    let match
    const processedAttractions = new Set()
    
    // 使用所有模式匹配景点
    for (const pattern of attractionPatterns) {
      const newPattern = new RegExp(pattern.source, pattern.flags)
      while ((match = newPattern.exec(content)) !== null) {
        let title, address = ''
        
        if (match.length >= 3) {
          // 带地址的格式
          title = match[1].trim()
          address = match[2].trim()
        } else if (match.length >= 2) {
          // 带动作的格式
          title = match[1].trim()
          // 尝试从内容中推断地址
          address = this.inferAddressFromAttraction(title)
        } else {
          title = match[1].trim()
          address = this.inferAddressFromAttraction(title)
        }
        
        // 清理和验证
        title = this.cleanAttractionTitle(title)
        address = address || this.inferAddressFromAttraction(title)
        
        // 避免重复
        const key = title + address
        if (title && title.length > 2 && !processedAttractions.has(key)) {
          processedAttractions.add(key)
          attractions.push({
            title: title,
            address: address,
            location: '', // 将由地理编码获取
            time: this.extractTimeFromContent(match.index, content)
          })
        }
      }
    }
    
    // 如果没有提取到景点，创建默认景点
    if (attractions.length === 0 && content.length > 10) {
      const defaultTitle = this.extractMainAttractionFromContent(content)
      if (defaultTitle) {
        attractions.push({
          title: defaultTitle,
          address: this.inferAddressFromAttraction(defaultTitle),
          location: '',
          time: '全天'
        })
      }
    }
    
    return attractions
  },

  /**
   * 清理景点标题
   */
  cleanAttractionTitle(title) {
    return title
      .replace(/^[在|前往|参观|游览|去]/, '')
      .replace(/[：:]\s*$/, '')
      .replace(/^[-•·]\s*/, '')
      .trim()
      .substring(0, 30) // 限制长度
  },

  /**
   * 根据景点名称推断地址
   */
  inferAddressFromAttraction(attractionName) {
    // 常见景点地址映射
    const addressMap = {
      '故宫博物院': '北京市东城区景山前街4号',
      '天安门广场': '北京市东城区长安街',
      '长城': '北京市延庆区八达岭',
      '八达岭长城': '北京市延庆区八达岭',
      '颐和园': '北京市海淀区新建宫门路19号',
      '天坛': '北京市东城区天坛路甲1号',
      '北海公园': '北京市西城区文津街1号',
      '景山公园': '北京市西城区景山西街11号',
      '什刹海': '北京市西城区羊房胡同',
      '鸟巢': '北京市朝阳区国家体育场南路1号',
      '水立方': '北京市朝阳区天辰东路11号',
      '南锣鼓巷': '北京市东城区南锣鼓巷',
      '王府井': '北京市东城区王府井大街',
      '外滩': '上海市黄浦区中山东一路',
      '东方明珠': '上海市浦东新区世纪大道1号',
      '豫园': '上海市黄浦区安仁街218号',
      '南京路步行街': '上海市黄浦区南京东路',
      '城隍庙': '上海市黄浦区方浜中路249号',
      '西湖': '浙江省杭州市西湖区',
      '灵隐寺': '浙江省杭州市西湖区灵隐路法云弄1号',
      '雷峰塔': '浙江省杭州市西湖区南山路15号',
      '断桥': '浙江省杭州市西湖区白堤',
      '苏堤': '浙江省杭州市西湖区苏堤',
      '天涯海角': '海南省三亚市天涯区马岭山',
      '亚龙湾': '海南省三亚市吉阳区亚龙湾',
      '大东海': '海南省三亚市吉阳区大东海',
      '兵马俑': '陕西省西安市临潼区秦陵北路',
      '大雁塔': '陕西省西安市雁塔区大雁塔南广场',
      '古城墙': '陕西省西安市碑林区环城西路',
      '回民街': '陕西省西安市莲湖区回民街',
      '钟楼': '陕西省西安市莲湖区钟楼盘道',
      '鼓楼': '陕西省西安市莲湖区鼓楼盘道',
      '宽窄巷子': '四川省成都市青羊区长顺上街',
      '锦里': '四川省成都市武侯区锦里古街',
      '武侯祠': '四川省成都市武侯区武侯祠大街',
      '都江堰': '四川省成都市都江堰市',
      '熊猫基地': '四川省成都市成华区外北熊猫大道1375号'
    }
    
    return addressMap[attractionName] || `${attractionName}（地址待完善）`
  },

  /**
   * 从内容中提取主要景点
   */
  extractMainAttractionFromContent(content) {
    const mainAttractions = [
      '故宫', '长城', '颐和园', '天安门', '天坛', '北海', '景山', '什刹海',
      '外滩', '东方明珠', '豫园', '南京路', '城隍庙',
      '西湖', '灵隐寺', '雷峰塔', '断桥', '苏堤',
      '天涯海角', '亚龙湾', '大东海',
      '兵马俑', '大雁塔', '古城墙', '回民街', '钟楼', '鼓楼',
      '宽窄巷子', '锦里', '武侯祠', '都江堰', '熊猫基地'
    ]
    
    for (const attraction of mainAttractions) {
      if (content.includes(attraction)) {
        return attraction
      }
    }
    
    return '景点'
  },

  /**
   * 从内容中提取时间信息
   */
  extractTimeFromContent(index, content) {
    const beforeText = content.substring(0, index)
    const timeMatch = beforeText.match(/(\d{1,2}[:：]\d{2})|([上午|下午|晚上|中午])/g)
    
    if (timeMatch && timeMatch.length > 0) {
      const lastMatch = timeMatch[timeMatch.length - 1]
      return lastMatch.includes(':') ? lastMatch : lastMatch
    }
    
    return '全天'
  },

  /**
   * 显示旅行路线
   */
  async displayTravelPlan(plan) {
    const allMarkers = []
    const allPolylines = []
    const fallbackCenter = (() => {
      try {
        const r = TencentMapManager.getFallbackLocation(plan.destination || '')
        const lat = Number(r?.location?.lat)
        const lng = Number(r?.location?.lng)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { latitude: lat, longitude: lng }
        }
      } catch (e) {}
      return { latitude: this.data.latitude, longitude: this.data.longitude }
    })()
    
    // 处理每天的行程
    for (let i = 0; i < plan.itinerary.days.length; i++) {
      const day = plan.itinerary.days[i]
      const dayColor = this.getDayColor(i)
      
      for (let j = 0; j < day.items.length; j++) {
        const item = day.items[j]
        
        try {
          // 地理编码获取景点坐标
          const geoResult = await TencentMapManager.geocode(item.address)
          
          if (geoResult.success) {
            // 添加标记点
            allMarkers.push({
              id: allMarkers.length + 1,
              longitude: geoResult.location.lng,
              latitude: geoResult.location.lat,
              title: item.title,
              iconPath: this.getMarkerIcon(i, j),
              width: 25,
              height: 25,
              callout: {
                content: `第${i+1}天: ${item.title}`,
                color: '#333333',
                fontSize: 12,
                borderRadius: 4,
                bgColor: '#ffffff',
                padding: 6,
                display: 'ALWAYS'
              }
            })
            
            // 如果不是最后一个景点，计算路线
            if (j < day.items.length - 1) {
              const nextItem = day.items[j + 1]
              const nextGeoResult = await TencentMapManager.geocode(nextItem.address)
              
              if (nextGeoResult.success) {
                const routeResult = await TencentMapManager.calculateRoute(
                  geoResult.location,
                  nextGeoResult.location,
                  'walking'
                )
                
                if (routeResult.success && routeResult.routes.length > 0) {
                  const route = routeResult.routes[0]
                  const points = TencentMapManager.formatRouteForDisplay(route)
                  
                  allPolylines.push({
                    points: points,
                    color: dayColor,
                    width: 4,
                    dottedLine: false
                  })
                }
              }
            }
          }
        } catch (error) {
          console.error(`处理景点${item.title}失败：`, error)
        }
      }
    }
    
    // 更新地图显示
    this.setData({
      markers: allMarkers,
      polyline: allPolylines,
      ...(() => {
        const validPoints = allMarkers
          .map(m => {
            const latitude = Number(m?.latitude)
            const longitude = Number(m?.longitude)
            return Number.isFinite(latitude) && Number.isFinite(longitude)
              ? { latitude, longitude }
              : null
          })
          .filter(Boolean)

        if (validPoints.length >= 2) {
          return {
            showRoute: true,
            includePoints: validPoints
          }
        }

        if (validPoints.length === 1) {
          const p = validPoints[0]
          return {
            showRoute: allPolylines.length > 0,
            latitude: p.latitude,
            longitude: p.longitude,
            scale: 16,
            includePoints: [p, p]
          }
        }

        return {
          showRoute: false,
          latitude: fallbackCenter.latitude,
          longitude: fallbackCenter.longitude,
          scale: 12,
          includePoints: [fallbackCenter, fallbackCenter]
        }
      })()
    })
  },

  /**
   * 获取每天路线的颜色
   */
  getDayColor(dayIndex) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']
    return colors[dayIndex % colors.length]
  },

  /**
   * 获取标记点图标
   */
  getMarkerIcon(dayIndex, itemIndex) {
    // 暂时不使用自定义图标，使用系统默认标记
    // 如果需要自定义图标，可以准备相应的图片文件
    return '' // 使用默认地图标记
  },

  /**
   * 获取当前天气
   */
  async getCurrentWeather(lat, lng, cityName = '') {
    try {
      // 如果没有城市名称，根据坐标推断
      if (!cityName) {
        cityName = this.inferCityFromCoordinate(lat, lng)
      }
      
      if (cityName) {
        const weatherResult = await TencentMapManager.getWeather(cityName)
        
        if (weatherResult.success) {
          this.setData({
            weatherInfo: {
              city: cityName,
              temperature: weatherResult.weather.now.temperature,
              weather: weatherResult.weather.now.text,
              icon: this.getWeatherIcon(weatherResult.weather.now.code)
            }
          })
        }
      }
    } catch (error) {
      console.error('获取天气失败：', error)
      // 即使天气获取失败，也不影响地图功能
    }
  },

  /**
   * 根据坐标推断城市名称
   */
  inferCityFromCoordinate(lat, lng) {
    const cityCoordinates = {
      '北京': { lat: 39.90923, lng: 116.397428 },
      '上海': { lat: 31.230416, lng: 121.473701 },
      '杭州': { lat: 30.274084, lng: 120.155107 },
      '三亚': { lat: 18.252847, lng: 109.512646 },
      '西安': { lat: 34.265831, lng: 108.954097 },
      '成都': { lat: 30.572816, lng: 104.066803 }
    }

    let nearestCity = '北京'
    let minDistance = Infinity

    for (const [city, coords] of Object.entries(cityCoordinates)) {
      const distance = TencentMapManager.calculateDistance(lat, lng, coords.lat, coords.lng)
      if (distance < minDistance) {
        minDistance = distance
        nearestCity = city
      }
    }

    return nearestCity
  },

  /**
   * 根据天气代码获取图标
   */
  getWeatherIcon(weatherCode) {
    // 天气图标映射
    const iconMap = {
      '0': '☀️', // 晴
      '1': '⛅', // 多云
      '2': '☁️', // 阴
      '3': '🌧️', // 小雨
      '4': '🌧️', // 中雨
      '5': '⛈️', // 雷阵雨
      '6': '🌨️', // 小雪
      '7': '🌨️', // 中雪
      '99': '❓' // 未知/不可用
    }
    return iconMap[weatherCode] || '🌤️'
  },

  /**
   * 地图点击事件
   */
  onMapTap(e) {
    console.log('地图点击：', e.detail)
    const { longitude, latitude } = e.detail
    
    // 在点击位置添加标记
    const newMarker = {
      id: this.data.markers.length + 1,
      longitude: longitude,
      latitude: latitude,
      title: '选择的位置'
      // 使用默认标记图标
    }
    
    this.setData({
      markers: [...this.data.markers, newMarker]
    })
  },

  /**
   * 标记点点击事件
   */
  onMarkerTap(e) {
    const markerId = e.detail.markerId
    const marker = this.data.markers.find(m => m.id === markerId)
    
    if (marker) {
      wx.showModal({
        title: marker.title,
        content: `位置：${marker.longitude.toFixed(6)}, ${marker.latitude.toFixed(6)}`,
        showCancel: false
      })
    }
  },

  /**
   * 控件点击事件
   */
  onControlTap(e) {
    const controlId = e.detail.controlId
    
    switch (controlId) {
      case 1: // 定位按钮
        this.getCurrentLocation()
        break
      case 2: // 路线开关
        this.setData({
          showRoute: !this.data.showRoute
        })
        break
    }
  },

  /**
   * 返回上一页
   */
  onBack() {
    wx.navigateBack()
  }
})
