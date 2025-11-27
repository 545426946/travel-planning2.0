// utils/ai-integration.js - AI 集成工具类（简化版）
const aiService = require('./ai-service').aiService
const db = require('./database').db
// 使用真实的 Supabase 连接（需要配置域名白名单）
const supabase = require('./supabase').supabase
// const supabase = require('./supabase-mock').supabase
const { TimeDescriptionHelper } = require('./time-description-helper')

class AIIntegration {
  // 智能行程规划
  async planIntelligentItinerary(userId, userInput, formData = {}, saveToDatabase = true) {
    try {
      // 获取用户偏好
      const preferencesResult = await db.userPreferences.getByUserId(userId)
      const preferences = preferencesResult.data
      
      // 生成行程计划
      const aiResponse = await aiService.generateTravelPlan(userInput, preferences || {})
      
      // 解析AI响应（传入用户表单数据）
      const planData = this.parseAIResponseToPlan(aiResponse, userId, formData)
      
      if (saveToDatabase && planData) {
        // 保存到数据库
        const result = await db.travelPlans.create({
          user_id: userId,
          title: planData.title,
          description: planData.description,
          destination: planData.destination,
          start_date: planData.startDate,
          end_date: planData.endDate,
          total_budget: planData.budget,
          total_days: planData.totalDays,
          travelers_count: planData.travelersCount,
          travel_style: planData.travelStyle,
          interests: planData.interests,
          itinerary: planData.itinerary,
          is_ai_generated: true,
          status: 'planned',
          tags: planData.tags,
          transportation: planData.transportation,
          accommodation: planData.accommodation,
          special_requirements: planData.specialRequirements
        })
        
        return { success: true, data: result.data, aiResponse, planData }
      } else if (planData) {
        // 仅返回规划数据，不保存
        return { success: true, planData, aiResponse }
      }
      
      return { success: false, aiResponse }
    } catch (error) {
      console.error('智能行程规划失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 仅保存行程（不重新生成）
  async savePlanOnly(userId, planData) {
    try {
      if (!planData) {
        return { success: false, error: '没有可保存的行程数据' }
      }

      console.log('开始保存行程数据:', planData.title)

      let itineraryObj = null
      if (planData && typeof planData.itinerary === 'string') {
        const parsed = this.extractJSONFromText(planData.itinerary)
        if (parsed && (parsed.days || Array.isArray(parsed))) {
          itineraryObj = Array.isArray(parsed) ? { days: parsed } : parsed
        }
      } else if (planData && typeof planData.itinerary === 'object') {
        itineraryObj = planData.itinerary
      }

      const payload = {
        user_id: userId,
        title: planData.title,
        description: itineraryObj ? this.summarizeItinerary(itineraryObj, planData.totalDays) : (planData.description || ''),
        destination: planData.destination,
        start_date: planData.startDate,
        end_date: planData.endDate,
        total_budget: planData.budget || 0,
        total_days: planData.totalDays || 1,
        travelers_count: planData.travelersCount || 1,
        travel_style: planData.travelStyle || 'comfortable',
        interests: Array.isArray(planData.interests) ? planData.interests : JSON.parse(planData.interests || '[]'),
        itinerary: itineraryObj ? JSON.stringify(itineraryObj) : (planData.itinerary || ''),
        is_ai_generated: true,
        status: 'planned',
        tags: Array.isArray(planData.tags) ? planData.tags : (planData.tags ? planData.tags.split(',') : []),
        transportation: planData.transportation || '',
        accommodation: planData.accommodation || '',
        special_requirements: planData.specialRequirements || ''
      }
      
      const result = await db.travelPlans.create(payload)

      if (result.error && !result.isExisting) {
        throw new Error(result.error.message || '保存失败')
      }

      if (result.isExisting) {
        console.log('行程已存在，返回现有数据:', result.data.id)
        return {
          success: true,
          data: result.data,
          message: '重复行程已存在，未重复保存'
        }
      }

      console.log('行程保存成功:', result.data)
      
      return {
        success: true,
        data: result.data,
        message: '行程保存成功'
      }
    } catch (error) {
      console.error('保存行程失败:', error)
      return { 
        success: false, 
        error: error.message || '保存行程时出现错误'
      }
    }
  }

  // 解析AI行程响应
  parseAIResponseToPlan(aiResponse, userId, formData = {}) {
    try {
      let parsedJSON = null
      if (typeof aiResponse === 'string') {
        parsedJSON = this.extractJSONFromText(aiResponse)
      } else if (typeof aiResponse === 'object') {
        parsedJSON = aiResponse
      }
      
      // 从用户表单数据中提取基础信息
      const destination = formData.destination || this.extractDestination(aiResponse)
      const budget = formData.budget || this.extractBudget(aiResponse)
      const days = formData.days || '3天'
      const travelers = formData.travelers || 1
      const style = formData.style || 'comfortable'
      const interests = formData.interests || []
      const specialRequirements = formData.specialRequirements || ''
      
      // 计算总天数
      const totalDays = parseInt(days) || 3
      
      // 计算日期范围（从今天开始）
      const today = new Date()
      const startDate = today.toISOString().split('T')[0]
      const endDate = new Date(today.getTime() + (totalDays - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      // 生成标题
      const title = `${destination}${days}游 - AI智能规划`
      
      // 生成描述（使用新的时间地点描述）
      const description = parsedJSON ? this.summarizeItinerary(parsedJSON.itinerary || parsedJSON, totalDays) : aiResponse.substring(0, 200).replace(/\n/g, ' ')
      
      // 提取标签
      const tags = this.extractTags(aiResponse)
      // 添加兴趣标签
      if (Array.isArray(interests)) {
        tags.push(...interests.map(i => i.label || i))
      }
      // 添加风格标签
      const styleMap = {
        luxury: '轻奢型',
        comfortable: '舒适享受',
        premium: '奢华体验'
      }
      if (styleMap[style]) {
        tags.push(styleMap[style])
      }
      
      // 将AI响应规范化为结构化JSON
      let normalizedItinerary = null
      if (parsedJSON && (parsedJSON.itinerary || parsedJSON.days)) {
        const obj = parsedJSON.itinerary || parsedJSON
        normalizedItinerary = obj.days ? obj : { days: obj }
      } else {
        normalizedItinerary = this.normalizeItinerary(aiResponse, totalDays, startDate)
      }

      return {
        title: title,
        description: description,
        destination: destination,
        startDate: startDate,
        endDate: endDate,
        budget: parseFloat(budget) || 0,
        totalDays: totalDays,
        travelersCount: parseInt(travelers) || 1,
        travelStyle: style,
        interests: Array.isArray(interests) ? JSON.stringify(interests) : interests,
        itinerary: JSON.stringify(normalizedItinerary),
        tags: tags,
        transportation: this.extractTransportation(aiResponse),
        accommodation: this.extractAccommodation(aiResponse),
        specialRequirements: specialRequirements
      }
    } catch (error) {
      console.error('解析AI响应失败:', error)
      return null
    }
  }

  // 生成时间地点描述
  summarizeItinerary(itineraryObj, totalDays) {
    const d = itineraryObj && itineraryObj.days ? itineraryObj.days : []
    const days = totalDays || d.length || 1
    
    if (!d || d.length === 0) {
      return `AI为您精心规划了${days}天的详细行程，包含每天的具体安排和实用建议。`
    }

    // 使用时间地点描述生成器
    try {
      return TimeDescriptionHelper.generateDescription(d)
    } catch (error) {
      console.warn('时间地点描述生成失败:', error)
      // 返回简单描述
      return `AI为您精心规划的${days}天行程，包含丰富的景点游览和美食体验，让您的旅程精彩难忘。`
    }
  }

  // 提取JSON
  extractJSONFromText(text) {
    if (!text) return null
    const s = String(text).trim()
    const fenceMatch = s.match(/```json\s*([\s\S]*?)\s*```/i)
    const raw = fenceMatch ? fenceMatch[1] : s
    const firstBrace = raw.indexOf('{')
    const firstBracket = raw.indexOf('[')
    let candidate = raw
    if (firstBrace >= 0 || firstBracket >= 0) {
      const start = Math.min(firstBrace >= 0 ? firstBrace : Infinity, firstBracket >= 0 ? firstBracket : Infinity)
      candidate = raw.slice(start)
    }
    try {
      const obj = JSON.parse(candidate)
      return obj
    } catch (e) {
      return null
    }
  }

  // 提取目的地
  extractDestination(text) {
    const match = text.match(/目的地[:：](.+?)(?:\n|$)/)
    return match ? match[1].trim() : '待定'
  }

  // 提取预算
  extractBudget(text) {
    const patterns = [
      /总预算[：:]\s*¥?(\d+)/,
      /预算[：:]\s*¥?(\d+)/,
      /总计[：:]\s*¥?(\d+)/,
      /费用[：:]\s*¥?(\d+)/,
      /¥(\d+)/
    ]
    
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const budget = parseInt(match[1])
        if (budget >= 100 && budget <= 100000) {
          return budget
        }
      }
    }
    
    return 3000
  }

  // 提取标签
  extractTags(text) {
    const tags = ['AI规划']
    if (text.includes('自然')) tags.push('自然风光')
    if (text.includes('文化')) tags.push('文化历史')
    if (text.includes('美食')) tags.push('美食')
    return tags
  }

  // 提取交通方式
  extractTransportation(text) {
    if (text.includes('飞机')) return '飞机'
    if (text.includes('高铁')) return '高铁'
    if (text.includes('自驾')) return '自驾'
    return '待定'
  }

  // 提取住宿
  extractAccommodation(text) {
    if (text.includes('酒店')) return '酒店'
    if (text.includes('民宿')) return '民宿'
    if (text.includes('青年旅社')) return '青年旅社'
    return '待定'
  }

  // 规范化行程
  normalizeItinerary(aiResponse, totalDays, startDate) {
    const days = []
    const text = (aiResponse || '').trim()

    // 简单按天分割
    const daySections = text.split(/Day\s*\d+/gi)
    const validSections = daySections.filter((section, index) => {
      if (index === 0 && section.length > 0 && !section.includes('上午') && !section.includes('下午')) {
        return false
      }
      return section.trim().length > 10
    })
    
    validSections.forEach((section, index) => {
      const dayNum = index + 1
      const items = [
        { time: '上午', title: '上午行程安排' },
        { time: '下午', title: '下午行程安排' },
        { time: '晚上', title: '晚上行程安排' }
      ]
      
      days.push({
        day: dayNum,
        date: this.calculateDate(startDate, index),
        items: items
      })
    })

    return { days }
  }

  // 计算日期
  calculateDate(startDate, dayOffset) {
    if (!startDate) return ''
    const date = new Date(startDate)
    date.setDate(date.getDate() + dayOffset)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
}

// 创建AI集成实例
const aiIntegration = new AIIntegration()

module.exports = { aiIntegration, AIIntegration }