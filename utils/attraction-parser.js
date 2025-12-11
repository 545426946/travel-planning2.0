/**
 * 景点解析器 - 简化版本
 * 从AI生成的行程文本中提取景点名称
 */

const attractionsDB = require('../config/attractions-database')

class AttractionParser {
  constructor() {
    // 从数据库构建景点名称列表，按长度降序排列
    this.knownAttractions = Object.keys(attractionsDB).sort((a, b) => b.length - a.length)
    console.log(`[AttractionParser] 加载了 ${this.knownAttractions.length} 个已知景点`)
  }

  /**
   * 从行程文本中提取景点
   */
  parse(itinerary, city = '') {
    if (!itinerary || typeof itinerary !== 'string') {
      return []
    }

    console.log('[AttractionParser] 开始解析，文本长度:', itinerary.length, '城市:', city)
    
    const foundAttractions = new Set()

    // 策略1: 直接匹配已知景点（最可靠）
    for (const attraction of this.knownAttractions) {
      if (itinerary.includes(attraction)) {
        foundAttractions.add(attraction)
        console.log(`[AttractionParser] 直接匹配: ${attraction}`)
      }
    }

    // 策略2: 使用正则提取带后缀的名称
    this.extractByPatterns(itinerary, foundAttractions)

    // 去重（移除被包含的短名称）
    const deduped = this.deduplicateAttractions(Array.from(foundAttractions))
    
    // 限制数量
    const result = deduped.slice(0, 15)
    
    console.log(`[AttractionParser] 解析完成，找到 ${result.length} 个景点:`, result)
    return result
  }

  /**
   * 使用正则模式提取景点名称
   */
  extractByPatterns(text, foundSet) {
    // 景点后缀词
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
          const dbMatch = this.findMatchingAttraction(name)
          if (dbMatch) {
            foundSet.add(dbMatch)
            console.log(`[AttractionParser] 后缀匹配: ${name} -> ${dbMatch}`)
          }
        }
      }
    }

    // 动作词模式
    const actionPatterns = [
      /(?:参观|游览|前往|到达|打卡|游玩|逛|去|抵达|来到|探访|体验|欣赏|登上|漫步)[：:\s]*([^\n,，。！!？?]{2,15})/g
    ]

    for (const pattern of actionPatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim()
        if (this.isValidAttractionName(name)) {
          const dbMatch = this.findMatchingAttraction(name)
          if (dbMatch) {
            foundSet.add(dbMatch)
            console.log(`[AttractionParser] 动作词匹配: ${name} -> ${dbMatch}`)
          }
        }
      }
    }

    // 引号内容
    const quotePattern = /["「『【"']([^"」』】"']{2,12})["」』】"']/g
    let match
    while ((match = quotePattern.exec(text)) !== null) {
      const name = match[1].trim()
      if (this.isValidAttractionName(name)) {
        const dbMatch = this.findMatchingAttraction(name)
        if (dbMatch) {
          foundSet.add(dbMatch)
          console.log(`[AttractionParser] 引号匹配: ${name} -> ${dbMatch}`)
        }
      }
    }
  }

  /**
   * 去除重复景点
   */
  deduplicateAttractions(attractions) {
    const sorted = [...attractions].sort((a, b) => b.length - a.length)
    const result = []
    
    for (const attraction of sorted) {
      const isSubset = result.some(existing => existing.includes(attraction))
      if (!isSubset) {
        result.push(attraction)
      }
    }
    
    return result
  }

  /**
   * 在已知景点中查找匹配
   */
  findMatchingAttraction(name) {
    if (!name || name.length < 2) return null
    if (!this.isValidAttractionName(name)) return null
    
    // 精确匹配
    if (this.knownAttractions.includes(name)) {
      return name
    }

    // 模糊匹配 - 已知景点包含输入名称
    if (name.length >= 3) {
      for (const attraction of this.knownAttractions) {
        if (attraction.includes(name)) {
          return attraction
        }
      }
    }
    
    // 模糊匹配 - 输入名称包含已知景点
    for (const attraction of this.knownAttractions) {
      if (attraction.length >= 3 && name.includes(attraction)) {
        return attraction
      }
    }

    return null
  }

  /**
   * 验证名称是否有效
   */
  isValidAttractionName(name) {
    if (!name || name.length < 2 || name.length > 20) return false

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

    if (!/[\u4e00-\u9fa5]/.test(name)) {
      return false
    }

    return true
  }

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

    for (const city of cities) {
      if (destination.includes(city)) return city
    }

    for (const city of cities) {
      if (title.includes(city)) return city
    }

    const textToSearch = `${destination} ${title} ${itinerary.substring(0, 500)}`
    for (const city of cities) {
      if (textToSearch.includes(city)) return city
    }

    return destination || '北京'
  }
}

module.exports = new AttractionParser()
