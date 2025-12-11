// utils/ai-service.js - Mistral AI 服务模块
const supabase = require('./supabase').supabase
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
    
    // 根据目的地生成特色内容（使用官方景点全称）
    const getDestinationFeatures = (dest) => {
      if (dest.includes('北京')) {
        return {
          attractions: ['故宫博物院', '天安门广场', '八达岭长城', '颐和园', '天坛公园', '圆明园'],
          food: ['北京烤鸭', '炸酱面', '豆汁儿', '护国寺小吃'],
          tips: '北京历史悠久，景点众多，建议合理安排时间，注意天气变化'
        }
      } else if (dest.includes('上海')) {
        return {
          attractions: ['外滩', '东方明珠塔', '豫园', '南京路步行街', '田子坊', '城隍庙'],
          food: ['小笼包', '生煎包', '上海本帮菜', '糖醋排骨'],
          tips: '上海现代化程度高，交通便利，注意节假日期间人流拥挤'
        }
      } else if (dest.includes('杭州')) {
        return {
          attractions: ['西湖风景名胜区', '灵隐寺', '雷峰塔', '宋城', '西溪湿地', '断桥'],
          food: ['西湖醋鱼', '东坡肉', '龙井虾仁', '叫花鸡'],
          tips: '杭州风景优美，春季最佳，注意景区内交通安排'
        }
      } else if (dest.includes('西安')) {
        return {
          attractions: ['秦始皇兵马俑博物馆', '华清宫', '大雁塔', '西安城墙', '钟楼', '回民街'],
          food: ['肉夹馍', '羊肉泡馍', '凉皮', 'biangbiang面'],
          tips: '西安历史文化深厚，夏季炎热，建议早出晚归避开高温'
        }
      } else if (dest.includes('成都')) {
        return {
          attractions: ['成都大熊猫繁育研究基地', '宽窄巷子', '锦里古街', '武侯祠', '杜甫草堂', '春熙路'],
          food: ['火锅', '担担面', '龙抄手', '夫妻肺片'],
          tips: '成都美食众多，注意饮食适度，天气多变建议带伞'
        }
      } else if (dest.includes('重庆')) {
        return {
          attractions: ['洪崖洞', '解放碑', '磁器口古镇', '长江索道', '南山一棵树', '朝天门'],
          food: ['重庆火锅', '小面', '酸辣粉', '毛血旺'],
          tips: '重庆地形复杂，建议穿舒适的鞋子，夏季炎热注意防暑'
        }
      } else if (dest.includes('广州')) {
        return {
          attractions: ['广州塔', '陈家祠', '沙面', '白云山', '北京路', '上下九步行街'],
          food: ['早茶点心', '白切鸡', '烧鹅', '肠粉'],
          tips: '广州气候湿热，注意防暑降温，早茶文化值得体验'
        }
      } else if (dest.includes('深圳')) {
        return {
          attractions: ['世界之窗', '深圳欢乐谷', '大梅沙', '莲花山公园', '深圳湾公园', '东部华侨城'],
          food: ['潮汕牛肉火锅', '肠粉', '烧腊', '海鲜'],
          tips: '深圳现代化程度高，交通便利，注意防晒'
        }
      } else if (dest.includes('南京')) {
        return {
          attractions: ['中山陵', '夫子庙', '秦淮河', '玄武湖', '明孝陵', '总统府'],
          food: ['盐水鸭', '鸭血粉丝汤', '小笼包', '牛肉锅贴'],
          tips: '南京历史文化丰富，夏季炎热，建议避开高温时段'
        }
      } else if (dest.includes('苏州')) {
        return {
          attractions: ['拙政园', '虎丘', '寒山寺', '狮子林', '留园', '平江路'],
          food: ['松鼠桂鱼', '响油鳝糊', '蟹黄汤包', '苏式糕点'],
          tips: '苏州园林众多，建议提前购票，春秋季节最佳'
        }
      } else if (dest.includes('厦门')) {
        return {
          attractions: ['鼓浪屿', '南普陀寺', '厦门大学', '曾厝垵', '环岛路', '中山路步行街'],
          food: ['沙茶面', '海蛎煎', '土笋冻', '花生汤'],
          tips: '厦门气候宜人，鼓浪屿需提前预约船票'
        }
      } else if (dest.includes('三亚')) {
        return {
          attractions: ['天涯海角', '亚龙湾', '蜈支洲岛', '南山文化旅游区', '大东海', '三亚湾'],
          food: ['海鲜大餐', '椰子鸡', '清补凉', '抱罗粉'],
          tips: '三亚阳光强烈，注意防晒，海上活动注意安全'
        }
      } else if (dest.includes('桂林')) {
        return {
          attractions: ['漓江', '阳朔西街', '象鼻山', '龙脊梯田', '两江四湖', '七星公园'],
          food: ['桂林米粉', '啤酒鱼', '荔浦芋头', '油茶'],
          tips: '桂林山水甲天下，漓江游船建议提前预订'
        }
      } else if (dest.includes('丽江')) {
        return {
          attractions: ['丽江古城', '玉龙雪山', '束河古镇', '泸沽湖', '黑龙潭公园', '拉市海'],
          food: ['纳西烤鱼', '鸡豆凉粉', '丽江粑粑', '腊排骨火锅'],
          tips: '丽江海拔较高，注意高原反应，紫外线强注意防晒'
        }
      } else if (dest.includes('大理')) {
        return {
          attractions: ['大理古城', '洱海', '崇圣寺三塔', '苍山', '双廊古镇', '喜洲古镇'],
          food: ['白族三道茶', '乳扇', '饵丝', '砂锅鱼'],
          tips: '大理风景优美，环洱海骑行是热门项目'
        }
      } else {
        // 默认内容
        return {
          attractions: [`${dest}博物馆`, `${dest}公园`, `${dest}古城`, `${dest}风景区`],
          food: ['当地特色菜', '地方小吃', '传统美食', '特色糕点'],
          tips: `${dest}历史文化深厚，建议提前了解当地风俗，合理安排行程`
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
    // 尝试获取天气信息（如果可能从用户输入中提取城市）
    let weatherInfo = null
    try {
      const { weatherService } = require('./weather-service')
      
      // 从用户输入中提取城市名称
      const cityMatch = userInput.match(/(?:去|到|在|前往)([^，。！？\s]+)/)
      const city = cityMatch ? cityMatch[1] : null
      
      if (city) {
        const weatherResult = await weatherService.getWeather(city)
        if (weatherResult.success) {
          weatherInfo = weatherResult.data
        }
      }
    } catch (error) {
      console.log('获取天气信息失败，将使用通用建议:', error)
    }
    const systemPrompt = `你是一个经验丰富的旅行规划AI助手，专门为用户制定详细、实用、个性化的旅行行程。

## 核心要求：
1. **时间段精确化**：每天必须明确安排上午(8:00-12:00)、下午(13:00-17:00)、晚上(18:00-22:00)
2. **费用真实性**：基于实际市场定价
   - 住宿：经济型120-280元/晚，舒适型280-450元/晚
   - 餐饮：当地人均50-120元/天
   - 市内交通：15-40元/天
   - 景点门票：按实际票价
3. **行程合理性**：考虑交通衔接、景点游览时间、用餐安排
4. **本地化体验**：深入当地特色美食、文化、民俗
5. **实用性强**：提供具体可行的建议和贴士
6. **天气适应性**：根据实时天气信息调整建议

## ⚠️ 景点命名规范（极其重要）：
为了确保景点能在地图上准确标注，请严格遵循以下规则：
1. **使用官方全称**：必须使用景点的官方完整名称，不要简写或使用别名
   - ✅ 正确：故宫博物院、天安门广场、八达岭长城、颐和园、西湖风景名胜区
   - ❌ 错误：故宫、天安门、长城、颐和园景区、西湖
2. **知名景点优先**：优先推荐有明确地理坐标的知名景点
   - ✅ 正确：东方明珠塔、外滩、豫园、南京路步行街
   - ❌ 错误：某某网红打卡点、当地特色街区、附近公园
3. **避免模糊描述**：不要使用"附近"、"周边"、"当地"等模糊词汇
   - ✅ 正确：参观秦始皇兵马俑博物馆
   - ❌ 错误：参观当地博物馆、游览附近景点
4. **景点类型明确**：博物馆、公园、寺庙等要写完整
   - ✅ 正确：灵隐寺、雷峰塔、苏堤、断桥
   - ❌ 错误：某寺庙、某塔、湖边步道

## 中国主要城市热门景点参考（请优先使用这些景点名称）：
- 北京：故宫博物院、天安门广场、八达岭长城、颐和园、天坛公园、圆明园、北海公园、景山公园、雍和宫、南锣鼓巷、王府井大街、798艺术区、鸟巢、水立方
- 上海：外滩、东方明珠塔、豫园、南京路步行街、田子坊、城隍庙、朱家角古镇、上海迪士尼乐园、陆家嘴、新天地、静安寺
- 杭州：西湖、灵隐寺、雷峰塔、断桥、苏堤、三潭印月、西溪湿地、宋城、河坊街、千岛湖
- 西安：秦始皇兵马俑博物馆、华清宫、大雁塔、西安城墙、钟楼、鼓楼、回民街、大唐芙蓉园、大唐不夜城、陕西历史博物馆、华山
- 成都：宽窄巷子、锦里古街、武侯祠、杜甫草堂、青城山、都江堰、成都大熊猫繁育研究基地、春熙路、太古里、文殊院
- 重庆：洪崖洞、解放碑、磁器口古镇、长江索道、南山一棵树、朝天门、李子坝轻轨站、大足石刻
- 广州：广州塔、陈家祠、沙面、白云山、长隆欢乐世界、北京路、上下九步行街
- 深圳：世界之窗、深圳欢乐谷、大梅沙、莲花山公园、深圳湾公园、东部华侨城
- 南京：中山陵、夫子庙、秦淮河、玄武湖、明孝陵、总统府、南京博物院、鸡鸣寺、老门东
- 苏州：拙政园、虎丘、寒山寺、狮子林、留园、平江路、山塘街、周庄古镇、同里古镇
- 厦门：鼓浪屿、南普陀寺、厦门大学、曾厝垵、环岛路、中山路步行街
- 三亚：天涯海角、亚龙湾、蜈支洲岛、南山文化旅游区、大东海、三亚湾
- 桂林：漓江、阳朔西街、象鼻山、龙脊梯田、两江四湖、七星公园
- 云南：丽江古城、大理古城、洱海、玉龙雪山、束河古镇、泸沽湖、石林、滇池、香格里拉

## 输出格式（严格遵循）：
📍 目的地：[完整目的地名称]
📅 出行时间：[YYYY-MM-DD] 至 [YYYY-MM-DD] (共X天)
👥 出行人数：[数字]人
💰 总预算：¥[数字]
🎯 旅行主题：[主题描述]
${weatherInfo ? `
🌤️ 天气信息：${weatherInfo.current.icon} ${weatherInfo.current.weather} ${weatherInfo.current.temperature}
👔 穿衣建议：${weatherInfo.current.temperature >= '25' ? '轻薄夏装' : weatherInfo.current.temperature >= '15' ? '春秋装' : '保暖衣物'}
` : ''}

📋 详细行程：

Day 1 - [日期]：
🌅 上午 (8:00-12:00)：参观【景点官方全称】，[简要描述]（门票：XX元）
🍽️ 午餐 (12:00-13:00)：[餐厅名称]，推荐[具体菜品]（人均：XX元）
☀️ 下午 (13:00-17:00)：游览【景点官方全称】，[简要描述]（门票：XX元）
🍽️ 晚餐 (17:00-18:00)：[餐厅名称]，品尝[当地特色菜]（人均：XX元）
🌙 晚上 (18:00-22:00)：漫步【具体地点名称】，[夜间活动描述]

Day 2 - [日期]：
🌅 上午 (8:00-12:00)：参观【景点官方全称】
🍽️ 午餐 (12:00-13:00)：[餐饮推荐]
☀️ 下午 (13:00-17:00)：游览【景点官方全称】
🍽️ 晚餐 (17:00-18:00)：[餐饮推荐]
🌙 晚上 (18:00-22:00)：[夜间安排]

[继续相同格式直到最后一天]

💰 详细费用明细：
- 交通：¥[金额] (往返大交通 + 市内交通明细)
- 住宿：¥[金额] ([X]晚×[平均]元/晚 + 酒店档次说明)
- 餐饮：¥[金额] ([X]天×[平均]元/人/天×[人数]人 + 用餐标准)
- 门票：¥[金额] (列出每个景点门票：景点名称XX元)
- 其他：¥[金额] (购物、应急、小费等)
- 总计：¥[总金额]

🚗 交通安排：[详细交通建议 + 出行方式选择]
🏨 住宿推荐：[住宿区域选择 + 酒店类型参考]
⚠️ 重要提醒：[${weatherInfo ? `当前天气${weatherInfo.current.weather}，${weatherInfo.current.temperature}，` : ''}天气、着装、安全、实用贴士]

## 特别说明：
- 景点名称必须使用官方全称，确保能在地图上准确定位
- 每个时间段都要有具体可执行的内容
- 费用明细必须真实合理，符合当地消费水平
- 优先推荐上述参考列表中的知名景点
- ${weatherInfo ? `已获取实时天气信息：${weatherInfo.current.weather}，${weatherInfo.current.temperature}，请据此提供针对性的建议` : '建议出行前关注当地天气预报'}

用户偏好：${JSON.stringify(userPreferences)}
${weatherInfo ? `
实时天气信息：
- 当前天气：${weatherInfo.current.weather}
- 温度：${weatherInfo.current.temperature}
- 湿度：${weatherInfo.current.humidity}
- 风力：${weatherInfo.current.wind}
- 穿衣建议：${weatherInfo.current.temperature >= '25' ? '轻薄夏装' : weatherInfo.current.temperature >= '15' ? '春秋装' : '保暖衣物'}
` : ''}

请严格按照以上格式和要求生成完整、详细、实用的旅行计划。景点名称务必使用官方全称！`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ]

    return await this.callAPI(messages, { temperature: 0.4, maxTokens: 3500 })
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