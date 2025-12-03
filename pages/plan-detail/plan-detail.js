  // 行程详情页面
const Auth = require('../../utils/auth').Auth
const { TimeDescriptionHelper } = require('../../utils/time-description-helper')
// 使用真实的 Supabase 连接（需要配置域名白名单）
const supabase = require('../../utils/supabase').supabase
// const supabase = require('../../utils/supabase-mock').supabase

Page({
  data: {
    // 行程ID
    planId: null,
    // 行程详情
    plan: null,
    // 当前选中的日期（第几天）
    selectedDay: 1,
    // 加载状态
    loading: true,
    // 每日行程数据
    dailyItinerary: [],
    // 每日行程描述
    dailyDescriptions: [],
    // 当前选中的天数的描述
    currentDayDescription: ''
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({ planId: options.id })
    this.loadPlanDetail()
  },

  // 加载行程详情
  async loadPlanDetail() {
    const userId = Auth.getCurrentUserId()
    if (!userId) {
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

    this.setData({ loading: true })

    try {
      console.log('正在查询行程详情:', {
        planId: this.data.planId,
        userId: userId
      })

      const { data: results, error } = await supabase
        .from('travel_plans')
        .select('*')
        .eq('id', this.data.planId)
        .eq('user_id', userId) // 确保只能查看自己的行程

      console.log('查询结果:', { results, error })

      if (error) {
        console.error('数据库查询错误:', error)
        throw error
      }

      const data = results && results.length > 0 ? results[0] : null

      if (!data) {
        console.log('行程不存在')
        wx.showToast({
          title: '行程不存在',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        return
      }

      console.log('成功获取行程数据:', data)
      console.log('原始 itinerary 字段:', data.itinerary)
      console.log('原始 description 字段:', data.description)

      // 优先从 itinerary 字段获取行程内容，如果为空或为占位符，则尝试从 description 字段获取
      let itineraryContent = data.itinerary
      let isItineraryFromDescription = false
      if (!itineraryContent || itineraryContent.trim() === '' || itineraryContent === '暂无详细行程') {
        console.log('itinerary 字段为空或无效，检查 description 字段作为回退。')
        if (data.description && (data.description.includes('Day ') || data.description.includes('天') || data.description.trim().startsWith('{'))) {
          console.log('行程内容为空, 回退到 description 字段')
          itineraryContent = data.description
          isItineraryFromDescription = true
        } else {
          console.log('description 字段不包含有效的行程信息，无法回退。')
        }
      }
      console.log('最终用于解析的 itineraryContent:', itineraryContent)

      // 如果行程内容来自 description，则清理 description，避免重复显示
      const cleanedDescription = isItineraryFromDescription
        ? `AI生成详细行程，共${data.total_days || 1}天`
        : (data.description || '暂无描述')

      // 处理行程数据
      const plan = {
        id: data.id,
        title: data.title || '未命名行程',
        description: cleanedDescription,
        destination: data.destination || '未知目的地',
        startDate: data.start_date,
        endDate: data.end_date,
        totalDays: data.total_days || this.calculateDays(data.start_date, data.end_date),
        travelers: data.travelers_count || 1,
        budget: data.total_budget || 0,
        travelStyle: data.travel_style || 'comfortable',
        status: data.status || 'planned',
        isAIGenerated: data.is_ai_generated || false,
        tags: this.normalizeTags(data.tags),
        transportation: data.transportation || '待定',
        accommodation: data.accommodation || '待定',
        specialRequirements: data.special_requirements || '',
        itinerary: itineraryContent || '暂无详细行程', // 使用最可靠的行程内容
        interests: this.parseInterests(data.interests),
        createdAt: data.created_at,
        image: this.getImageUrl(data.id, data.destination)
      }

      console.log('处理后的行程数据 (plan object):', plan)

      let dailyItinerary = []
      let parsedItinerary = null

      // 优先尝试将行程内容作为JSON解析
      console.log('准备解析行程内容, 检查是否为JSON格式。')
      if (itineraryContent && typeof itineraryContent === 'string' && (itineraryContent.trim().startsWith('{') || itineraryContent.trim().startsWith('['))) {
        console.log('内容看起来像JSON，尝试解析。')
        try {
          parsedItinerary = JSON.parse(itineraryContent)
          console.log('JSON 解析成功:', parsedItinerary)
        } catch (e) {
          console.warn('Itinerary 看起来像JSON但解析失败, 回退到文本解析:', e)
          parsedItinerary = null // 确保解析失败后 parsedItinerary 为 null
        }
      } else {
        console.log('内容不是JSON格式, 将使用文本解析。')
      }

      if (parsedItinerary && (parsedItinerary.days || Array.isArray(parsedItinerary))) {
        console.log('成功解析为JSON对象, 调用 convertJsonToDailyItinerary')
        dailyItinerary = this.convertJsonToDailyItinerary(parsedItinerary, plan.totalDays, plan.startDate)
        console.log('convertJsonToDailyItinerary 返回结果:', dailyItinerary)
      } else {
        console.log('非JSON格式或解析失败, 调用 parseItinerary')
        dailyItinerary = this.parseItinerary(itineraryContent, plan.totalDays)
        console.log('parseItinerary 返回结果:', dailyItinerary)
      }

      console.log('最终生成的每日行程数据 (dailyItinerary):', dailyItinerary)

      // 生成每天独立的行程描述
      const dailyDescriptions = this.generateDailyDescriptions(dailyItinerary, plan)
      const currentDayDescription = dailyDescriptions[this.data.selectedDay - 1] || ''

      this.setData({
        plan,
        dailyItinerary,
        dailyDescriptions,
        currentDayDescription,
        loading: false
      })

      console.log('页面数据设置完成:', {
        plan: plan,
        dailyItinerary: dailyItinerary,
        loading: false
      })

    } catch (error) {
      console.error('加载行程详情失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 解析兴趣偏好
  parseInterests(interests) {
    if (!interests) return []
    if (typeof interests === 'string') {
      try {
        return JSON.parse(interests)
      } catch (e) {
        return []
      }
    }
    return interests
  },

  // 标准化标签
  normalizeTags(tags) {
    if (!tags) return []
    
    let normalizedTags = []
    
    if (typeof tags === 'string') {
      try {
        normalizedTags = JSON.parse(tags)
      } catch (e) {
        // 如果不是JSON，尝试按逗号分割
        normalizedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      }
    } else if (Array.isArray(tags)) {
      normalizedTags = tags
    } else {
      normalizedTags = [tags]
    }
    
    // 过滤空标签并限制数量
    return normalizedTags.filter(tag => tag && typeof tag === 'string').slice(0, 10)
  },

  // 从结构化JSON转换成页面所需的每日行程格式
  convertJsonToDailyItinerary(itineraryObj, totalDays, startDate) {
    const dailyPlans = []
    // 兼容 {days: [...]} 和 [...] 两种格式
    const days = itineraryObj.days || (Array.isArray(itineraryObj) ? itineraryObj : [])

    if (!days || days.length === 0) {
      console.warn('JSON行程中没有 "days" 数组或内容为空')
      // 即使没有内容，也生成空的天数框架
      for (let i = 0; i < totalDays; i++) {
        dailyPlans.push({
          day: i + 1,
          date: this.calculateDate(startDate, i),
          content: '暂无安排',
          activities: []
        })
      }
      return dailyPlans
    }

    for (let i = 0; i < totalDays; i++) {
      const dayNum = i + 1
      const dayData = days.find(d => d.day === dayNum)

      if (dayData && dayData.items && dayData.items.length > 0) {
        const activities = dayData.items.map(item => ({
          time: item.time || '全天',
          title: item.title || '无标题活动',
          location: item.location || '',
          price: item.price || null,
          notes: item.notes || '',
          type: this.getActivityType(item.time, item.title)
        }))

        dailyPlans.push({
          day: dayNum,
          date: this.calculateDate(startDate, i),
          // 从活动反向生成简单的文本内容
          content: activities.map(a => `${a.time}: ${a.title}`).join('\n'),
          activities: activities
        })
      } else {
        // 如果当天没有活动，则提供默认值
        dailyPlans.push({
          day: dayNum,
          date: this.calculateDate(startDate, i),
          content: '暂无安排',
          activities: []
        })
      }
    }
    console.log('JSON行程转换完成, 共', dailyPlans.length, '天')
    return dailyPlans
  },

  // 解析行程为每日安排
  parseItinerary(itinerary, totalDays) {
    if (!itinerary) return []

    const dailyPlans = []
    
    console.log('开始解析行程，总天数:', totalDays)
    console.log('行程内容前500字符:', itinerary.substring(0, 500))
    
    // 增强的解析：支持多种AI格式
    let dayContents = []
    
    // 首先尝试匹配详细格式（Day X - 日期）
    // 修复正则表达式，使其能正确匹配当前数据格式
    const detailDayPattern = /Day\s*(\d+)\s*[-—]\s*([\d]{4}-[\d]{2}-[\d]{2})\s*[:：]\s*([\s\S]*?)(?=Day\s*\d+[-—][\d]{4}-[\d]{2}-[\d]{2}|$)/gi
    let match
    const detailDays = []
    
    // 重置正则表达式
    const newPattern = new RegExp(detailDayPattern.source, detailDayPattern.flags)
    
    while ((match = newPattern.exec(itinerary)) !== null) {
      const dayData = {
        dayNum: parseInt(match[1]),
        date: match[2].trim(),
        content: match[3].trim()
      }
      detailDays.push(dayData)
      console.log('解析到Day ' + dayData.dayNum + ':', dayData.date, '内容长度:', dayData.content.length)
    }
    
    console.log('详细格式解析结果:', detailDays.length, '天')
    
    if (detailDays.length > 0) {
      // 使用详细格式的数据
      dayContents = detailDays
    } else {
      // 尝试简化的Day格式（没有日期）
      const simpleDayPattern = /Day\s*(\d+)\s*[:：]\s*([\s\S]*?)(?=Day\s*\d+[:：]|$)/gi
      const simplePattern = new RegExp(simpleDayPattern.source, simpleDayPattern.flags)
      
      while ((match = simplePattern.exec(itinerary)) !== null) {
        const dayData = {
          dayNum: parseInt(match[1]),
          date: '',
          content: match[2].trim()
        }
        dayContents.push(dayData)
        console.log('简化格式解析到Day ' + dayData.dayNum + '，内容长度:', dayData.content.length)
      }
      
      // 如果还是没有，尝试中文格式（第X天）
      if (dayContents.length === 0) {
        const chineseDayPattern = /第([一二三四五六七八九十\d]+)天[\s:：]([\s\S]*?)(?=第[一二三四五六七八九十\d]+天|$)/gi
        const chinesePattern = new RegExp(chineseDayPattern.source, chineseDayPattern.flags)
        
        while ((match = chinesePattern.exec(itinerary)) !== null) {
          const dayNum = this.chineseToNumber(match[1])
          const dayData = {
            dayNum: dayNum,
            date: '',
            content: match[2].trim()
          }
          dayContents.push(dayData)
          console.log('解析到第' + dayNum + '天，内容长度:', dayData.content.length)
        }
      }
      
      // 如果还是没有，尝试按每个"Day"分割
      if (dayContents.length === 0) {
        const daySections = itinerary.split(/Day\s*\d+/gi)
        // 过滤掉空的部分
        const validSections = daySections.filter((section, index) => {
          // 第一个部分可能是开头的介绍，不是具体行程
          if (index === 0 && section.length > 0 && !section.includes('上午') && !section.includes('下午') && !section.includes('晚上')) {
            return false
          }
          return section.trim().length > 10 // 只保留有实际内容的部分
        })
        
        validSections.forEach((section, index) => {
          const dayNum = index + 1
          const dayData = {
            dayNum: dayNum,
            date: '',
            content: section.trim()
          }
          dayContents.push(dayData)
          console.log('按分割解析到第' + dayNum + '天，内容长度:', section.length)
        })
      }
    }
    
    console.log('最终解析结果:', dayContents.length, '天数据')

    // 确保有足够的天数
    for (let i = 0; i < totalDays; i++) {
      const dayNum = i + 1
      let dayData = dayContents.find(d => d.dayNum === dayNum)
      let content = ''
      let date = ''
      
      if (dayData) {
        content = dayData.content
        date = dayData.date || this.calculateDate(this.data.plan?.startDate, i)
      } else {
        // 尝试从备用数组获取
        if (dayContents[i]) {
          content = dayContents[i].content
          date = dayContents[i].date || this.calculateDate(this.data.plan?.startDate, i)
        } else {
          content = '暂无安排'
          date = this.calculateDate(this.data.plan?.startDate, i)
        }
      }

      // 提取活动项
      const activities = this.extractActivities(content)

      dailyPlans.push({
        day: dayNum,
        date: date,
        content: content,
        activities: activities
      })
      
      console.log(`第${dayNum}天解析完成:`, {
        hasContent: content.length > 0,
        hasActivities: activities.length > 0,
        activityCount: activities.length,
        contentLength: content.length
      })
    }

    console.log('parseItinerary完成，返回数据:', dailyPlans)
    return dailyPlans
  },

  // 提取活动项
  extractActivities(content) {
    const activities = []
    
    console.log('开始提取活动，内容前200字符:', content.substring(0, 200))
    
    // 根据当前数据格式的特点，定制化的解析模式
    const timePatterns = [
      // 匹配时间段模式：🌅 上午 (8:00-12:00)：[内容]
      /🌅☀️🌙?\s*(上午|下午|晚上)\s*[\(（](\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})[\)）][\s:：]*([^\n]+)/g,
      // 匹配emoji + 时间段：🌅 上午 (8:00-12:00)：
      /[🌅☀️🌙]\s*(上午|下午|晚上)\s*[\(（](\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})[\)）][\s:：]*([^\n]+)/g,
      // 匹配具体时间点：8:00-10:00：[内容]
      /(\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})[\s:：]*([^\n]+)/g,
      // 匹配时间段：上午 (8:00-12:00)：[内容]
      /(上午|下午|晚上)\s*[\(（](\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})[\)）][\s:：]*([^\n]+)/g,
      // 匹配简单时间段：上午、下午、晚上 + 内容
      /(早餐|午餐|晚餐|上午|下午|晚上)[\s:：]*([^\n]+)/g,
      // 匹配破折号分隔的活动：- [内容]（门票：[价格]）
      /-\s*([^：\n]+)(?:[:：]\s*([^：\n]+))?/g
    ]
    
    // 先尝试匹配最精确的模式
    for (let patternIndex = 0; patternIndex < timePatterns.length; patternIndex++) {
      const pattern = timePatterns[patternIndex]
      let match
      const newPattern = new RegExp(pattern.source, pattern.flags)
      
      console.log(`尝试模式 ${patternIndex + 1}:`, pattern.source.substring(0, 50) + '...')
      
      while ((match = newPattern.exec(content)) !== null) {
        let time = ''
        let title = ''
        let price = null
        
        // 根据不同的匹配模式解析
        if (match.length >= 5) {
          // 时间段格式 (上午/下午/晚上 + 具体时间)
          time = match[1] + ' (' + match[2] + '-' + match[3] + ')'
          title = match[4] || ''
        } else if (match.length >= 4 && match[1].includes(':')) {
          // 具体时间格式
          time = match[1] + (match[2] ? '-' + match[2] : '')
          title = match[3] || match[2] || ''
        } else if (match.length >= 3) {
          // 简单格式
          time = match[1]
          title = match[2] || ''
        } else {
          continue
        }
        
        // 清理和验证标题
        title = title.trim()
          .replace(/^[-:\s：]+/, '') // 移除开头的符号
          .replace(/^\([^)]*\)\s*/, '') // 移除开头的括号内容
          .replace(/门票[：:]\s*\d+元[\/]?人?/, '') // 移除门票价格信息
          .replace(/预估人均消费[：:]\s*\d+元/, '') // 移除消费信息
          .trim()
        
        // 提取价格
        price = this.extractPrice(title)
        
        // 跳过无效或重复的活动
        if (title && title.length > 3 && 
            !title.includes('费用') && 
            !title.includes('总计') && 
            !title.includes('交通') &&
            !title.includes('住宿') &&
            !title.match(/^(打车|公交车)/)) {
          
          const activity = {
            time: time,
            title: title.substring(0, 80),
            location: this.extractLocation(title),
            price: price,
            type: this.getActivityType(time, title)
          }
          
          // 避免重复添加相同的活动
          const isDuplicate = activities.some(existing => 
            existing.title === activity.title && existing.time === activity.time
          )
          
          if (!isDuplicate) {
            activities.push(activity)
            console.log('添加活动:', { time: activity.time, title: activity.title.substring(0, 30) })
          }
        }
      }
      
      // 如果找到了活动，就不再尝试其他模式
      if (activities.length > 0) {
        console.log(`模式 ${patternIndex + 1} 成功匹配到 ${activities.length} 个活动`)
        break
      }
    }

    // 如果还是没有找到足够的活动，按行智能分割
    if (activities.length < 3) {
      console.log('活动数量不足，尝试按行分割')
      const lines = content.split('\n').filter(l => l.trim())
      
      lines.forEach(line => {
        const trimmedLine = line.trim()
        
        // 跳过标题行和费用行
        if (trimmedLine && 
            !trimmedLine.match(/^(🌅|☀️|🌙|第|Day|费用|总计|交通|住宿|餐饮|📍|📅|👥|💰|🎯|📋|🚗|🏨|⚠️)/) &&
            trimmedLine.length > 5) {
          
          // 查找时间信息
          let time = '全天'
          const timeMatch = trimmedLine.match(/(\d{1,2}[:：]\d{2})|(\d{1,2}[:：]\d{2}\s*[-–—]\s*\d{1,2}[:：]\d{2})/)
          if (timeMatch) {
            time = timeMatch[0]
          }
          
          // 查找地点信息
          const location = this.extractLocation(trimmedLine)
          
          // 查找价格信息
          const price = this.extractPrice(trimmedLine)
          
          // 清理标题
          let title = trimmedLine
            .replace(/^[：:\s-]+/, '')
            .replace(/门票[：:]\s*\d+元[\/]?人?/, '')
            .replace(/预估人均消费[：:]\s*\d+元/, '')
            .trim()
          
          if (title.length > 3) {
            const activity = {
              time: time,
              title: title.substring(0, 80),
              location: location,
              price: price,
              type: this.getActivityType(time, title)
            }
            
            // 避免重复
            const isDuplicate = activities.some(existing => 
              existing.title === activity.title
            )
            
            if (!isDuplicate) {
              activities.push(activity)
            }
          }
        }
      })
    }

    console.log('最终提取到活动数量:', activities.length)
    activities.forEach((activity, index) => {
      console.log(`活动${index + 1}:`, {
        time: activity.time,
        title: activity.title.substring(0, 30),
        location: activity.location,
        price: activity.price
      })
    })

    return activities
  },

  // 获取活动类型
  getActivityType(time, title) {
    if (title.includes('餐') || title.includes('吃') || title.includes('美食')) return 'dining'
    if (title.includes('住') || title.includes('酒店') || title.includes('民宿')) return 'accommodation'
    if (title.includes('车') || title.includes('飞机') || title.includes('高铁')) return 'transport'
    if (title.includes('景点') || title.includes('参观') || title.includes('游览')) return 'sightseeing'
    if (title.includes('买') || title.includes('购') || title.includes('商场')) return 'shopping'
    return 'activity'
  },

  // 提取地点
  extractLocation(text) {
    const match = text.match(/(?:在|到|前往|参观|游览)\s*([^，.\n]+)/)
    return match ? match[1].trim() : ''
  },

  // 提取价格
  extractPrice(text) {
    const match = text.match(/[¥￥](\d+)/)
    return match ? match[1] : null
  },

  // 计算日期
  calculateDate(startDate, dayOffset) {
    if (!startDate) return ''
    const date = new Date(startDate)
    date.setDate(date.getDate() + dayOffset)
    return `${date.getMonth() + 1}/${date.getDate()}`
  },

  // 中文数字转换
  chineseToNumber(chinese) {
    const numbers = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15
    }
    
    // 直接匹配
    if (numbers[chinese]) {
      return numbers[chinese]
    }
    
    // 组合数字（如：二十三）
    if (chinese.includes('二十')) {
      return 20 + (numbers[chinese.replace('二十', '')] || 0)
    }
    
    if (chinese.includes('三十')) {
      return 30 + (numbers[chinese.replace('三十', '')] || 0)
    }
    
    // 尝试提取阿拉伯数字
    const match = chinese.match(/\d+/)
    return match ? parseInt(match[0]) : 1
  },

  // 计算天数
  calculateDays(startDate, endDate) {
    if (!startDate || !endDate) return 1
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  },

  // 获取图片URL
  getImageUrl(id, destination) {
    return `https://picsum.photos/seed/${destination || id}/800/400.jpg`
  },

  // 生成每天独立的行程描述
  generateDailyDescriptions(dailyItinerary, plan) {
    const descriptions = []
    
    dailyItinerary.forEach((dayData, index) => {
      const dayNum = index + 1
      
      // 首先尝试从解析出的活动生成描述
      if (dayData.activities && dayData.activities.length > 0) {
        // 为每一天生成结构化的数据供 TimeDescriptionHelper 使用
        const structuredDayData = {
          day: dayNum,
          items: dayData.activities.map(activity => ({
            time: activity.time,
            title: activity.title,
            location: activity.location || activity.title,
            notes: ''
          }))
        }
        
        // 生成当天的独立描述
        const dayDescription = TimeDescriptionHelper.generateDayDescription([structuredDayData], 1)
        descriptions.push(dayDescription)
      } else if (dayData.content && dayData.content.trim()) {
        // 如果没有解析出活动，但有原始内容，直接从内容生成描述
        const dayDescription = this.generateDescriptionFromContent(dayData.content, dayNum)
        descriptions.push(dayDescription)
      } else {
        // 默认描述
        descriptions.push(this.getDefaultDayDescription(dayNum, plan.destination))
      }
    })
    
    return descriptions
  },

  // 从原始内容生成行程描述
  generateDescriptionFromContent(content, dayNum) {
    const description = []
    
    // 多种模式提取时间段活动
    const timePatterns = [
      // 模式1：🌅 上午 (8:00-12:00)：[内容]
      {
        emoji: '🌅',
        period: '上午',
        pattern: /🌅.*?上午[^:：]*[:：]\s*([^\n☀️🌙]+)/i
      },
      // 模式2：🍽️ 中午 (12:00-13:00)：[内容]
      {
        emoji: '🍽️',
        period: '中午',
        pattern: /🍽️.*?中午[^:：]*[:：]\s*([^\n☀️🌙]+)/i
      },
      // 模式3：☀️ 下午 (13:00-17:00)：[内容]
      {
        emoji: '☀️',
        period: '下午',
        pattern: /☀️.*?下午[^:：]*[:：]\s*([^\n🌙]+)/i
      },
      // 模式4：🌙 晚上 (18:00-22:00)：[内容]
      {
        emoji: '🌙',
        period: '晚上',
        pattern: /🌙.*?晚上[^:：]*[:：]\s*([^\n]+)/i
      },
      // 模式5：简单的上午、中午、下午、晚上匹配
      {
        emoji: '🌅',
        period: '上午',
        pattern: /上午[^:：]*[:：]\s*([^\n]+)/i
      },
      {
        emoji: '🍽️',
        period: '中午',
        pattern: /中午[^:：]*[:：]\s*([^\n]+)/i
      },
      {
        emoji: '☀️',
        period: '下午',
        pattern: /下午[^:：]*[:：]\s*([^\n]+)/i
      },
      {
        emoji: '🌙',
        period: '晚上',
        pattern: /晚上[^:：]*[:：]\s*([^\n]+)/i
      }
    ]
    
    // 尝试匹配各种模式
    const extractedActivities = {}
    
    timePatterns.forEach(({ emoji, period, pattern }) => {
      const match = content.match(pattern)
      if (match && match[1]) {
        const activity = match[1].trim()
        if (activity && activity.length > 3 && !extractedActivities[period]) {
          // 清理活动描述
          const cleanedActivity = activity
            .replace(/[()（）][\d:：\s-]*[）)]/, '') // 移除时间括号
            .replace(/^(抵达|入住|休息)/, '') // 移除常见的前缀
            .trim()
          
          if (cleanedActivity.length > 0) {
            extractedActivities[period] = {
              emoji,
              text: cleanedActivity.substring(0, 60) + (cleanedActivity.length > 60 ? '...' : '')
            }
          }
        }
      }
    })
    
    // 按时间段顺序构建描述
    const periodOrder = ['上午', '中午', '下午', '晚上']
    periodOrder.forEach(period => {
      if (extractedActivities[period]) {
        const { emoji, text } = extractedActivities[period]
        description.push(`${emoji} ${period}：${text}`)
      }
    })
    
    // 如果没有提取到时间段信息，尝试其他方式
    if (description.length === 0) {
      // 尝试提取活动关键词
      const activities = this.extractActivitiesFromContent(content)
      if (activities.length > 0) {
        description.push(`🎯 今日亮点：${activities.slice(0, 3).join('、')}`)
      } else {
        // 尝试按行提取有意义的内容
        const lines = content.split('\n').filter(line => {
          const trimmed = line.trim()
          return trimmed.length > 10 && 
                 !trimmed.match(/^(第|Day|费用|总计|交通|住宿|餐饮|📍|📅|👥|💰|🎯|📋)/)
        })
        
        if (lines.length > 0) {
          // 提取前2行有意义的描述
          lines.slice(0, 2).forEach(line => {
            const cleaned = line.trim()
              .replace(/^[-•·]\s*/, '') // 移除列表符号
              .replace(/[:：]\s*$/, '') // 移除末尾冒号
              .trim()
            
            if (cleaned.length > 5) {
              description.push(`📝 ${cleaned.substring(0, 60)}${cleaned.length > 60 ? '...' : ''}`)
            }
          })
        }
      }
    }
    
    // 如果还是为空，使用默认描述
    if (description.length === 0) {
      description.push(`🗓️ 第${dayNum}天：精彩行程安排，让您的旅行充实而难忘。`)
    }
    
    return description.join('\n\n')
  },

  // 从内容中提取活动
  extractActivitiesFromContent(content) {
    const activities = []
    
    // 扩展的景点和活动关键词库
    const attractions = {
      // 北京
      '北京': ['故宫博物院', '天安门广场', '长城', '颐和园', '天坛', '北海公园', '景山公园', '什刹海', '鸟巢', '水立方', '南锣鼓巷', '王府井'],
      // 上海  
      '上海': ['外滩', '东方明珠塔', '豫园', '南京路步行街', '城隍庙', '田子坊', '新天地', '淮海路'],
      // 杭州
      '杭州': ['西湖', '灵隐寺', '雷峰塔', '断桥', '苏堤', '三潭印月', '宋城', '河坊街'],
      // 三亚
      '三亚': ['天涯海角', '亚龙湾', '大东海', '三亚湾', '南山文化旅游区', '蜈支洲岛'],
      // 西安
      '西安': ['兵马俑', '大雁塔', '古城墙', '回民街', '钟楼', '鼓楼', '华清池', '大唐芙蓉园'],
      // 成都
      '成都': ['宽窄巷子', '锦里', '武侯祠', '杜甫草堂', '青羊宫', '都江堰', '熊猫基地'],
      // 其他通用
      '通用': ['博物馆', '古镇', '公园', '广场', '寺庙', '教堂', '沙滩', '山峰', '湖泊', '瀑布', '峡谷']
    }
    
    // 首先尝试匹配特定城市的景点
    let cityMatched = false
    for (const [city, places] of Object.entries(attractions)) {
      if (city !== '通用' && (content.includes(city) || this.detectCityFromContent(content) === city)) {
        places.forEach(place => {
          if (content.includes(place)) {
            activities.push(place)
          }
        })
        cityMatched = true
        break
      }
    }
    
    // 如果没有匹配到特定城市，尝试通用景点
    if (!cityMatched) {
      attractions['通用'].forEach(place => {
        // 使用更灵活的匹配
        const patterns = [
          new RegExp(place + '(?:景区|景点|公园|博物馆)', 'i'),
          new RegExp('(?:参观|游览|前往|去到)' + place, 'i')
        ]
        
        for (const pattern of patterns) {
          if (content.match(pattern)) {
            activities.push(place)
            break
          }
        }
      })
    }
    
    // 尝试多种模式提取活动
    const extractPatterns = [
      // 参观/游览/前往模式
      /(?:参观|游览|前往|去到|探访|寻访)([^，。；\n]{2,20})/g,
      // 在...活动模式
      /(?:在|于)([^，。；\n]{2,20})(?:参观|游玩|体验|欣赏|品尝)/g,
      // 包含景点关键词的活动
      /([^，。；\n]{2,20})(?:景区|景点|公园|广场|寺庙|博物馆|古镇|街道|市场)/g,
      // 美食相关活动
      /(?:品尝|享用|体验)([^，。；\n]{2,20})(?:美食|料理|菜肴|小吃|特色菜)/g,
      // 简单的景点名称模式（以地名结尾）
      /([^，。；\n]{2,15})(?:山|寺|宫|园|楼|塔|阁|殿|庙|观|湖|海|湾|岛|街|巷|场)/g
    ]
    
    extractPatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const cleaned = match
            .replace(/^(?:参观|游览|前往|去到|探访|寻访|在|于|品尝|享用|体验)/, '')
            .replace(/(?:景区|景点|公园|广场|寺庙|博物馆|古镇|街道|市场|美食|料理|菜肴|小吃|特色菜)$/, '')
            .trim()
          
          if (cleaned.length >= 2 && cleaned.length <= 15 && !activities.includes(cleaned)) {
            activities.push(cleaned)
          }
        })
      }
    })
    
    // 去重并限制数量
    const uniqueActivities = [...new Set(activities)]
    
    // 按重要性排序（知名景点优先）
    const priorityAttractions = ['故宫', '长城', '西湖', '外滩', '兵马俑', '宽窄巷子', '锦里']
    const sorted = uniqueActivities.sort((a, b) => {
      const aPriority = priorityAttractions.some(p => a.includes(p)) ? 0 : 1
      const bPriority = priorityAttractions.some(p => b.includes(p)) ? 0 : 1
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      return a.localeCompare(b, 'zh-CN')
    })
    
    return sorted.slice(0, 6) // 最多返回6个活动
  },

  // 从内容中检测城市
  detectCityFromContent(content) {
    const cityPatterns = [
      { city: '北京', pattern: /北京|京市|故宫|天安门|长城/ },
      { city: '上海', pattern: /上海|沪市|外滩|东方明珠/ },
      { city: '杭州', pattern: /杭州|杭州市|西湖|灵隐寺/ },
      { city: '三亚', pattern: /三亚|亚龙湾|天涯海角/ },
      { city: '西安', pattern: /西安|长安|兵马俑|大雁塔/ },
      { city: '成都', pattern: /成都|蓉市|宽窄巷子|锦里/ }
    ]
    
    for (const { city, pattern } of cityPatterns) {
      if (content.match(pattern)) {
        return city
      }
    }
    
    return null
  },

  // 获取默认的每日描述
  getDefaultDayDescription(dayNum, destination) {
    const defaultDescriptions = {
      1: `🌅 上午：抵达${destination}，入住酒店稍作休息\n\n🍽️ 中午：品尝当地特色美食\n\n☀️ 下午：游览${destination}著名景点\n\n🌙 晚上：体验当地夜生活，感受城市魅力`,
      2: `🌅 上午：深度游览${destination}核心景区\n\n🍽️ 中午：在景区附近享用特色午餐\n\n☀️ 下午：参观历史文化景点\n\n🌙 晚上：品尝地道小吃，购买纪念品`,
      3: `🌅 上午：自由活动或购物\n\n🍽️ 中午：享用最后一顿当地美食\n\n☀️ 下午：整理行装，准备返程\n\n🌙 晚上：结束愉快的${destination}之旅`
    }
    
    return defaultDescriptions[dayNum] || `第${dayNum}天的精彩行程安排，让您的旅行充实而难忘。`
  },

  // 切换日期
  selectDay(e) {
    const day = parseInt(e.currentTarget.dataset.day)
    const currentDayDescription = this.data.dailyDescriptions[day - 1] || ''
    
    this.setData({ 
      selectedDay: day,
      currentDayDescription: currentDayDescription
    })
  },

  // 添加活动
  addActivity() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 高德地图导航
  navigateToMap() {
    if (!this.data.plan?.destination) {
      wx.showToast({
        title: '暂无目的地信息',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 分享行程
  sharePlan() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    
    wx.showToast({
      title: '点击右上角分享',
      icon: 'none'
    })
  },

  // 复制行程
  async duplicatePlan() {
    wx.showModal({
      title: '复制行程',
      content: '确定要复制这个行程吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '复制中...' })

          try {
            const userId = Auth.getCurrentUserId()
            const plan = this.data.plan
            
            // 创建新行程（不包含id和created_at）
            const newPlan = {
              user_id: userId,
              title: `${plan.title} (副本)`,
              description: plan.description,
              destination: plan.destination,
              start_date: plan.startDate,
              end_date: plan.endDate,
              total_days: plan.totalDays,
              travelers_count: plan.travelers,
              total_budget: plan.budget,
              travel_style: plan.travelStyle,
              interests: plan.interests,
              itinerary: plan.itinerary,
              is_ai_generated: false, // 复制的行程标记为手动创建
              status: 'planned',
              tags: plan.tags,
              transportation: plan.transportation,
              accommodation: plan.accommodation,
              special_requirements: plan.specialRequirements
            }

            const { data, error } = await supabase
              .from('travel_plans')
              .insert(newPlan)
              .select()

            wx.hideLoading()

            if (error) throw error

            wx.showModal({
              title: '复制成功',
              content: '是否要查看新复制的行程？',
              success: (modalRes) => {
                if (modalRes.confirm && data && data[0]) {
                  // 跳转到新行程的详情页
                  wx.redirectTo({
                    url: `/pages/plan-detail/plan-detail?id=${data[0].id}`
                  })
                } else {
                  // 返回列表页
                  wx.navigateBack()
                }
              }
            })

          } catch (error) {
            wx.hideLoading()
            console.error('复制行程失败:', error)
            wx.showToast({
              title: '复制失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 显示地图视图
  showMapView() {
    const plan = this.data.plan
    if (!plan) return

    wx.navigateTo({
      url: `/pages/map-view/map-view?planId=${plan.id}&destination=${encodeURIComponent(plan.destination)}`
    })
  },

  // 更改状态
  changeStatus() {
    const statusOptions = [
      { value: 'planned', label: '计划中' },
      { value: 'ongoing', label: '进行中' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' }
    ]

    const currentStatus = this.data.plan.status
    const itemList = statusOptions.map(item => 
      item.value === currentStatus ? `✓ ${item.label}` : item.label
    )
    
    wx.showActionSheet({
      itemList: itemList,
      success: async (res) => {
        const newStatus = statusOptions[res.tapIndex].value
        
        if (newStatus === currentStatus) {
          return
        }

        try {
          const { error } = await supabase
            .from('travel_plans')
            .update({ status: newStatus })
            .eq('id', this.data.planId)

          if (error) throw error

          wx.showToast({
            title: '状态已更新',
            icon: 'success'
          })

          // 重新加载行程详情
          this.loadPlanDetail()

        } catch (error) {
          console.error('更新状态失败:', error)
          wx.showToast({
            title: '更新失败',
            icon: 'none'
          })
        }
      }
    })
  },

  // 更多操作
  showMoreActions() {
    const itemList = ['复制行程', '更改状态', '导出行程', '分享行程']
    
    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            // 复制行程
            this.duplicatePlan()
            break
          case 1:
            // 更改状态
            this.changeStatus()
            break
          case 2:
            // 导出行程
            this.exportPlan()
            break
          case 3:
            // 分享行程
            this.sharePlan()
            break
        }
      }
    })
  },

  // 导出行程
  exportPlan() {
    const plan = this.data.plan
    let content = `【${plan.title}】

`
    content += `📍 目的地：${plan.destination}
`
    content += `📅 日期：${plan.startDate} 至 ${plan.endDate} (${plan.totalDays}天)
`
    content += `👥 人数：${plan.travelers}人
`
    content += `💰 预算：¥${plan.budget}

`
    
    if (plan.description) {
      content += `📝 描述：${plan.description}

`
    }
    
    // 添加每日行程
    if (this.data.dailyItinerary && this.data.dailyItinerary.length > 0) {
      content += `📋 行程安排：

`
      this.data.dailyItinerary.forEach(day => {
        content += `第${day.day}天 (${day.date})：
${day.content}

`
      })
    }
    
    // 复制到剪贴板
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  },

  // 编辑行程
  editPlan() {
    wx.navigateTo({
      url: `/pages/create-plan/create-plan?id=${this.data.planId}`
    })
  },

  // 删除行程
  deletePlan() {
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${this.data.plan?.title}"吗？`,
      confirmColor: '#FF6B6B',
      success: async (res) => {
        if (res.confirm) {
          try {
            const { error } = await supabase
              .from('travel_plans')
              .delete()
              .eq('id', this.data.planId)

            if (error) throw error

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })

            setTimeout(() => {
              wx.navigateBack()
            }, 1500)

          } catch (error) {
            console.error('删除失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 获取旅行风格文本
  getTravelStyleText(style) {
    const styleMap = {
      'luxury': '轻奢型',
      'comfortable': '舒适享受',
      'premium': '奢华体验',
      'budget': '经济实惠',
      'adventure': '探险刺激'
    }
    return styleMap[style] || '舒适享受'
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'planned': '计划中',
      'ongoing': '进行中',
      'completed': '已完成',
      'cancelled': '已取消'
    }
    return statusMap[status] || '未知'
  },

  // 返回上一页
  navigateBack() {
    wx.navigateBack()
  },

  // 获取当前天数的数据（供 WXML 使用）
  getCurrentDayData() {
    const dayIndex = this.data.selectedDay - 1
    return this.data.dailyItinerary[dayIndex] || null
  },

  // 测试解析功能（开发调试时使用）
  testParseItinerary() {
    if (!this.data.plan?.itinerary) {
      console.log('没有行程数据可以测试')
      return
    }
    
    console.log('=== 开始测试行程解析 ===')
    console.log('原始行程长度:', this.data.plan.itinerary.length)
    
    const testResult = this.parseItinerary(this.data.plan.itinerary, this.data.plan.totalDays)
    
    console.log('=== 解析结果 ===')
    console.log('解析出的天数:', testResult.length)
    
    testResult.forEach((day, index) => {
      console.log(`--- 第${index + 1}天 ---`)
      console.log('日期:', day.date)
      console.log('内容长度:', day.content.length)
      console.log('活动数量:', day.activities.length)
      
      day.activities.forEach((activity, actIndex) => {
        console.log(`  活动${actIndex + 1}:`, {
          time: activity.time,
          title: activity.title.substring(0, 30),
          location: activity.location,
          price: activity.price,
          type: activity.type
        })
      })
    })
    
    console.log('=== 测试完成 ===')
  }
})