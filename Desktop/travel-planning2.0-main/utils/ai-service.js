// utils/ai-service.js - Mistral AI 服务模块
// const supabase = require('./supabase').supabase
const AI_CONFIG = require('./config').AI_CONFIG

class AIService {
  constructor() {
    this.providers = AI_CONFIG.providers
    this.currentProvider = 0 // 从第一个提供商开始尝试
  }

  // 获取当前提供商配置
  getCurrentProvider() {
    return this.providers[this.currentProvider]
  }

  // 切换到下一个提供商
  switchProvider() {
    this.currentProvider = (this.currentProvider + 1) % this.providers.length
    console.log(`切换到AI提供商: ${this.getCurrentProvider().name}`)
  }

  // 调用 AI API（支持多个提供商）
  async callAPI(messages, options = {}) {
    const maxRetries = this.providers.length
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const provider = this.getCurrentProvider()
      
      try {
        console.log(`尝试使用AI提供商: ${provider.name}`)
        
        // 构建请求数据
        const requestData = {
          model: provider.model,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2000
        }

        // 不同提供商的特殊处理
        if (provider.name === 'openai') {
          // OpenAI的特殊参数
          requestData.max_tokens = Math.min(requestData.max_tokens, 4096)
        }

        console.log('AI API 请求参数:', JSON.stringify(requestData, null, 2))
        console.log('API URL:', provider.apiUrl)
        console.log('Provider:', provider.name)

        // 使用微信小程序的 wx.request
        const response = await new Promise((resolve, reject) => {
          wx.request({
            url: provider.apiUrl,
            method: 'POST',
            header: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${provider.apiKey}`,
              'Accept': 'application/json'
            },
            data: requestData,
            timeout: 30000,
            success: (res) => {
              resolve(res)
            },
            fail: (err) => {
              reject(err)
            }
          })
        })

        console.log(`${provider.name} API响应状态码:`, response.statusCode)

        // 处理422错误
        if (response.statusCode === 422) {
          const errorData = response.data
          let errorMsg = '请求参数不正确'
          
          if (errorData && errorData.error && errorData.error.message) {
            errorMsg = errorData.error.message
          } else if (errorData && errorData.detail) {
            errorMsg = errorData.detail
          }
          
          console.error(`${provider.name} API 422错误:`, errorMsg)
          
          // 尝试下一个提供商
          if (attempt < maxRetries - 1) {
            this.switchProvider()
            continue
          }
          
          throw new Error(`所有AI提供商都返回422错误: ${errorMsg}`)
        }

        if (response.statusCode !== 200) {
          const errorMsg = response.data?.error?.message || JSON.stringify(response.data)
          console.error(`${provider.name} API错误:`, errorMsg)
          
          // 如果是认证错误，尝试下一个提供商
          if (response.statusCode === 401 && attempt < maxRetries - 1) {
            this.switchProvider()
            continue
          }
          
          throw new Error(`AI API 错误: ${response.statusCode} ${errorMsg}`)
        }

        if (!response.data || !response.data.choices || !response.data.choices[0]) {
          throw new Error('AI API 响应格式错误：缺少choices字段')
        }

        console.log(`${provider.name} API调用成功`)
        return response.data.choices[0].message.content

      } catch (error) {
        console.error(`${provider.name} API调用失败:`, error)
        
        // 如果不是最后一次尝试，切换提供商继续
        if (attempt < maxRetries - 1) {
          console.log('切换到下一个提供商重试...')
          this.switchProvider()
          continue
        }
        
        // 所有提供商都失败了，返回模拟响应
        console.log('所有AI提供商都失败，返回模拟响应')
        return this.generateMockResponse(messages[0]?.content || '')
      }
    }
  }

  // 生成模拟AI响应（作为备用方案）
  generateMockResponse(userInput) {
    console.log('生成模拟AI响应，输入:', userInput)
    
    // 从用户输入中提取信息
    const destinationMatch = userInput.match(/目的地[:：]\s*([^\n]+)/i)
    const daysMatch = userInput.match(/旅行天数[:：]\s*([^\n]+)/i)
    const travelersMatch = userInput.match(/出行人数[:：]\s*(\d+)/i)
    const budgetMatch = userInput.match(/总预算[:：]\s*([^\n]+)/i)
    
    const destination = destinationMatch ? destinationMatch[1].trim() : '邯郸'
    const days = daysMatch ? daysMatch[1].trim() : '3天'
    const travelers = travelersMatch ? parseInt(travelersMatch[1]) : 3
    const budget = budgetMatch ? budgetMatch[1].trim() : '2000'
    const totalDays = parseInt(days) || 3
    
    // 生成动态日期
    const today = new Date()
    const startDate = today.toISOString().split('T')[0]
    const endDate = new Date(today.getTime() + (totalDays - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // 根据目的地生成特色内容
    const getDestinationFeatures = (dest) => {
      if (dest.includes('北京')) {
        return {
          attractions: ['故宫博物院', '天安门广场', '长城八达岭', '颐和园'],
          food: ['北京烤鸭', '炸酱面', '豆汁儿', '护国寺小吃'],
          tips: '北京历史悠久，景点众多，建议合理安排时间，注意天气变化'
        }
      } else if (dest.includes('上海')) {
        return {
          attractions: ['外滩', '东方明珠塔', '豫园', '南京路步行街'],
          food: ['小笼包', '生煎包', '上海本帮菜', '糖醋排骨'],
          tips: '上海现代化程度高，交通便利，注意节假日期间人流拥挤'
        }
      } else if (dest.includes('杭州')) {
        return {
          attractions: ['西湖', '灵隐寺', '雷峰塔', '宋城'],
          food: ['西湖醋鱼', '东坡肉', '龙井虾仁', '叫花鸡'],
          tips: '杭州风景优美，春季最佳，注意景区内交通安排'
        }
      } else {
        // 默认邯郸内容
        return {
          attractions: ['丛台公园', '学步桥', '响堂山石窟', '邯郸市博物馆'],
          food: ['丛台大曲酒', '河北菜', '邯郸驴肉火烧', '永年酥鱼'],
          tips: '邯郸历史文化深厚，秋季早晚温差大，建议携带适当衣物'
        }
      }
    }
    
    const features = getDestinationFeatures(destination)
    
    // 生成详细行程
    let dayPlans = ''
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(today.getTime() + (i - 1) * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      
      if (i === 1) {
        // 第一天：主要景点
        dayPlans += `Day ${i} - ${dateStr}：
🌅 上午 (8:00-12:00)：参观${features.attractions[0]}，感受当地历史文化
🍽️ 午餐 (12:00-13:00)：品尝当地特色——${features.food[0]}
☀️ 下午 (13:00-17:00)：游览${features.attractions[1]}，深度体验
🍽️ 晚餐 (17:00-18:00)：在当地餐厅享用${features.food[1]}
🌙 晚上 (18:00-22:00)：休息调整，适应环境

`
      } else if (i === totalDays) {
        // 最后一天：购物和返程准备
        dayPlans += `Day ${i} - ${dateStr}：
🌅 上午 (8:00-12:00)：参观${features.attractions[2]}，了解民俗文化
🍽️ 午餐 (12:00-13:00)：品尝${features.food[2]}
☀️ 下午 (13:00-17:00)：购买当地特产，准备返程
🍽️ 晚餐 (17:00-18:00)：告别晚餐
🌙 晚上 (18:00-22:00)：整理行李，准备返程

`
      } else {
        // 中间天数：周边探索
        dayPlans += `Day ${i} - ${dateStr}：
🌅 上午 (8:00-12:00)：前往${features.attractions[3]}，探索自然风光
🍽️ 午餐 (12:00-13:00)：当地农家菜体验
☀️ 下午 (13:00-17:00)：深度游览${features.attractions[3]}，拍照留念
🍽️ 晚餐 (17:00-18:00)：品尝${features.food[3]}
🌙 晚上 (18:00-22:00)：自由活动，体验夜生活

`
      }
    }
    
    // 计算费用明细
    const accommodationCost = Math.floor(parseInt(budget) * 0.4)
    const foodCost = Math.floor(parseInt(budget) * 0.25)
    const transportCost = Math.floor(parseInt(budget) * 0.2)
    const ticketCost = Math.floor(parseInt(budget) * 0.1)
    const otherCost = parseInt(budget) - accommodationCost - foodCost - transportCost - ticketCost
    
    return `📍 目的地：${destination}
📅 出行时间：${startDate} 至 ${endDate} (共${totalDays}天)
👥 出行人数：${travelers}人
💰 总预算：¥${budget}
🎯 旅行主题：文化历史体验游

📋 详细行程：
${dayPlans}💰 费用明细：
- 交通：¥${transportCost} (含往返大交通+市内交通)
- 住宿：¥${accommodationCost} (${totalDays}晚×${Math.floor(accommodationCost/totalDays)}元/晚)
- 餐饮：¥${foodCost} (${totalDays}天×${Math.floor(foodCost/totalDays/travelers)}元/人/天×${travelers}人)
- 门票：¥${ticketCost} (主要景点门票)
- 其他：¥${otherCost} (购物、应急等)
- 总计：¥${budget}

🚗 交通安排：建议包车或使用当地交通工具，提前规划路线
🏨 住宿推荐：选择市中心区域酒店，交通便利且性价比高
⚠️ 重要提醒：${features.tips}
💡 贴士：建议提前了解景点开放时间，合理安排行程密度`
  }

  // 行程规划助手
  async generateTravelPlan(userInput, userPreferences = {}) {
    const systemPrompt = `你是旅行规划AI助手，请输出严格的 JSON，且不包含具体年月日，只按“第N天”。

输出 JSON 结构（必须严格遵循）：
{
  "destination": "目的地",
  "totalDays": 整数,
  "travelers": 整数,
  "budget": 整数,
  "style": "comfortable|luxury|premium|budget|adventure",
  "tags": ["标签1", "标签2"],
  "itinerary": {
    "days": [
      {
        "day": 1,
        "items": [
          { "time": "上午", "title": "活动/景点", "location": "位置(可选)", "price": 0, "notes": "注意事项(可选)", "priority": "high|medium|low" },
          { "time": "下午", "title": "..." },
          { "time": "晚上", "title": "..." }
        ]
      },
      { "day": 2, "items": [ ... ] }
    ]
  },
  "transportation": "交通建议",
  "accommodation": "住宿建议",
  "specialRequirements": "特殊要求(可选)"
}

生成原则：
1. 不使用具体日期（YYYY-MM-DD）；仅使用“上午/下午/晚上”和“第N天”。
2. 费用与安排需符合当地常见水平：住宿(120-450/晚)、餐饮(50-120/人/天)、市内交通(15-40/天)、门票按常见价。
3. 兼顾实时情况：优先避开高峰时段（如节假日、热门景点高峰时段），安排开放时段内活动；如出现不确定的开放时间或季节性限制，请给出替代方案和提示。
4. 更贴近用户偏好：融合 ${JSON.stringify(userPreferences)}，包含兴趣标签、风格、特殊要求。
5. 内容必须可执行：每个时间段都有具体地点/活动/餐饮，附简短可操作的说明。

只返回纯 JSON，不要任何解释、不要前后缀。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ]

    return await this.callAPI(messages, { temperature: 0.3, maxTokens: 2800 })
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
