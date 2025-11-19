// utils/ai-service.js - Mistral AI 服务模块
const supabase = require('./supabase').supabase
const AI_CONFIG = require('./config').AI_CONFIG

class AIService {
  constructor() {
    this.apiKey = AI_CONFIG.apiKey
    this.apiUrl = AI_CONFIG.apiUrl
    this.model = AI_CONFIG.model
  }

  // 调用 Mistral AI API
  async callAPI(messages, options = {}) {
    try {
      // 使用微信小程序的 wx.request 替代 fetch
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: this.apiUrl,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          data: Object.assign({
            model: this.model,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2000
          }, options),
          success: (res) => {
            resolve(res)
          },
          fail: (err) => {
            reject(err)
          }
        })
      })

      if (response.statusCode !== 200) {
        throw new Error(`AI API 错误: ${response.statusCode} ${response.data}`)
      }

      return response.data.choices[0].message.content
    } catch (error) {
      console.error('AI 服务调用失败:', error)
      throw error
    }
  }

  // 行程规划助手
  async generateTravelPlan(userInput, userPreferences = {}) {
    const systemPrompt = `你是一个专业的旅行规划AI助手，擅长为用户制定详细且实用的旅行行程。

请根据用户提供的信息，生成超详细的旅行计划，要求：
1. **时间段具体化**：每天安排要具体到上午(8:00-12:00)、下午(13:00-17:00)、晚上(18:00-22:00)
2. **费用符合实际**：住宿按经济型(150-300元/晚)，餐饮按当地标准(60-150元/人/天)，交通市内(20-50元/天)
3. **行程合理化**：考虑交通时间、景点开放时间、用餐时间
4. **体验本地化**：包含当地特色美食、文化体验
5. **实用贴士**：注意事项、最佳拍照时间、避坑指南

输出格式：
📍 目的地：[目的地名称]
📅 出行时间：[开始日期] 至 [结束日期] (共X天)
👥 出行人数：[X]人
💰 总预算：¥[金额]
🎯 旅行主题：[主题]

📋 详细行程：
Day 1 - [日期]：
🌅 上午 (8:00-12:00)：[具体活动，含交通时间]
🍽️ 午餐 (12:00-13:00)：[推荐餐厅或美食]
☀️ 下午 (13:00-17:00)：[具体活动，含门票信息]
🍽️ 晚餐 (17:00-18:00)：[推荐餐厅或美食]
🌙 晚上 (18:00-22:00)：[夜间活动、住宿建议]

Day 2 - [日期]：
[同上格式]

💰 费用明细：
- 交通：¥[金额] (含往返大交通+市内交通)
- 住宿：¥[金额] ([X]晚×[金额]元/晚)
- 餐饮：¥[金额] ([X]天×[金额]元/人/天×[人数]人)
- 门票：¥[金额] (列明主要景点门票)
- 其他：¥[金额] (购物、应急等)
- 总计：¥[总金额]

🚗 交通安排：[具体交通建议]
🏨 住宿推荐：[酒店类型和位置建议]
⚠️ 重要提醒：[注意事项]

用户偏好：${JSON.stringify(userPreferences)}

请严格按照以上格式输出，确保信息准确、费用合理、时间安排详细。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ]

    return await this.callAPI(messages, { temperature: 0.6, maxTokens: 3000 })
  }

  // 景点推荐
  async recommendDestinations(userPreferences, currentLocation = null) {
    const systemPrompt = `你是一个旅行景点推荐专家，根据用户偏好推荐合适的景点。

推荐标准：
1. 匹配用户的兴趣偏好
2. 考虑地理位置便利性
3. 提供景点特色和亮点
4. 包含实用的游玩建议
5. 预估游玩时间和费用

用户偏好：${JSON.stringify(userPreferences)}
当前位置：${currentLocation || '未指定'}

请推荐5-8个景点，按推荐度排序。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请为我推荐合适的景点' }
    ]

    return await this.callAPI(messages)
  }

  // 生成热门路线
  async generatePopularRoute(routeTheme, difficulty = '中等', duration = '3-5天') {
    const systemPrompt = `你是一个专业路线规划师，创建高质量的旅游路线。

路线要求：
- 主题：${routeTheme}
- 难度等级：${difficulty}
- 时长：${duration}
- 包含详细的每日行程安排
- 提供交通和住宿建议
- 预算范围和费用明细
- 注意事项和建议

请生成一条完整的旅游路线，内容详细实用。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请创建一条${routeTheme}主题的旅游路线` }
    ]

    return await this.callAPI(messages)
  }

  // 行程优化建议
  async optimizeTravelPlan(travelPlan, optimizationGoal = '优化时间安排') {
    const systemPrompt = `你是一个行程优化专家，分析用户提供的行程并给出优化建议。

当前行程：${JSON.stringify(travelPlan)}
优化目标：${optimizationGoal}

请从以下角度分析：
1. 时间安排合理性
2. 路线效率优化
3. 费用控制建议
4. 体验改善建议
5. 实用性改进

提供具体可行的优化建议。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请帮我优化这个行程' }
    ]

    return await this.callAPI(messages)
  }

  // 智能问答
  async travelQA(question, context = {}) {
    const systemPrompt = `你是一个旅行知识专家，回答用户的旅行相关问题。

知识范围：
- 目的地信息和景点介绍
- 旅行攻略和建议
- 交通和住宿信息
- 当地文化和风俗
- 安全注意事项
- 最佳旅行时间和天气

上下文信息：${JSON.stringify(context)}

请准确、实用地回答用户问题。如果不确定，请诚实地告知。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ]

    return await this.callAPI(messages, { temperature: 0.3 })
  }

  // 生成景点描述
  async generateDestinationDescription(destinationName, basicInfo = {}) {
    const systemPrompt = `你是一个文案写作专家，为景点生成吸引人的描述。

景点名称：${destinationName}
基本信息：${JSON.stringify(basicInfo)}

请生成：
1. 简短吸引人的标题
2. 详细的景点介绍（200-300字）
3. 景点特色和亮点
4. 游玩建议和贴士
5. 最佳游玩时间

文案要生动有趣，有吸引力。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请为${destinationName}生成描述文案` }
    ]

    return await this.callAPI(messages)
  }

  // 生成旅行贴士
  async generateTravelTips(destination, travelType = '自由行', season = '春季') {
    const systemPrompt = `你是一个资深旅行顾问，提供实用的旅行贴士。

目的地：${destination}
旅行类型：${travelType}
旅行季节：${season}

请提供详细的旅行贴士，包括：
1. 必备物品清单
2. 穿衣建议
3. 当地文化注意事项
4. 安全提醒
5. 费用节约建议
6. 交通出行建议
7. 住宿选择建议

建议要实用、具体、可操作。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请提供${destination}的旅行贴士` }
    ]

    return await this.callAPI(messages)
  }

  // 翻译服务
  async translateText(text, targetLanguage = '英文') {
    const systemPrompt = `你是一个专业翻译，将中文翻译成${targetLanguage}。

翻译要求：
- 保持原文意思准确
- 语言表达自然流畅
- 符合目标语言习惯
- 专业术语翻译准确

请直接翻译结果，不需要额外解释。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ]

    return await this.callAPI(messages, { temperature: 0.1 })
  }

  // 生成个性化推荐
  async generatePersonalizedRecommendations(userId, userHistory = {}) {
    // 获取用户偏好和历史记录
    const preferencesResult = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    const preferences = preferencesResult.data;
 
     const plansResult = await supabase
       .from('travel_plans')
       .select('destination, travel_type, tags')
       .eq('user_id', userId)
       .limit(5);
     const plans = plansResult.data;
 
     const favoritesResult = await supabase
       .from('user_favorites')
       .select(`
         target_type,
         target_id,
         ${'destinations(name, location, category)'},
         ${'popular_routes(title, tags)'}
       `)
       .eq('user_id', userId)
       .eq('target_type', 'destination')
       .limit(10);
     const favorites = favoritesResult.data;

    const systemPrompt = `基于用户的偏好和历史数据，生成个性化推荐。

用户偏好：${JSON.stringify(preferences)}
历史行程：${JSON.stringify(plans)}
收藏记录：${JSON.stringify(favorites)}

请提供：
1. 个性化目的地推荐（5个）
2. 符合偏好的旅行路线建议（3条）
3. 下一步行动建议
4. 相关活动推荐

推荐要符合用户特点，具有针对性。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请为我生成个性化旅行推荐' }
    ]

    return await this.callAPI(messages)
  }
}

// 创建 AI 服务实例
const aiService = new AIService()

module.exports = { aiService, AIService }