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
    
    // 按天分组的标记点
    markersByDay: [],
    
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
    
    console.log('开始提取第' + dayData.day + '天的景点，内容长度:', content.length)
    console.log('内容前200字符:', content.substring(0, 200))
    
    // 更全面的景点关键词和地址模式
    const attractionPatterns = [
      // 带地址的景点：故宫博物院（地址：北京市东城区景山前街4号）
      /([^，。；\n]{2,20})(?:[（(]地址[：:]\s*([^）)]{5,30})[）)])/g,
      // 景点+位置：在故宫博物院参观
      /(?:在|前往|参观|游览|去到|到达|探访)([^，。；\n]{2,20})/g,
      // 包含明确景点关键词的模式
      /([^，。；\n]*(?:故宫|长城|颐和园|天安门|天坛|北海|景山|什刹海|鸟巢|水立方|南锣鼓巷|王府井|外滩|东方明珠|豫园|南京路|城隍庙|西湖|灵隐寺|雷峰塔|断桥|苏堤|三潭印月|宋城|河坊街|天涯海角|亚龙湾|大东海|三亚湾|南山|蜈支洲岛|兵马俑|大雁塔|古城墙|回民街|钟楼|鼓楼|华清池|大唐芙蓉园|宽窄巷子|锦里|武侯祠|杜甫草堂|青羊宫|都江堰|熊猫基地)[^，。；\n]*)/g,
      // 时间段+景点模式：🌅 上午 (8:00-12:00)：故宫博物院
      /[🌅☀️🌙]\s*(?:上午|下午|晚上)[^：:]*[：:]\s*([^，。；\n]{2,30})/g,
      // 带动作的景点：参观故宫、游览长城
      /(参观|游览|前往|去到|探访|寻访)([^，。；\n]{2,20})/g,
      // 景点类型模式：...公园、...博物馆、...寺、...塔
      /([^，。；\n]{2,15}(?:公园|博物馆|寺|庙|塔|阁|宫|殿|观|湖|海|湾|岛|街|巷|场|广场|古镇|遗址|景区|景点))/g
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
          // 带动作的格式或普通匹配
          title = match[1].trim()
          if (title.match(/^(参观|游览|前往|去到|探访|寻访)/)) {
            // 如果匹配到动作词，使用第二部分作为景点名
            title = match[2] ? match[2].trim() : title.replace(/^(参观|游览|前往|去到|探访|寻访)/, '').trim()
          }
          // 尝试从内容中推断地址
          address = this.inferAddressFromAttraction(title)
        } else {
          title = match[1].trim()
          address = this.inferAddressFromAttraction(title)
        }
        
        // 清理和验证
        title = this.cleanAttractionTitle(title)
        address = address || this.inferAddressFromAttraction(title)
        
        // 验证景点有效性
        if (title && title.length > 2 && this.isValidAttraction(title)) {
          // 避免重复
          const key = title + address
          if (!processedAttractions.has(key)) {
            processedAttractions.add(key)
            attractions.push({
              title: title,
              address: address,
              location: '', // 将由地理编码获取
              time: this.extractTimeFromContent(match.index, content)
            })
            console.log('提取到景点:', { title, address, time: this.extractTimeFromContent(match.index, content) })
          }
        }
      }
    }
    
    // 如果没有提取到景点，尝试从每天的活动中提取
    if (attractions.length === 0 && dayData.items && dayData.items.length > 0) {
      dayData.items.forEach(item => {
        if (item.title && this.isValidAttraction(item.title)) {
          const address = item.location || this.inferAddressFromAttraction(item.title)
          attractions.push({
            title: item.title,
            address: address,
            location: '',
            time: item.time || '全天'
          })
        }
      })
    }
    
    // 如果还是没有景点，创建默认景点
    if (attractions.length === 0 && content.length > 10) {
      const defaultTitle = this.extractMainAttractionFromContent(content)
      if (defaultTitle && this.isValidAttraction(defaultTitle)) {
        attractions.push({
          title: defaultTitle,
          address: this.inferAddressFromAttraction(defaultTitle),
          location: '',
          time: '全天'
        })
      }
    }
    
    console.log('第' + dayData.day + '天提取到景点数量:', attractions.length)
    attractions.forEach((attr, index) => {
      console.log(`景点${index + 1}:`, { title: attr.title, address: attr.address, time: attr.time })
    })
    
    return attractions
  },

  /**
   * 验证景点是否有效
   */
  isValidAttraction(title) {
    if (!title || title.length < 2) return false
    
    // 排除无效内容
    const invalidPatterns = [
      /^(费用|总计|交通|住宿|餐饮|早餐|午餐|晚餐|休息|自由活动|购物|拍照|打卡|集合|解散|出发|返回)/,
      /^(打车|公交|地铁|飞机|高铁|汽车|轮船)/,
      /^(酒店|民宿|客栈|旅馆)/,
      /^(我|我们|大家|游客|客人)/,
      /^\d+[:：]\d+/, // 纯时间
      /^[-•·]$/, // 纯符号
      /^(上午|下午|晚上|中午|全天|今天|明天)/,
      /^[：:：\s]*$/,
      /^(推荐|建议|可以|选择|包含|包含门票)/
    ]
    
    for (const pattern of invalidPatterns) {
      if (pattern.test(title)) {
        return false
      }
    }
    
    // 必须包含至少一个有效的景点相关字符
    const validChars = /[\u4e00-\u9fa5a-zA-Z0-9]/
    return validChars.test(title)
  },

  /**
   * 清理景点标题
   */
  cleanAttractionTitle(title) {
    return title
      .replace(/^[在|前往|参观|游览|去|到达|探访|寻访]/, '')
      .replace(/[：:]\s*$/, '')
      .replace(/^[-•·]\s*/, '')
      .replace(/门票[：:]?\s*\d+元[\/]?人?/, '') // 移除门票信息
      .replace(/预估[：:]?\s*\d+元/, '') // 移除预估价格
      .replace(/\([^)]*\)/, '') // 移除括号内容
      .replace(/（[^）]*）/, '') // 移除中文括号内容
      .trim()
      .substring(0, 30) // 限制长度
  },

  /**
   * 根据景点名称推断地址
   */
  inferAddressFromAttraction(attractionName) {
    // 扩展的常见景点地址映射
    const addressMap = {
      // 北京景点
      '故宫博物院': '北京市东城区景山前街4号',
      '故宫': '北京市东城区景山前街4号',
      '天安门广场': '北京市东城区长安街',
      '天安门': '北京市东城区长安街',
      '长城': '北京市延庆区八达岭',
      '八达岭长城': '北京市延庆区八达岭',
      '慕田峪长城': '北京市怀柔区慕田峪村',
      '居庸关长城': '北京市昌平区居庸关村',
      '颐和园': '北京市海淀区新建宫门路19号',
      '天坛': '北京市东城区天坛路甲1号',
      '天坛公园': '北京市东城区天坛路甲1号',
      '北海公园': '北京市西城区文津街1号',
      '景山公园': '北京市西城区景山西街11号',
      '什刹海': '北京市西城区羊房胡同',
      '什刹海风景区': '北京市西城区羊房胡同',
      '鸟巢': '北京市朝阳区国家体育场南路1号',
      '国家体育场': '北京市朝阳区国家体育场南路1号',
      '水立方': '北京市朝阳区天辰东路11号',
      '国家游泳中心': '北京市朝阳区天辰东路11号',
      '南锣鼓巷': '北京市东城区南锣鼓巷',
      '王府井': '北京市东城区王府井大街',
      '王府井大街': '北京市东城区王府井大街',
      '三里屯': '北京市朝阳区三里屯',
      '798艺术区': '北京市朝阳区酒仙桥路2号',
      '雍和宫': '北京市东城区雍和宫大街12号',
      '孔庙': '北京市东城区国子监街13号',
      '国子监': '北京市东城区国子监街15号',
      '钟鼓楼': '北京市东城区钟楼湾胡同',
      
      // 上海景点
      '外滩': '上海市黄浦区中山东一路',
      '东方明珠': '上海市浦东新区世纪大道1号',
      '东方明珠塔': '上海市浦东新区世纪大道1号',
      '豫园': '上海市黄浦区安仁街218号',
      '豫园商城': '上海市黄浦区安仁街218号',
      '南京路步行街': '上海市黄浦区南京东路',
      '南京路': '上海市黄浦区南京东路',
      '城隍庙': '上海市黄浦区方浜中路249号',
      '老城隍庙': '上海市黄浦区方浜中路249号',
      '新天地': '上海市黄浦区太仓路',
      '田子坊': '上海市黄浦区泰康路210弄',
      '淮海路': '上海市黄浦区淮海中路',
      '静安寺': '上海市静安区南京西路1686号',
      '玉佛寺': '上海市普陀区安远路170号',
      '上海博物馆': '上海市黄浦区人民大道201号',
      '上海科技馆': '上海市浦东新区世纪大道2000号',
      
      // 杭州景点
      '西湖': '浙江省杭州市西湖区',
      '西湖风景区': '浙江省杭州市西湖区',
      '灵隐寺': '浙江省杭州市西湖区灵隐路法云弄1号',
      '飞来峰': '浙江省杭州市西湖区灵隐路',
      '雷峰塔': '浙江省杭州市西湖区南山路15号',
      '断桥': '浙江省杭州市西湖区白堤',
      '断桥残雪': '浙江省杭州市西湖区白堤',
      '苏堤': '浙江省杭州市西湖区苏堤',
      '苏堤春晓': '浙江省杭州市西湖区苏堤',
      '三潭印月': '浙江省杭州市西湖区',
      '宋城': '浙江省杭州市西湖区之江路148号',
      '宋城景区': '浙江省杭州市西湖区之江路148号',
      '河坊街': '浙江省杭州市上城区河坊街',
      '清河坊': '浙江省杭州市上城区河坊街',
      '西溪湿地': '浙江省杭州市西湖区天目山路518号',
      '千岛湖': '浙江省杭州市淳安县千岛湖镇',
      '六和塔': '浙江省杭州市西湖区之江路16号',
      
      // 三亚景点
      '天涯海角': '海南省三亚市天涯区马岭山',
      '天涯海角景区': '海南省三亚市天涯区马岭山',
      '亚龙湾': '海南省三亚市吉阳区亚龙湾',
      '亚龙湾海滩': '海南省三亚市吉阳区亚龙湾',
      '大东海': '海南省三亚市吉阳区大东海',
      '大东海海滩': '海南省三亚市吉阳区大东海',
      '三亚湾': '海南省三亚市天涯区三亚湾',
      '南山文化旅游区': '海南省三亚市崖州区南山文化旅游区',
      '南山寺': '海南省三亚市崖州区南山文化旅游区',
      '蜈支洲岛': '海南省三亚市海棠区蜈支洲岛',
      '西岛': '海南省三亚市天涯区西岛',
      '鹿回头公园': '海南省三亚市天涯区鹿回头公园',
      
      // 西安景点
      '兵马俑': '陕西省西安市临潼区秦陵北路',
      '秦始皇兵马俑': '陕西省西安市临潼区秦陵北路',
      '兵马俑博物馆': '陕西省西安市临潼区秦陵北路',
      '大雁塔': '陕西省西安市雁塔区大雁塔南广场',
      '大慈恩寺': '陕西省西安市雁塔区大慈恩寺',
      '小雁塔': '陕西省西安市碑林区友谊西路72号',
      '古城墙': '陕西省西安市碑林区环城西路',
      '西安城墙': '陕西省西安市碑林区环城西路',
      '回民街': '陕西省西安市莲湖区回民街',
      '回民小吃街': '陕西省西安市莲湖区回民街',
      '钟楼': '陕西省西安市莲湖区钟楼盘道',
      '鼓楼': '陕西省西安市莲湖区鼓楼盘道',
      '华清池': '陕西省西安市临潼区华清路38号',
      '大唐芙蓉园': '陕西省西安市曲江新区芙蓉西路99号',
      '陕西历史博物馆': '陕西省西安市雁塔区小寨东路91号',
      
      // 成都景点
      '宽窄巷子': '四川省成都市青羊区长顺上街',
      '宽窄巷': '四川省成都市青羊区长顺上街',
      '锦里': '四川省成都市武侯区锦里古街',
      '锦里古街': '四川省成都市武侯区锦里古街',
      '武侯祠': '四川省成都市武侯区武侯祠大街',
      '武侯祠博物馆': '四川省成都市武侯区武侯祠大街',
      '杜甫草堂': '四川省成都市青羊区青华路37号',
      '杜甫草堂博物馆': '四川省成都市青羊区青华路37号',
      '青羊宫': '四川省成都市青羊区一环路西二段',
      '都江堰': '四川省成都市都江堰市都江堰景区',
      '都江堰景区': '四川省成都市都江堰市都江堰景区',
      '熊猫基地': '四川省成都市成华区外北熊猫大道1375号',
      '成都大熊猫基地': '四川省成都市成华区外北熊猫大道1375号',
      '春熙路': '四川省成都市锦江区春熙路',
      '太古里': '四川省成都市锦江区中纱帽街',
      '文殊院': '四川省成都市青羊区文殊院街',
      
      // 其他热门景点
      '天安门': '北京市东城区长安街',
      '天安门广场': '北京市东城区长安街',
      '人民大会堂': '北京市西城区西长安街',
      '毛主席纪念堂': '北京市东城区天安门广场',
      '中国国家博物馆': '北京市东城区东长安街16号',
      '中山公园': '北京市东城区中华路4号',
      '中山公园': '上海市长宁区长宁路780号',
      '世纪公园': '上海市浦东新区锦绣路1001号',
      '欢乐谷': '上海市松江区林湖路888号',
      '欢乐谷': '北京市朝阳区东四环小武基北路',
      '欢乐谷': '成都市金牛区西华大道16号',
      '欢乐谷': '深圳市南山区侨城西路',
      '欢乐谷': '武汉市洪山区欢乐大道',
      '欢乐谷': '天津市东丽区湖景路',
      '欢乐谷': '重庆市南岸区崇文路',
      '欢乐谷': '南京市栖霞区经济技术开发区',
      '欢乐谷': '广州市番禺区大石镇',
      '欢乐谷': '杭州市余杭区良渚街道',
      '欢乐谷': '苏州市吴中区越溪街道',
      '欢乐谷': '青岛市黄岛区漓江路',
      '欢乐谷': '大连市甘井子区南关岭街道',
      '欢乐谷': '沈阳市铁西区兴华北街',
      '欢乐谷': '长春市南关区净月街道',
      '欢乐谷': '哈尔滨市松北区世茂大道',
      '欢乐谷': '石家庄市裕华区槐安东路',
      '欢乐谷': '太原市万柏林区长风西街',
      '欢乐谷': '呼和浩特市赛罕区敕勒川大街',
      '欢乐谷': '郑州市金水区花园路',
      '欢乐谷': '合肥市蜀山区黄山路',
      '欢乐谷': '南昌市青山湖区青山湖大道',
      '欢乐谷': '福州市仓山区南江滨西大道',
      '欢乐谷': '厦门市思明区环岛南路',
      '欢乐谷': '济南市历城区港沟街道',
      '欢乐谷': '青岛市黄岛区漓江路',
      '欢乐谷': '郑州市金水区花园路',
      '欢乐谷': '武汉市洪山区欢乐大道',
      '欢乐谷': '长沙市岳麓区岳麓山',
      '欢乐谷': '广州市番禺区大石镇',
      '欢乐谷': '深圳市南山区侨城西路',
      '欢乐谷': '南宁市西乡塘区大学东路',
      '欢乐谷': '海口市美兰区琼山大道',
      '欢乐谷': '成都市金牛区西华大道16号',
      '欢乐谷': '贵阳市南明区花果园',
      '欢乐谷': '昆明市西山区前卫街道',
      '欢乐谷': '拉萨市城关区江苏路',
      '欢乐谷': '西安市雁塔区曲江新区',
      '欢乐谷': '兰州市城关区白银路',
      '欢乐谷': '西宁市城西区五四西路',
      '欢乐谷': '银川市兴庆区凤凰北街',
      '欢乐谷': '乌鲁木齐市沙依巴克区友好北路',
      '欢乐谷': '沈阳市和平区中华路',
      '欢乐谷': '长春市朝阳区前进大街',
      '欢乐谷': '哈尔滨市道里区友谊路',
      '欢乐谷': '南京市鼓楼区北京西路',
      '欢乐谷': '杭州市拱墅区莫干山路',
      '欢乐谷': '合肥市蜀山区黄山路',
      '欢乐谷': '福州市仓山区南江滨西大道',
      '欢乐谷': '南昌市青山湖区青山湖大道',
      '欢乐谷': '济南市历城区港沟街道',
      '欢乐谷': '青岛市黄岛区漓江路',
      '欢乐谷': '郑州市金水区花园路',
      '欢乐谷': '武汉市洪山区欢乐大道',
      '欢乐谷': '长沙市岳麓区岳麓山',
      '欢乐谷': '广州市番禺区大石镇',
      '欢乐谷': '深圳市南山区侨城西路',
      '欢乐谷': '南宁市西乡塘区大学东路',
      '欢乐谷': '海口市美兰区琼山大道',
      '欢乐谷': '成都市金牛区西华大道16号',
      '欢乐谷': '贵阳市南明区花果园',
      '欢乐谷': '昆明市西山区前卫街道',
      '欢乐谷': '拉萨市城关区江苏路',
      '欢乐谷': '西安市雁塔区曲江新区',
      '欢乐谷': '兰州市城关区白银路',
      '欢乐谷': '西宁市城西区五四西路',
      '欢乐谷': '银川市兴庆区凤凰北街',
      '欢乐谷': '乌鲁木齐市沙依巴克区友好北路'
    }
    
    // 先尝试精确匹配
    if (addressMap[attractionName]) {
      return addressMap[attractionName]
    }
    
    // 模糊匹配：如果景点名包含某个关键词
    for (const [key, address] of Object.entries(addressMap)) {
      if (attractionName.includes(key) || key.includes(attractionName)) {
        return address
      }
    }
    
    // 根据景点类型推断城市和区域
    if (attractionName.includes('北京') || attractionName.includes('故宫') || attractionName.includes('长城') || 
        attractionName.includes('天安门') || attractionName.includes('颐和园') || attractionName.includes('天坛')) {
      return `北京市 ${attractionName}`
    }
    
    if (attractionName.includes('上海') || attractionName.includes('外滩') || attractionName.includes('东方明珠') || 
        attractionName.includes('豫园') || attractionName.includes('南京路')) {
      return `上海市 ${attractionName}`
    }
    
    if (attractionName.includes('杭州') || attractionName.includes('西湖') || attractionName.includes('灵隐寺') || 
        attractionName.includes('雷峰塔')) {
      return `浙江省杭州市 ${attractionName}`
    }
    
    if (attractionName.includes('三亚') || attractionName.includes('天涯海角') || attractionName.includes('亚龙湾')) {
      return `海南省三亚市 ${attractionName}`
    }
    
    if (attractionName.includes('西安') || attractionName.includes('兵马俑') || attractionName.includes('大雁塔') || 
        attractionName.includes('古城墙')) {
      return `陕西省西安市 ${attractionName}`
    }
    
    if (attractionName.includes('成都') || attractionName.includes('宽窄巷子') || attractionName.includes('锦里') || 
        attractionName.includes('熊猫基地')) {
      return `四川省成都市 ${attractionName}`
    }
    
    return `${attractionName}（地址待完善）`
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
    console.log('开始显示旅行路线，计划数据:', plan)
    
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
    
    let markerIndex = 0
    
    // 处理每天的行程
    for (let i = 0; i < plan.itinerary.days.length; i++) {
      const day = plan.itinerary.days[i]
      const dayColor = this.getDayColor(i)
      
      console.log(`处理第${i + 1}天，景点数量:`, day.items.length)
      
      const dayCoordinates = [] // 存储当天景点的坐标，用于路线规划
      
      for (let j = 0; j < day.items.length; j++) {
        const item = day.items[j]
        
        try {
          // 地理编码获取景点坐标
          console.log(`正在地理编码景点: ${item.title} - ${item.address}`)
          const geoResult = await TencentMapManager.geocode(item.address)
          
          if (geoResult.success) {
            const marker = {
              id: ++markerIndex,
              longitude: geoResult.location.lng,
              latitude: geoResult.location.lat,
              title: item.title,
              iconPath: this.getMarkerIcon(i, j),
              width: 30,
              height: 30,
              callout: {
                content: `第${i+1}天: ${item.title}${item.time ? ' (' + item.time + ')' : ''}`,
                color: '#333333',
                fontSize: 12,
                borderRadius: 4,
                bgColor: '#ffffff',
                padding: 6,
                display: 'ALWAYS'
              }
            }
            
            allMarkers.push(marker)
            dayCoordinates.push({
              ...geoResult.location,
              title: item.title,
              index: markerIndex
            })
            
            console.log(`成功添加标记点: ${item.title} at ${geoResult.location.lat}, ${geoResult.location.lng}`)
          } else {
            console.warn(`景点${item.title}地理编码失败`)
          }
        } catch (error) {
          console.error(`处理景点${item.title}失败：`, error)
        }
      }
      
      // 为当天景点创建路线连接
      if (dayCoordinates.length >= 2) {
        console.log(`为第${i + 1}天创建路线，连接${dayCoordinates.length}个景点`)
        
        // 创建相邻景点之间的路线
        for (let k = 0; k < dayCoordinates.length - 1; k++) {
          const fromPoint = dayCoordinates[k]
          const toPoint = dayCoordinates[k + 1]
          
          try {
            // 创建简单的直线连接（避免API调用失败）
            const routePoints = [
              {
                latitude: fromPoint.lat,
                longitude: fromPoint.lng
              },
              {
                latitude: toPoint.lat,
                longitude: toPoint.lng
              }
            ]
            
            allPolylines.push({
              points: routePoints,
              color: dayColor,
              width: 4,
              dottedLine: false,
              arrowLine: true
            })
            
            console.log(`创建路线: ${fromPoint.title} -> ${toPoint.title}`)
          } catch (error) {
            console.error(`创建路线失败 (${fromPoint.title} -> ${toPoint.title}):`, error)
          }
        }
      }
    }
    
    console.log(`总共创建了 ${allMarkers.length} 个标记点和 ${allPolylines.length} 条路线`)
    
    // 创建按天分组的标记点数据
    const markersByDay = this.groupMarkersByDay(allMarkers, plan.itinerary.days.length)
    
    // 更新地图显示
    this.setData({
      markers: allMarkers,
      polyline: allPolylines,
      markersByDay: markersByDay,
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
            includePoints: validPoints,
            loading: false
          }
        }

        if (validPoints.length === 1) {
          const p = validPoints[0]
          return {
            showRoute: allPolylines.length > 0,
            latitude: p.latitude,
            longitude: p.longitude,
            scale: 16,
            includePoints: [p, p],
            loading: false
          }
        }

        return {
          showRoute: false,
          latitude: fallbackCenter.latitude,
          longitude: fallbackCenter.longitude,
          scale: 12,
          includePoints: [fallbackCenter, fallbackCenter],
          loading: false
        }
      })()
    })
    
    // 显示景点统计信息
    if (allMarkers.length > 0) {
      wx.showToast({
        title: `已加载${allMarkers.length}个景点`,
        icon: 'success',
        duration: 2000
      })
    }
  },

  /**
   * 获取每天路线的颜色
   */
  getDayColor(dayIndex) {
    const colors = [
      '#FF6B6B', // 红色
      '#4ECDC4', // 青色  
      '#45B7D1', // 蓝色
      '#96CEB4', // 绿色
      '#FFEAA7', // 黄色
      '#DDA0DD', // 紫色
      '#FFB6C1', // 粉色
      '#87CEEB'  // 天蓝色
    ]
    return colors[dayIndex % colors.length]
  },

  /**
   * 获取标记点图标
   */
  getMarkerIcon(dayIndex, itemIndex) {
    // 使用内置的地图标记图标样式
    // dayIndex 影响颜色，itemIndex 影响样式
    const markerTypes = ['', '', ''] // 使用默认标记
    return markerTypes[itemIndex % markerTypes.length]
  },

  /**
   * 按天分组标记点
   */
  groupMarkersByDay(markers, totalDays) {
    const markersByDay = []
    let currentDayIndex = 0
    let currentDayMarkers = []
    let previousCallout = ''

    markers.forEach((marker, index) => {
      // 从callout中提取天数信息
      const calloutText = marker.callout.content || ''
      const dayMatch = calloutText.match(/第(\d+)天/)
      
      if (dayMatch) {
        const dayIndex = parseInt(dayMatch[1]) - 1
        
        // 如果是新的天数，保存前一天的标记点
        if (dayIndex !== currentDayIndex && currentDayMarkers.length > 0) {
          markersByDay.push({
            dayIndex: currentDayIndex,
            day: currentDayIndex + 1,
            color: this.getDayColor(currentDayIndex),
            markers: [...currentDayMarkers]
          })
          currentDayMarkers = []
        }
        
        currentDayIndex = dayIndex
      }
      
      // 添加时间信息到标记点
      const timeMatch = calloutText.match(/\(([^)]+)\)/)
      const time = timeMatch ? timeMatch[1] : ''
      
      const enrichedMarker = {
        ...marker,
        time: time
      }
      
      currentDayMarkers.push(enrichedMarker)
      
      // 如果是最后一个标记点，保存最后一天的数据
      if (index === markers.length - 1 && currentDayMarkers.length > 0) {
        markersByDay.push({
          dayIndex: currentDayIndex,
          day: currentDayIndex + 1,
          color: this.getDayColor(currentDayIndex),
          markers: [...currentDayMarkers]
        })
      }
    })

    // 如果没有检测到天数信息，按总天数平均分配
    if (markersByDay.length === 0 && markers.length > 0) {
      const markersPerDay = Math.ceil(markers.length / totalDays)
      
      for (let i = 0; i < totalDays; i++) {
        const startIndex = i * markersPerDay
        const endIndex = Math.min(startIndex + markersPerDay, markers.length)
        
        if (startIndex < markers.length) {
          markersByDay.push({
            dayIndex: i,
            day: i + 1,
            color: this.getDayColor(i),
            markers: markers.slice(startIndex, endIndex).map(marker => ({ ...marker }))
          })
        }
      }
    }

    console.log('按天分组结果:', markersByDay)
    return markersByDay
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
