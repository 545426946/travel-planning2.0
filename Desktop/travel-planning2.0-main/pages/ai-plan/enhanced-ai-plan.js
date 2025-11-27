// AI规划页面 - 增强版本，生成更详细的行程描述
const Auth = require('../../utils/auth').Auth
const aiIntegration = require('../../utils/ai-integration').aiIntegration

Page({
  data: {
    // 表单数据
    formData: {
      destination: '',
      days: '',
      daysIndex: 0,
      travelers: '',
      budget: '',
      style: 'comfortable',
      specialRequirements: ''
    },
    
    // 天数选项
    dayOptions: ['1天', '2天', '3天', '4天', '5天', '6天', '7天', '8天', '9天', '10天', '10天以上'],
    
    // 兴趣偏好选项
    interests: [
      { label: '文化历史', value: 'culture', checked: false },
      { label: '自然风光', value: 'nature', checked: false },
      { label: '美食体验', value: 'food', checked: false },
      { label: '购物娱乐', value: 'shopping', checked: false },
      { label: '冒险探索', value: 'adventure', checked: false },
      { label: '放松度假', value: 'relax', checked: false }
    ],
    
    // 旅行风格选项
    styles: [
      { label: '轻奢型', value: 'luxury' },
      { label: '舒适享受', value: 'comfortable' },
      { label: '奢华体验', value: 'premium' }
    ],
    
    // 加载状态
    isLoading: false
  },

  onLoad(options) {
    console.log('🚀 增强版AI规划页面加载')
  },

  // 表单输入处理
  onDestinationInput(e) {
    this.setData({
      'formData.destination': e.detail.value
    })
  },

  onDaysChange(e) {
    const index = e.detail.value
    this.setData({
      'formData.daysIndex': index,
      'formData.days': this.data.dayOptions[index]
    })
  },

  onTravelersInput(e) {
    this.setData({
      'formData.travelers': e.detail.value
    })
  },

  onBudgetInput(e) {
    this.setData({
      'formData.budget': e.detail.value
    })
  },

  onInterestTap(e) {
    const index = e.currentTarget.dataset.index
    const interests = [...this.data.interests]
    interests[index].checked = !interests[index].checked
    this.setData({ interests })
  },

  onStyleTap(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      'formData.style': value
    })
  },

  onSpecialRequirementsInput(e) {
    this.setData({
      'formData.specialRequirements': e.detail.value
    })
  },

  // 表单验证
  validateForm() {
    const formData = this.data.formData

    if (!formData.destination.trim()) {
      wx.showToast({
        title: '请输入目的地',
        icon: 'none'
      })
      return false
    }

    if (!formData.days) {
      wx.showToast({
        title: '请选择旅行天数',
        icon: 'none'
      })
      return false
    }

    if (!formData.travelers || formData.travelers <= 0) {
      wx.showToast({
        title: '请输入正确的出行人数',
        icon: 'none'
      })
      return false
    }

    if (!formData.budget || formData.budget <= 0) {
      wx.showToast({
        title: '请输入正确的预算',
        icon: 'none'
      })
      return false
    }

    return true
  },

  // 生成增强版AI提示词
  generateEnhancedPrompt() {
    const { destination, days, travelers, budget, style, specialRequirements } = this.data.formData
    
    // 获取选中的兴趣
    const selectedInterests = this.data.interests
      .filter(item => item.checked)
      .map(item => item.label)
      .join('、')

    // 详细风格配置
    const styleConfig = {
      luxury: {
        name: '轻奢型',
        accommodation: '四星级以上酒店，选择市中心或景区附近',
        dining: '当地特色餐厅和高档餐厅',
        transport: '舒适型交通，包含专车接送',
        budgetPerDay: '每天500-1000元',
        features: '注重舒适度和品质体验'
      },
      comfortable: {
        name: '舒适享受',
        accommodation: '经济舒适型酒店，交通便利区域',
        dining: '当地美食体验和特色小吃',
        transport: '便捷交通，地铁+出租车组合',
        budgetPerDay: '每天300-600元',
        features: '平衡性价比和舒适度'
      },
      premium: {
        name: '奢华体验',
        accommodation: '五星级豪华酒店，套房或行政楼层',
        dining: '高档餐厅，米其林推荐',
        transport: '专车服务，全程私人司机',
        budgetPerDay: '每天1000-2000元',
        features: '追求极致奢华体验'
      }
    }

    const currentStyle = styleConfig[style] || styleConfig.comfortable
    
    let prompt = `请为${travelers}位游客规划一次${destination}的深度旅行行程，为期${days}天，总预算${budget}元，风格为${currentStyle.name}。

【旅行基础信息】
- 目的地：${destination}
- 旅行天数：${days}天
- 出行人数：${travelers}人
- 总预算：${budget}元（${currentStyle.budgetPerDay}）
- 旅行风格：${currentStyle.name}（${currentStyle.features}）
- 兴趣偏好：${selectedInterests || '无特殊要求'}`
    
    if (specialRequirements.trim()) {
      prompt += `\n- 特殊需求：${specialRequirements}`
    }
    
    prompt += `

【详细行程要求】
请为每一天生成详细的时间安排，每个时间段必须包含以下详细信息：

**🌅 上午时段（8:00-12:00）：**
- 具体活动内容和景点游览安排
- 景点历史背景、文化特色详细介绍
- 推荐游览路线和最佳拍照点
- 实用贴士（最佳游览时间、避开人流、穿着建议等）
- 预计游览时间和深度介绍

**🍽️ 午餐时段（12:00-13:30）：**
- 推荐具体餐厅类型和菜品名称
- 当地特色美食的详细介绍和制作工艺
- 推荐就餐地点和餐厅特色
- 预计人均费用和点餐建议
- 餐厅位置和交通方式

**☀️ 下午时段（13:30-17:30）：**
- 继续景点游览或特色体验活动
- 文化体验项目或互动活动推荐
- 购物地点、特色商品和价格区间
- 当地手工艺品或纪念品推荐
- 休息点和饮品店推荐

**🍽️ 晚餐时段（18:00-19:30）：**
- 晚餐餐厅推荐，包含招牌菜品特色
- 餐厅氛围和适合场合介绍
- 具体位置、预订建议和营业时间
- 预计费用和人均消费
- 餐厅的交通方式和停车信息

**🌙 晚间时段（20:00-22:00）：**
- 夜间活动或休闲娱乐安排
- 当地夜生活和夜市推荐
- 返回酒店的交通安排
- 安全注意事项和紧急联系方式
- 第二日行程的准备工作

【住宿详细要求】
- 推荐${currentStyle.accommodation}
- 具体区域建议和地理位置优势
- 酒店特色介绍、设施配置和房间类型
- 预订建议、最佳预订时间和注意事项
- 周边配套（餐厅、超市、交通等）

【交通安排详情】
- 具体交通方式组合（地铁、公交、出租车、包车等）
- 景点间详细交通时间和路线规划
- 交通卡、套票或一日通票购买建议
- 上下班高峰期交通避让策略
- 停车信息和费用预算

【费用详细分解】
请提供每日和总体费用的详细分解：
- 往返大交通：具体金额、交通工具、时间安排
- 市内交通：每日交通费用和累计总额
- 住宿费用：${days}晚×具体金额/晚，房型和设施
- 餐饮费用：每日早中晚餐详细费用
- 门票费用：各景点门票明细和优惠政策
- 购物娱乐：预计购物费用和娱乐活动费用
- 其他杂费：应急资金、小费、通讯等

【个性化定制要求】
- 根据${selectedInterests}兴趣偏好设计主题活动
- 适合${travelers}人团队规模的互动体验
- 符合${currentStyle.name}标准的选择标准
- 特别考虑${specialRequirements ? specialRequirements : '无特殊需求'}
- 提供备选方案和应急安排

【实用信息要求】
- 当地天气情况和穿衣建议
- 必备物品清单和注意事项
- 当地语言、货币、时区等基本信息
- 紧急联系方式和求助渠道
- 网络通讯和充电设施信息

请生成一份超级详细、实用、个性化的旅行计划，确保每个时间段都有充实的体验内容和具体的实施指导，让游客能够完全按照计划执行并获得最佳旅行体验。`

    console.log('🤖 增强版AI提示词生成完成，长度:', prompt.length)
    return prompt
  },

  // 取消
  onCancel() {
    wx.navigateBack()
  },

  // 提交增强版规划
  async onSubmit() {
    if (!this.validateForm()) {
      return
    }

    if (!Auth.requireLogin()) {
      return
    }

    const userId = Auth.getCurrentUserId()

    this.setData({ isLoading: true })

    try {
      // 生成增强版AI提示词
      const userInput = this.generateEnhancedPrompt()

      console.log('🚀 增强版AI规划输入:', userInput)

      // 准备表单数据
      const selectedInterests = this.data.interests
        .filter(item => item.checked)
        .map(item => ({ label: item.label, value: item.value }))

      const formDataForAI = {
        destination: this.data.formData.destination,
        days: this.data.formData.days,
        travelers: this.data.formData.travelers,
        budget: this.data.formData.budget,
        style: this.data.formData.style,
        interests: selectedInterests,
        specialRequirements: this.data.formData.specialRequirements
      }

      console.log('📋 表单数据:', formDataForAI)

      // 调用AI规划服务
      const result = await aiIntegration.planIntelligentItinerary(userId, userInput, formDataForAI, false)

      this.setData({ isLoading: false })

      if (result.success && result.aiResponse) {
        console.log('✅ 增强版AI规划成功')
        this.showPlanResultWithOptions(result.aiResponse, result.planData, formDataForAI)
      } else {
        wx.showModal({
          title: 'AI规划提示',
          content: result.aiResponse || result.error || 'AI规划失败，请重试',
          showCancel: false,
          confirmText: '知道了'
        })
      }
    } catch (error) {
      this.setData({ isLoading: false })
      console.error('💥 增强版AI规划失败:', error)
      wx.showModal({
        title: '规划失败',
        content: '抱歉，AI规划出现错误，请稍后重试',
        showCancel: false,
        confirmText: '知道了'
      })
    }
  },

  // 显示规划结果
  showPlanResultWithOptions(aiResponse, planData, formData) {
    const content = aiResponse.length > 1000 
      ? aiResponse.substring(0, 1000) + '...\\n\\n（完整内容请在保存后查看）' 
      : aiResponse

    // 检查 planData 是否有效
    if (!planData) {
      console.warn('⚠️ 警告: planData 为空或无效，创建基础数据')
      
      // 尝试从AI响应中提取结构化数据来生成更丰富的描述
      let enhancedDescription = ''
      try {
        // 尝试解析JSON格式的行程数据
        const itineraryObj = aiIntegration.extractJSONFromText(aiResponse)
        if (itineraryObj) {
          enhancedDescription = aiIntegration.summarizeItinerary(itineraryObj, parseInt(formData.days) || 3)
        } else {
          // 如果无法解析，尝试从文本中提取关键信息
          enhancedDescription = this.extractHighlightsFromAIResponse(aiResponse, formData)
        }
      } catch (error) {
        console.warn('生成增强描述失败，使用简单描述:', error)
        enhancedDescription = aiResponse.substring(0, 300)
      }
      
      planData = {
        title: `${formData.destination || '未知目的地'}${formData.days || '3天'}游 - 增强版AI智能规划`,
        description: enhancedDescription,
        destination: formData.destination || '未知目的地',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + (parseInt(formData.days || 3) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        budget: parseFloat(formData.budget) || 0,
        totalDays: parseInt(formData.days) || 3,
        travelersCount: parseInt(formData.travelers) || 1,
        travelStyle: formData.style || 'comfortable',
        interests: formData.interests || [],
        itinerary: aiResponse,
        tags: ['AI增强规划', '详细行程'],
        transportation: '',
        accommodation: '',
        specialRequirements: formData.specialRequirements || ''
      }
    }

    // 保存当前数据
    this.currentPlanData = {
      planData: planData,
      aiResponse: aiResponse,
      formData: formData
    }

    wx.showModal({
      title: '🎉 增强版AI规划完成',
      content: content + '\\n\\n是否要保存这个详细行程规划？',
      confirmText: '保存行程',
      cancelText: '重新生成',
      success: (res) => {
        if (res.confirm) {
          this.saveCurrentPlan()
        } else {
          this.showRegenerateOption()
        }
      }
    })
  },

  // 重新生成选项
  showRegenerateOption() {
    wx.showModal({
      title: '提示',
      content: '是否要重新生成行程规划？\\n当前规划不会被保存。',
      confirmText: '重新生成',
      cancelText: '返回',
      success: (res) => {
        if (res.confirm) {
          this.onSubmit()
        } else {
          wx.navigateBack()
        }
      }
    })
  },

  // 从AI响应中提取关键信息生成描述
  extractHighlightsFromAIResponse(aiResponse, formData) {
    const totalDays = parseInt(formData.days) || 3
    const destination = formData.destination || '目的地'
    
    // 使用与主AI集成相同的分析逻辑，但处理原始文本
    const tripCharacteristics = this.analyzeAITextResponse(aiResponse)
    
    // 根据分析结果生成自然描述
    return this.generateDynamicDescription(tripCharacteristics, totalDays, destination)
  },

  // 分析AI文本响应的特点
  analyzeAITextResponse(aiResponse) {
    const analysis = {
      destinations: [],
      foodItems: [],
      culturalItems: [],
      natureActivities: [],
      specialActivities: [],
      tripHighlights: [],
      tripPace: 'moderate', // relaxed, moderate, intensive
      accommodationStyle: '',
      transportationStyle: ''
    }

    // 提取目的地和景点
    const destinationPatterns = [
      /(?:游览|参观|前往|探访)([^，。\n]{2,15}(?:景区|景点|公园|广场|古镇|古城|街道|花园|海滩|山区|湖畔))/g,
      /([^，。\n]{2,15}(?:故宫|长城|天安门|颐和园|西湖|泰山|黄山|九寨沟|张家界|丽江|凤凰|敦煌|兵马俑|外滩|西湖))/g,
      /([^，。\n]{2,15}(?:博物馆|纪念馆|展览馆|艺术馆|科技馆))/g
    ]
    
    destinationPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(aiResponse)) !== null) {
        analysis.destinations.push(match[1].trim())
      }
    })

    // 提取美食信息
    const foodPatterns = [
      /(?:品尝|享用|体验|推荐)([^，。\n]{2,12}(?:美食|料理|菜肴|小吃|特色菜|烤鸭|火锅|拉面|寿司))/g,
      /([^，。\n]{2,12}(?:餐厅|酒楼|食府|茶馆|咖啡馆|美食街|夜市))/g,
      /([A-Za-z\u4e00-\u9fa5]{2,12}(?:烤、煮、蒸、炸、炒|料理|菜)/g
    ]
    
    foodPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(aiResponse)) !== null) {
        const food = match[1].trim().replace(/[：:,]/g, '')
        if (food.length >= 2 && food.length <= 12) {
          analysis.foodItems.push(food)
        }
      }
    })

    // 提取文化元素
    const culturalPatterns = [
      /([^，。\n]{2,12}(?:文化|历史|传统|民俗|非遗|艺术|手工|工艺|表演|演出))/g,
      /([^，。\n]{2,12}(：寺庙、道观、教堂、古迹、遗址、故居))/g,
      /([^，。\n]{2,12}(?:戏曲|舞蹈|音乐|画展|展览|体验|学习))/g
    ]
    
    culturalPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(aiResponse)) !== null) {
        const cultural = match[1].trim().replace(/[：:,]/g, '')
        if (cultural.length >= 2 && cultural.length <= 12) {
          analysis.culturalItems.push(cultural)
        }
      }
    })

    // 提取自然活动
    const naturePatterns = [
      /([^，。\n]{2,12}(?:登山|徒步|露营|观景|赏花|看日出|看日落|漂流|骑行|游泳|潜水))/g,
      /([^，。\n]{2,12}(：森林公园|自然保护区|湿地公园|海滨浴场|山谷|瀑布|草原))/g
    ]
    
    naturePatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(aiResponse)) !== null) {
        const nature = match[1].trim().replace(/[：:,]/g, '')
        if (nature.length >= 2 && nature.length <= 12) {
          analysis.natureActivities.push(nature)
        }
      }
    })

    // 提取特色活动
    const specialPatterns = [
      /([^，。\n]{2,15}(：体验、感受、参与、尝试|特色|独特|特别))/g,
      /([^，。\n]{2,15}(：购物、逛街、购买、选购|娱乐、休闲、放松))/g
    ]
    
    specialPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(aiResponse)) !== null) {
        const special = match[1].trim().replace(/[：:,]/g, '')
        if (special.length >= 2 && special.length <= 15) {
          analysis.specialActivities.push(special)
        }
      }
    })

    // 提取行程亮点
    const highlightPatterns = [
      /([^，。\n]{2,15}(：必去|必看|必吃|必玩|必体验|推荐|特色|著名|知名|网红|打卡|震撼|壮观|美丽|绝美|惊艳|难忘))/g
    ]
    
    highlightPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(aiResponse)) !== null) {
        const highlight = match[1].trim().replace(/[：:,]/g, '')
        if (highlight.length >= 2 && highlight.length <= 15) {
          analysis.tripHighlights.push(highlight)
        }
      }
    })

    // 分析住宿信息
    const accommodationPatterns = [
      /([^，。\n]{2,10}(?:酒店|民宿|青年旅社|度假村|宾馆|旅店))/g
    ]
    
    accommodationPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(aiResponse)) !== null) {
        analysis.accommodationStyle = match[1].trim()
      }
    })

    // 分析交通信息
    const transportPatterns = [
      /([^，。\n]{2,10}(：飞机、高铁、动车、自驾、出租车|地铁|公交车))/g
    ]
    
    transportPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(aiResponse)) !== null) {
        analysis.transportationStyle = match[1].trim()
      }
    })

    // 去重并清理数据
    Object.keys(analysis).forEach(key => {
      if (Array.isArray(analysis[key])) {
        analysis[key] = [...new Set(analysis[key])].filter(item => item && item.length > 1)
      }
    })

    return analysis
  },

  // 生成动态描述
  generateDynamicDescription(characteristics, days, destination) {
    const { destinations, foodItems, culturalItems, natureActivities, specialActivities, tripHighlights, accommodationStyle, transportationStyle } = characteristics
    
    // 判断主要旅行主题
    let mainTheme = 'general'
    const themeScores = {
      cultural: culturalItems.length * 2,
      nature: natureActivities.length * 2,
      food: foodItems.length * 2,
      sightseeing: destinations.length,
      activities: specialActivities.length
    }
    
    mainTheme = Object.keys(themeScores).reduce((a, b) => 
      themeScores[a] > themeScores[b] ? a : b
    )

    let description = ''
    
    // 根据主题生成不同的描述框架
    switch (mainTheme) {
      case 'cultural':
        description = `为您精心打造的${days}天文化探索之旅，深入${destination}的历史底蕴。`
        if (culturalItems.length > 0) {
          description += `行程特别安排了${culturalItems.slice(0, 2).join('、')}等深度文化体验，`
        }
        if (destinations.length > 0) {
          description += `游览${destinations.slice(0, 2).join('、')}等文化地标。`
        }
        break
        
      case 'nature':
        description = `完美融合的${days}天自然生态之旅，尽享${destination}的自然风光。`
        if (natureActivities.length > 0) {
          description += `体验${natureActivities.slice(0, 2).join('、')}等户外活动，`
        }
        if (destinations.length > 0) {
          description += `欣赏${destinations.slice(0, 2).join('、')}等自然奇观。`
        }
        break
        
      case 'food':
        description = `令人期待的${days}天美食探索之旅，品味${destination}的地道风味。`
        if (foodItems.length > 0) {
          description += `精心安排${foodItems.slice(0, 3).join('、')}等特色美食体验，`
        }
        if (destinations.length > 0) {
          description += `在游览${destinations.slice(0, 2).join('、')}的同时享受味蕾盛宴。`
        }
        break
        
      case 'sightseeing':
        description = `经典全面的${days}天观光游览行程，深度体验${destination}的城市魅力。`
        if (destinations.length > 0) {
          description += `涵盖${destinations.slice(0, 3).join('、')}等必游景点，`
        }
        description += '让您不错过任何精彩瞬间。'
        break
        
      default:
        description = `为您量身定制的${days}天${destination}精彩行程，`
        if (destinations.length > 0) {
          description += `游览${destinations.slice(0, 2).join('、')}等著名景点，`
        }
        if (foodItems.length > 0) {
          description += `品尝${foodItems.slice(0, 2).join('、')}等地方特色，`
        }
        description += '体验多元化的旅行乐趣。'
    }

    // 添加住宿和交通信息
    if (accommodationStyle) {
      description += `精选${accommodationStyle}住宿，`
    }
    if (transportationStyle) {
      description += `安排便捷的${transportationStyle}出行，`
    }

    // 添加亮点
    if (tripHighlights.length > 0) {
      description += `行程中的${tripHighlights.slice(0, 2).join('、')}等特色安排，将为您的旅程增添难忘回忆。`
    }

    // 实用的结尾
    description += `每日行程节奏适中，既保证了深度体验，又留有充足的个人时间，让您真正享受旅行的美好。`

    return description
  },

  // 保存当前计划
  async saveCurrentPlan() {
    if (!this.currentPlanData) {
      wx.showToast({
        title: '数据丢失',
        icon: 'none'
      })
      return
    }

    if (this.isSaving) {
      console.log('⏳ 正在保存中，跳过重复调用')
      return
    }

    this.isSaving = true
    const userId = Auth.getCurrentUserId()
    
    this.setData({ isLoading: true })

    try {
      console.log('💾 开始保存增强版行程，标题:', this.currentPlanData.planData.title)
      
      const result = await aiIntegration.savePlanOnly(userId, this.currentPlanData.planData)

      this.setData({ isLoading: false })
      this.isSaving = false

      if (result.success) {
        console.log('✅ 增强版行程保存成功，ID:', result.data?.id)
        
        wx.showToast({
          title: '保存成功',
          icon: 'success',
          duration: 1500
        })

        // 清除数据，防止重复保存
        this.currentPlanData = null

        // 延迟返回并刷新列表
        setTimeout(() => {
          wx.navigateBack({
            success: () => {
              // 通知上一个页面刷新数据
              const pages = getCurrentPages()
              const prevPage = pages[pages.length - 2]
              if (prevPage && prevPage.loadTravelPlans) {
                console.log('🔄 通知上一页刷新行程列表')
                prevPage.loadTravelPlans()
              }
            }
          })
        }, 1500)
      } else {
        this.isSaving = false
        wx.showModal({
          title: '保存失败',
          content: result.error || '保存行程时出现错误，请重试',
          showCancel: false
        })
      }

    } catch (error) {
      this.setData({ isLoading: false })
      this.isSaving = false
      console.error('💥 保存增强版行程失败:', error)
      wx.showModal({
        title: '保存异常',
        content: error.message,
        showCancel: false
      })
    }
  }
})