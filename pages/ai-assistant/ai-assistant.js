// pages/ai-assistant/ai-assistant.js
const aiIntegration = require('../../utils/ai-integration').aiIntegration
const app = getApp()

Page({
  data: {
    userInfo: null,
    currentTab: 0,
    chatHistory: [],
    inputValue: '',
    quickQuestions: [
      '云南最佳旅游时间是什么时候？',
      '去日本旅游需要准备什么？',
      '如何制定完美的旅行计划？',
      '国内有哪些必去的景点？'
    ],
    isLoading: false,
    scrollToView: ''
  },

  onLoad() {
    console.log('AI助手页面加载')
    
    // 获取用户信息
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({ userInfo })
    }
    
    // 初始化聊天记录
    this.initChatHistory()
  },

  onShow() {
    // 页面显示时滚动到底部
    this.scrollToBottom()
  },

  // 初始化聊天记录
  initChatHistory() {
    const savedHistory = wx.getStorageSync('aiChatHistory') || []
    this.setData({ chatHistory: savedHistory })
  },

  // 切换功能Tab
  switchTab(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentTab: index })
  },

  // 处理输入
  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  // 发送消息
  async sendMessage() {
    const message = this.data.inputValue.trim()
    if (!message) return

    // 添加用户消息到聊天记录
    const newHistory = this.data.chatHistory.slice()
    newHistory.push({
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    })

    this.setData({ 
      chatHistory: newHistory,
      inputValue: '',
      isLoading: true 
    })

    this.scrollToBottom()

    try {
      // 调用AI服务
      const result = await aiIntegration.askTravelQuestion(
        this.data.userInfo?.id,
        message,
        { page: 'ai-assistant' }
      )

      if (result.success) {
        // 添加AI回复
        newHistory.push({
          type: 'ai',
          content: result.answer,
          timestamp: new Date().toISOString()
        })

        this.setData({ chatHistory: newHistory })
        this.saveChatHistory(newHistory)
      } else {
        // 显示错误消息
        newHistory.push({
          type: 'error',
          content: '抱歉，AI服务暂时不可用，请稍后再试。',
          timestamp: new Date().toISOString()
        })

        this.setData({ chatHistory: newHistory })
      }
    } catch (error) {
      console.error('AI对话失败:', error)
      
      // 显示错误消息
      newHistory.push({
        type: 'error',
        content: '网络连接失败，请检查网络后重试。',
        timestamp: new Date().toISOString()
      })

      this.setData({ chatHistory: newHistory })
    } finally {
      this.setData({ isLoading: false })
      this.scrollToBottom()
    }
  },

  // 智能规划行程
  async planItinerary() {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: 'AI 智能规划',
      content: '请描述您的旅行需求，我会为您制定详细行程',
      editable: true,
      placeholderText: '例如：我想去云南大理丽江玩5天，预算3000元，喜欢自然风光和古镇文化',
      success: async (res) => {
        if (res.confirm && res.content.trim()) {
          wx.showLoading({ title: 'AI 正在规划...' })

          try {
            const result = await aiIntegration.planIntelligentItinerary(
              this.data.userInfo.id,
              res.content,
              {}, // 空的表单数据
              false // 不保存到数据库
            )

            wx.hideLoading()

            if (result.success && result.planData) {
              // 显示详细的规划结果
              this.showDetailedPlanResult(result.planData, result.aiResponse)
            } else {
              wx.showModal({
                title: '规划建议',
                content: result.aiResponse.substring(0, 500) + '...',
                showCancel: false
              })
            }
          } catch (error) {
            wx.hideLoading()
            console.error('AI规划失败:', error)
            wx.showToast({
              title: '规划失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 查询天气
  async queryWeather() {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '天气查询',
      content: '请输入要查询的城市名称',
      editable: true,
      placeholderText: '例如：北京、上海、广州',
      success: async (res) => {
        if (res.confirm && res.content.trim()) {
          wx.showLoading({ title: '查询天气中...' })

          try {
            const { weatherService } = require('../../utils/weather-service')
            const city = res.content.trim()
            const result = await weatherService.getWeather(city)

            wx.hideLoading()

            if (result.success) {
              this.showWeatherResult(result.data)
            } else {
              // 显示模拟数据
              this.showWeatherResult(result.data)
              wx.showToast({
                title: '使用模拟数据',
                icon: 'none'
              })
            }
          } catch (error) {
            wx.hideLoading()
            console.error('天气查询失败:', error)
            wx.showToast({
              title: '查询失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 显示天气结果
  showWeatherResult(weatherData) {
    const current = weatherData.current
    const forecast = weatherData.forecast
    
    let content = `
🌤️ ${weatherData.city} 天气信息

📍 当前天气：
${current.icon} ${current.weather} ${current.temperature}
💧 湿度：${current.humidity}
💨 风力：${current.wind}
🔵 气压：${current.pressure}
👁️ 能见度：${current.visibility}
☀️ 紫外线：${current.uv}

📅 未来预报：
`

    // 添加未来几天的预报
    forecast.slice(0, 5).forEach(day => {
      content += `${day.date}：${day.icon} ${day.weather} ${day.low} ~ ${day.high} ${day.wind}
`
    })

    // 添加穿衣和出行建议
    const { weatherService } = require('../../utils/weather-service')
    const clothingAdvice = weatherService.getClothingAdvice(weatherData)
    const travelAdvice = weatherService.getTravelAdvice(weatherData)

    content += `
👔 穿衣建议：${clothingAdvice}
🚗 出行建议：${travelAdvice}

更新时间：${new Date(weatherData.updateTime).toLocaleString()}
`

    if (weatherData.mock) {
      content += '\n⚠️ 当前为模拟数据，仅供演示使用'
    }

    wx.showModal({
      title: '🌤️ 天气查询结果',
      content: content.trim(),
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 智能推荐景点
  async getRecommendations() {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: 'AI 正在分析...' })

    try {
      const result = await aiIntegration.getSmartDestinationRecommendations(
        this.data.userInfo.id
      )

      wx.hideLoading()

      if (result.success) {
        wx.showModal({
          title: '智能推荐',
          content: 'AI 已根据您的偏好生成推荐，是否查看详情？',
          success: (res) => {
            if (res.confirm) {
              this.showRecommendations(result)
            }
          }
        })
      } else {
        wx.showToast({
          title: '推荐获取失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('获取推荐失败:', error)
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    }
  },

  // 快速提问
  quickQuestion(e) {
    const question = e.currentTarget.dataset.question
    this.setData({ inputValue: question })
    this.sendMessage()
  },

  // 清空聊天记录
  clearChat() {
    wx.showModal({
      title: '清空对话',
      content: '确定要清空所有对话记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ chatHistory: [] })
          wx.removeStorageSync('aiChatHistory')
          wx.showToast({
            title: '已清空',
            icon: 'success'
          })
        }
      }
    })
  },

  // 保存聊天记录
  saveChatHistory(history) {
    // 只保存最近50条消息
    const recentHistory = history.slice(-50)
    wx.setStorageSync('aiChatHistory', recentHistory)
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      const query = wx.createSelectorQuery()
      query.select('.chat-container').boundingClientRect()
      query.selectAll('.message-item').boundingClientRect()
      query.exec((res) => {
        if (res[0] && res[1] && res[1].length > 0) {
          const lastMessage = res[1][res[1].length - 1]
          const scrollTop = lastMessage.bottom - res[0].height + 100
          
          wx.pageScrollTo({
            scrollTop: scrollTop > 0 ? scrollTop : 0,
            duration: 300
          })
        }
      })
    }, 100)
  },

  // 显示详细的规划结果
  showDetailedPlanResult(planData, aiResponse) {
    const itinerary = this.parseItinerarySummary(planData.itinerary)
    const content = `
🗺️ AI为您规划的详细行程

📍 目的地：${planData.destination}
📅 时间：${planData.startDate} 至 ${planData.endDate} (${planData.totalDays}天)
💰 预算：¥${planData.budget} (实际估算：¥${this.calculateEstimatedCost(planData)})
👥 人数：${planData.travelersCount}人
🎯 主题：${planData.travelStyle}

📋 详细行程：
${itinerary}

🚗 交通：${planData.transportation || '待安排'}
🏨 住宿：${planData.accommodation || '待安排'}
🍽️ 餐饮：包含在当地消费中

⚠️ 费用说明：
• 住宿按经济型酒店计算
• 餐饮含当地特色和日常用餐
• 景点门票按旺季价格估算
• 交通含市内公交/地铁费用
💡 温馨提示：
• 具体费用因季节和个人消费习惯有差异
• 建议提前预订热门景点门票
• 请关注当地天气情况
• 可根据实际需求调整行程
    `.trim()

    wx.showModal({
      title: '🌟 您的专属行程规划',
      content,
      showCancel: true,
      cancelText: '重新规划',
      confirmText: '保存行程',
      success: (res) => {
        if (res.confirm) {
          this.saveAIGeneratedPlan(planData)
        } else {
          // 重新规划
          this.generateTravelPlan()
        }
      }
    })
  },

  // 显示规划结果 (兼容旧版本)
  showPlanResult(result) {
    if (result.planData) {
      this.showDetailedPlanResult(result.planData, result.aiResponse)
    } else if (result.data) {
      this.showDetailedPlanResult(result.data, result.aiResponse)
    } else {
      // 旧版本处理逻辑
      const content = result.aiResponse.length > 500 
        ? result.aiResponse.substring(0, 500) + '...' 
        : result.aiResponse

      wx.showModal({
        title: 'AI 行程规划结果',
        content: content,
        showCancel: false,
        confirmText: '复制完整内容',
        success: () => {
          wx.setClipboardData({
            data: result.aiResponse,
            success: () => {
              wx.showToast({
                title: '已复制到剪贴板',
                icon: 'success'
              })
            }
          })
        }
      })
    }
  },

  // 解析行程概要
  parseItinerarySummary(itinerary) {
    try {
      const itineraryObj = typeof itinerary === 'string' ? JSON.parse(itinerary) : itinerary
      let summary = ''
      
      if (itineraryObj && typeof itineraryObj === 'object') {
        Object.keys(itineraryObj).forEach((day, index) => {
          if (itineraryObj[day]) {
            summary += `Day ${index + 1}: ${itineraryObj[day].substring(0, 100)}...
`
          }
        })
      }
      
      return summary || '详细行程安排已生成，保存后可查看完整内容'
    } catch (error) {
      console.error('解析行程概要失败:', error)
      return '详细行程安排已生成，保存后可查看完整内容'
    }
  },

  // 计算预估费用
  calculateEstimatedCost(planData) {
    try {
      const { aiIntegration } = require('../../utils/ai-integration')
      const baseBudget = parseFloat(planData.budget) || 0
      const days = parseInt(planData.totalDays) || 1
      const travelers = parseInt(planData.travelersCount) || 1
      
      // 如果有详细行程，尝试解析费用明细
      if (planData.itinerary) {
        const detailedBudget = aiIntegration.extractDetailedBudget(planData.itinerary)
        if (detailedBudget.total > 0) {
          return detailedBudget.total
        }
      }
      
      // 根据目的地级别调整基础费用
      let destinationMultiplier = 1.0
      const destination = planData.destination || ''
      if (destination.includes('北京') || destination.includes('上海') || destination.includes('广州') || destination.includes('深圳')) {
        destinationMultiplier = 1.3 // 一线城市
      } else if (destination.includes('成都') || destination.includes('杭州') || destination.includes('西安') || destination.includes('重庆')) {
        destinationMultiplier = 1.1 // 新一线城市
      }
      
      // 基础费用计算（更符合实际）
      let estimatedCost = baseBudget
      
      // 住宿费用 (经济型酒店标准)
      const accommodationPerNight = travelers > 1 ? 250 : 180
      estimatedCost += (days - 1) * accommodationPerNight
      
      // 餐饮费用 (当地标准)
      const diningPerDay = travelers * (destinationMultiplier > 1.2 ? 120 : 80)
      estimatedCost += days * diningPerDay
      
      // 市内交通费用
      const localTransportPerDay = destinationMultiplier > 1.2 ? 50 : 30
      estimatedCost += days * localTransportPerDay
      
      // 景点门票费用（平均）
      const ticketsPerDay = destinationMultiplier > 1.2 ? 150 : 100
      estimatedCost += days * ticketsPerDay
      
      // 往返大交通（预估）
      const longDistanceTransport = destinationMultiplier > 1.2 ? 800 : 500
      estimatedCost += longDistanceTransport
      
      // 应急和其他费用
      estimatedCost += days * 50
      
      return Math.round(estimatedCost * destinationMultiplier)
    } catch (error) {
      console.error('计算费用失败:', error)
      return planData.budget || '待估算'
    }
  },

  // 保存AI生成的计划
  async saveAIGeneratedPlan(planData) {
    try {
      wx.showLoading({ title: '保存中...' })
      
      const { aiIntegration } = require('../../utils/ai-integration')
      const result = await aiIntegration.planIntelligentItinerary(
        this.data.userInfo.id,
        `保存${planData.destination}行程`,
        planData,
        true // 保存到数据库
      )

      wx.hideLoading()

      if (result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })

        // 询问是否查看详情
        setTimeout(() => {
          wx.showModal({
            title: '行程已保存',
            content: '是否前往查看行程详情？',
            success: (res) => {
              if (res.confirm && result.data) {
                wx.navigateTo({
                  url: `/pages/plan-detail/plan-detail?id=${result.data.id}`
                })
              }
            }
          })
        }, 1500)
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('保存计划失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 显示推荐结果
  showRecommendations(result) {
    const recommendations = result.recommendations.destinations || []
    
    if (recommendations.length === 0) {
      wx.showToast({
        title: '暂无推荐',
        icon: 'none'
      })
      return
    }

    const content = recommendations.slice(0, 5).map((dest, index) => 
      `${index + 1}. ${dest.name || '推荐景点'}`
    ).join('\n')

    wx.showModal({
      title: 'AI 智能推荐',
      content: content + '\n\n更多推荐请在首页查看',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: 'AI旅行助手 - 智能规划您的完美旅程',
      path: '/pages/ai-assistant/ai-assistant'
    }
  }
})