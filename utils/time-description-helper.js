// 时间地点描述生成辅助工具
class TimeDescriptionHelper {
  
  // 生成包含具体时间地点的描述
  static generateDescription(daysData) {
    if (!daysData || daysData.length === 0) {
      return '为您精心安排的详细行程，包含每日的具体安排。'
    }

    let description = `为您精心安排的${daysData.length}天行程，具体安排如下：\n\n`
    
    daysData.slice(0, Math.min(daysData.length, 3)).forEach((dayData, index) => {
      const dayNum = index + 1
      description += `第${dayNum}天：\n`
      
      const timeSchedule = this.extractTimeSchedule(dayData.items || [])
      
      if (timeSchedule.morning.length > 0) {
        description += `上午前往${timeSchedule.morning.join('、')}参观游览；\n`
      }
      
      if (timeSchedule.noon.length > 0) {
        const noonFood = timeSchedule.noonFood.length > 0 ? timeSchedule.noonFood[0] : '当地美食'
        description += `中午在${timeSchedule.noon.join('、')}享用${noonFood}；\n`
      }
      
      if (timeSchedule.afternoon.length > 0) {
        description += `下午前往${timeSchedule.afternoon.join('、')}继续游览；\n`
      }
      
      if (timeSchedule.evening.length > 0) {
        const eveningFood = timeSchedule.eveningFood.length > 0 ? timeSchedule.eveningFood[0] : '特色活动'
        description += `晚上在${timeSchedule.evening.join('、')}体验${eveningFood}。`
      }
      
      description += '\n'
    })

    description += '行程精心安排，时间合理，让您充分体验每个景点的特色。'
    
    return description
  }

  // 为指定天数生成单独的行程描述
  static generateDayDescription(daysData, targetDay) {
    if (!daysData || daysData.length === 0 || targetDay < 1 || targetDay > daysData.length) {
      return `第${targetDay}天的行程信息暂时无法获取。`
    }

    const dayData = daysData[targetDay - 1]
    const timeSchedule = this.extractTimeSchedule(dayData.items || [])
    
    let description = ''
    
    if (timeSchedule.morning.length > 0) {
      description += `🌅 上午：前往${timeSchedule.morning.join('、')}参观游览，感受${timeSchedule.morning[0]}的独特魅力。\n\n`
    } else {
      description += `🌅 上午：自由活动时间，您可以在酒店附近悠闲漫步，享受当地的晨光。\n\n`
    }
    
    if (timeSchedule.noon.length > 0) {
      const noonFood = timeSchedule.noonFood.length > 0 ? timeSchedule.noonFood[0] : '当地特色美食'
      description += `🍽️ 中午：在${timeSchedule.noon.join('、')}享用美味的${noonFood}，补充体力。\n\n`
    } else {
      description += `🍽️ 中午：品尝当地特色美食，在附近的餐厅享受午餐时光。\n\n`
    }
    
    if (timeSchedule.afternoon.length > 0) {
      description += `☀️ 下午：前往${timeSchedule.afternoon.join('、')}继续游览，深度体验${timeSchedule.afternoon[0]}的文化底蕴。\n\n`
    } else {
      description += `☀️ 下午：轻松游览或自由活动，您可以逛逛当地的小店，体验慢节奏的旅行。\n\n`
    }
    
    if (timeSchedule.evening.length > 0) {
      const eveningFood = timeSchedule.eveningFood.length > 0 ? timeSchedule.eveningFood[0] : '当地特色活动'
      description += `🌙 晚上：在${timeSchedule.evening.join('、')}体验${eveningFood}，结束美好的一天。`
    } else {
      description += `🌙 晚上：返回酒店休息，或在当地体验夜生活，感受不同的城市氛围。`
    }

    return description
  }

  // 生成所有天数的概要描述（用于行程总览）
  static generateOverviewDescription(daysData) {
    if (!daysData || daysData.length === 0) {
      return '为您精心安排的详细行程，包含每日的具体安排。'
    }

    const totalDays = daysData.length
    let description = `为您精心安排的${totalDays}天精彩行程，每日亮点如下：\n\n`
    
    daysData.forEach((dayData, index) => {
      const dayNum = index + 1
      const timeSchedule = this.extractTimeSchedule(dayData.items || [])
      
      description += `第${dayNum}天：`
      
      const allSpots = [
        ...timeSchedule.morning,
        ...timeSchedule.noon,
        ...timeSchedule.afternoon,
        ...timeSchedule.evening
      ]
      
      if (allSpots.length > 0) {
        const uniqueSpots = [...new Set(allSpots)]
        if (uniqueSpots.length <= 3) {
          description += `游览${uniqueSpots.join('、')}`
        } else {
          description += `游览${uniqueSpots.slice(0, 2).join('、')}等${uniqueSpots.length}个景点`
        }
      } else {
        description += '自由活动与休闲体验'
      }
      
      description += '\n'
    })

    description += '\n点击具体天数可查看详细的时间安排和活动介绍。'
    
    return description
  }

  // 提取时间安排
  static extractTimeSchedule(items) {
    const schedule = {
      morning: [],
      noon: [],
      noonFood: [],
      afternoon: [],
      evening: [],
      eveningFood: []
    }

    items.forEach(item => {
      const title = item.title || ''
      const location = item.location || ''
      const time = item.time || ''

      // 首先使用明确的location字段
      let spot = location && location.trim() ? location.trim() : this.extractSpotFromTitle(title)

      if (time.includes('上午')) {
        if (spot) schedule.morning.push(spot)
      } else if (time.includes('中午') || time.includes('午')) {
        if (spot) schedule.noon.push(spot)
        const food = this.extractFoodFromTitle(title)
        if (food) schedule.noonFood.push(food)
      } else if (time.includes('下午')) {
        if (spot) schedule.afternoon.push(spot)
      } else if (time.includes('晚上') || time.includes('晚')) {
        if (spot) schedule.evening.push(spot)
        const food = this.extractFoodFromTitle(title)
        if (food) schedule.eveningFood.push(food)
      }
    })

    return schedule
  }

  // 从标题中提取地点
  static extractSpotFromTitle(title) {
    const patterns = [
      /(?:前往|去|到|参观|游览)([^，。\n]{2,15})/,
      /([^，。\n]{2,15}(：故宫|长城|天安门|颐和园|西湖|黄山|泰山|九寨沟|外滩|豫园|宽窄巷子|锦里|南锣鼓巷))/,
      /([^，。\n]{2,15}(?:景区|景点|公园|广场|古镇|博物馆|美术馆|街道))/,
      /(?:在)([^，。\n]{2,15}(?:餐厅|酒楼|食府|茶馆|咖啡馆|商场))/,
      /([^，。\n]{2,15}(：餐厅|酒楼|食府|茶馆|咖啡馆|商场|烤鸭店))/
    ]

    for (const pattern of patterns) {
      const match = title.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    // 如果没有匹配到，尝试提取关键词
    const keywords = ['故宫', '长城', '天安门', '颐和园', '西湖', '黄山', '泰山', '外滩', '豫园', '宽窄巷子', '锦里', '南锣鼓巷', '烤鸭店']
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        return keyword
      }
    }

    return ''
  }

  // 从标题中提取美食
  static extractFoodFromTitle(title) {
    const patterns = [
      /(?:品尝|享用|吃)([^，。\n]{2,10}(：烤鸭|火锅|拉面|寿司|小笼包|海鲜|川菜|粤菜|本帮菜))/,
      /([^，。\n]{2,10}(：美食|料理|菜肴))/
    ]

    for (const pattern of patterns) {
      const match = title.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    return ''
  }
}

module.exports = { TimeDescriptionHelper }