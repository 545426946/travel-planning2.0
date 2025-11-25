// utils/ai-integration.js - AI 集成工具类
const aiService = require('./ai-service').aiService
const db = require('./database').db
const supabase = require('./supabase').supabase

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
      
      if (result.error) {
        throw new Error(result.error.message || '保存失败')
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

  // 智能景点推荐
  async getSmartDestinationRecommendations(userId, currentLocation = null) {
    try {
      // 获取用户偏好
      const preferencesResult = await db.userPreferences.getByUserId(userId)
      const preferences = preferencesResult.data
      
      // 获取用户历史收藏
      const favoritesResult = await db.favorites.getUserFavorites(userId, 'destination')
      const favorites = favoritesResult.data
      
      // 生成AI推荐
      const aiResponse = await aiService.recommendDestinations(
        preferences || {}, 
        currentLocation
      )
      
      // 解析推荐结果
      const recommendations = this.parseDestinationRecommendations(aiResponse)
      
      return {
        success: true,
        recommendations,
        aiResponse,
        userPreferences: preferences
      }
    } catch (error) {
      console.error('智能景点推荐失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 创建AI生成路线
  async createAIGeneratedRoute(routeTheme, difficulty, duration, createdBy = null) {
    try {
      const aiResponse = await aiService.generatePopularRoute(routeTheme, difficulty, duration)
      
      const routeData = this.parseAIRouteToData(aiResponse, routeTheme)
      
      if (routeData) {
        const result = await supabase
          .from('popular_routes')
          .insert({
            title: routeData.title,
            description: routeData.description,
            destination: routeData.destination,
            duration: routeData.duration,
            budget: routeData.budget,
            itinerary: routeData.itinerary,
            tags: routeData.tags,
            is_ai_generated: true,
            created_by: createdBy
          })
          .select()
        
        return { success: true, data: result.data, aiResponse }
      }
      
      return { success: false, aiResponse }
    } catch (error) {
      console.error('AI路线生成失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 行程优化建议
  async optimizeItinerary(planId, optimizationGoal = '优化时间安排') {
    try {
      // 获取行程详情
      const planResult = await db.travelPlans.getById(planId)
      const plan = planResult.data
      
      if (!plan) {
        return { success: false, error: '行程不存在' }
      }
      
      // 生成优化建议
      const aiResponse = await aiService.optimizeTravelPlan(plan, optimizationGoal)
      
      // 保存优化建议到数据库
      const optimizationData = {
        plan_id: planId,
        optimization_goal: optimizationGoal,
        ai_suggestions: aiResponse,
        created_at: new Date().toISOString()
      }
      
      // 这里可以保存到专门的优化建议表，或者更新计划字段
      const updateResult = await db.travelPlans.update(planId, {
        ai_optimization_suggestions: optimizationData
      })
      
      return { success: true, data: updateResult.data, aiResponse }
    } catch (error) {
      console.error('行程优化失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 智能问答
  async askTravelQuestion(userId, question, context = {}) {
    try {
      const preferencesResult = await db.userPreferences.getByUserId(userId)
      const preferences = preferencesResult.data
      const recentPlansResult = await db.travelPlans.getByUserId(userId, 'planned', 3)
      const recentPlans = recentPlansResult.data
      
      const enrichedContext = Object.assign({
        userPreferences: preferences,
        recentPlans: recentPlans
      }, context)
      
      const aiResponse = await aiService.travelQA(question, enrichedContext)
      
      // 保存问答记录（可选）
      // 这里可以保存到问答历史表
      const result = await db.qaPairs.create({
         user_id: userId,
         question: question,
         answer: aiResponse,
         context: enrichedContext,
         created_at: new Date().toISOString()
       })
       
       return { success: true, answer: aiResponse }
    } catch (error) {
      console.error('智能问答失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 生成个性化推荐
  async getPersonalizedRecommendations(userId) {
    try {
      const aiResponse = await aiService.generatePersonalizedRecommendations(userId)
      
      const recommendations = this.parsePersonalizedRecommendations(aiResponse)
      
      return { success: true, recommendations, aiResponse }
    } catch (error) {
      console.error('个性化推荐失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 批量生成景点描述
  async batchGenerateDestinationDescriptions(destinations) {
    const results = []
    
    for (const dest of destinations) {
      try {
        const aiResponse = await aiService.generateDestinationDescription(
          dest.name, 
          { location: dest.location, category: dest.category }
        )
        
        const description = this.parseDestinationDescription(aiResponse)
        
        // 更新数据库
        await supabase
          .from('destinations')
          .update({
            description: description.full,
            short_desc: description.short,
            tags: description.tags
          })
          .eq('id', dest.id)
        
        results.push({ id: dest.id, success: true, description })
      } catch (error) {
        results.push({ id: dest.id, success: false, error: error.message })
      }
    }
    
    return results
  }

  // 解析AI行程响应
  parseAIResponseToPlan(aiResponse, userId, formData = {}) {
    try {
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
      
      // 生成描述（从AI响应中提取前200字）
      const description = aiResponse.substring(0, 200).replace(/\n/g, ' ')
      
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
        itinerary: aiResponse,  // 完整的AI响应作为行程详情
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

  // 解析景点推荐
  parseDestinationRecommendations(aiResponse) {
    // 解析AI推荐的景点列表
    return {
      destinations: [], // 解析后的景点列表
      summary: aiResponse.substring(0, 200) + '...', // 摘要
      fullResponse: aiResponse
    }
  }

  // 解析路线数据
  parseAIRouteToData(aiResponse, theme) {
    return {
      title: theme + '主题路线',
      description: aiResponse.substring(0, 500),
      itinerary: aiResponse,
      tags: [theme, 'AI生成'],
      difficulty_level: 2,
      price_range: '待定',
      duration: '待定'
    }
  }

  // 解析个性化推荐
  parsePersonalizedRecommendations(aiResponse) {
    return {
      destinations: [],
      routes: [],
      tips: [],
      fullResponse: aiResponse
    }
  }

  // 解析景点描述
  parseDestinationDescription(aiResponse) {
    return {
      short: aiResponse.substring(0, 200),
      full: aiResponse,
      tags: ['热门推荐']
    }
  }

  // 辅助提取方法
  extractTitle(text) {
    const match = text.match(/标题[:：](.+?)(?:\n|$)/)
    return match ? match[1].trim() : 'AI生成行程'
  }

  extractDescription(text) {
    const lines = text.split('\n').filter(line => line.trim())
    return lines.slice(0, 3).join(' ').substring(0, 200)
  }

  extractDestination(text) {
    const match = text.match(/目的地[:：](.+?)(?:\n|$)/)
    return match ? match[1].trim() : '待定'
  }

  extractBudget(text) {
    // 尝试多种预算匹配模式
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
        // 验证预算合理性（100-100000之间）
        if (budget >= 100 && budget <= 100000) {
          return budget
        }
      }
    }
    
    return 3000 // 默认预算
  }

  extractTags(text) {
    const tags = ['AI规划']
    if (text.includes('自然')) tags.push('自然风光')
    if (text.includes('文化')) tags.push('文化历史')
    if (text.includes('美食')) tags.push('美食')
    return tags
  }

  extractTransportation(text) {
    if (text.includes('飞机')) return '飞机'
    if (text.includes('高铁')) return '高铁'
    if (text.includes('自驾')) return '自驾'
    return '待定'
  }

  extractAccommodation(text) {
    if (text.includes('酒店')) return '酒店'
    if (text.includes('民宿')) return '民宿'
    if (text.includes('青年旅社')) return '青年旅社'
    return '待定'
  }
}

// 创建AI集成实例
const aiIntegration = new AIIntegration()

module.exports = { aiIntegration, AIIntegration }