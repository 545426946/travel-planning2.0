// AI规划页面调试版本 - 用于排查保存问题
const Auth = require('../../utils/auth').Auth
const aiIntegration = require('../../utils/ai-integration').aiIntegration
const db = require('../../utils/database').db

Page({
  data: {
    // 复用原有数据结构
    formData: {
      destination: '',
      days: '',
      daysIndex: 0,
      travelers: '',
      budget: '',
      style: 'comfortable',
      specialRequirements: ''
    },
    
    dayOptions: ['1天', '2天', '3天', '4天', '5天', '6天', '7天', '8天', '9天', '10天', '10天以上'],
    
    interests: [
      { label: '文化历史', value: 'culture', checked: false },
      { label: '自然风光', value: 'nature', checked: false },
      { label: '美食体验', value: 'food', checked: false },
      { label: '购物娱乐', value: 'shopping', checked: false },
      { label: '冒险探索', value: 'adventure', checked: false },
      { label: '放松度假', value: 'relax', checked: false }
    ],
    
    styles: [
      { label: '轻奢型', value: 'luxury' },
      { label: '舒适享受', value: 'comfortable' },
      { label: '奢华体验', value: 'premium' }
    ],
    
    isLoading: false
  },

  onLoad(options) {
    console.log('🔍 AI规划调试页面加载')
  },

  // 表单验证（简化版）
  validateForm() {
    const { destination, days, travelers, budget } = this.data.formData
    if (!destination.trim() || !days || !travelers || !budget) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return false
    }
    return true
  },

  // 简化的AI提示词生成
  generateSimplePrompt() {
    const { destination, days, travelers, budget } = this.data.formData
    return `请为我规划${destination}${days}的行程，${travelers}人，预算${budget}元。请生成详细的每日行程安排。`
  },

  // 测试AI生成（不保存）
  async testAIOnly() {
    if (!this.validateForm()) return

    if (!Auth.requireLogin()) return

    this.setData({ isLoading: true })

    try {
      const userInput = this.generateSimplePrompt()
      console.log('🤖 AI请求输入:', userInput)

      // 直接调用AI服务，不保存
      const result = await aiIntegration.planIntelligentItinerary(
        Auth.getCurrentUserId(), 
        userInput, 
        this.data.formData, 
        false // 不自动保存
      )

      this.setData({ isLoading: false })

      if (result.success && result.aiResponse) {
        console.log('✅ AI响应成功:', result.aiResponse)
        console.log('📊 解析后的计划数据:', result.planData)
        
        // 显示AI响应
        this.showDebugResult(result)
      } else {
        console.error('❌ AI响应失败:', result)
        wx.showModal({
          title: 'AI生成失败',
          content: result.error || 'AI生成失败，请重试',
          showCancel: false
        })
      }
    } catch (error) {
      this.setData({ isLoading: false })
      console.error('💥 AI生成异常:', error)
      wx.showModal({
        title: '生成异常',
        content: error.message,
        showCancel: false
      })
    }
  },

  // 显示调试结果
  showDebugResult(result) {
    const content = `AI生成成功！

📝 AI响应长度: ${result.aiResponse?.length || 0} 字符
📊 计划数据: ${result.planData ? '已解析' : '未解析'}
🏷️ 标题: ${result.planData?.title || '无'}
🎯 目的地: ${result.planData?.destination || '无'}
💰 预算: ${result.planData?.budget || 0}
📅 天数: ${result.planData?.totalDays || 0}
👥 人数: ${result.planData?.travelersCount || 0}

是否继续测试保存功能？`

    this.debugData = result // 保存调试数据

    wx.showModal({
      title: '🔍 调试信息',
      content: content,
      confirmText: '测试保存',
      cancelText: '仅查看',
      success: (res) => {
        if (res.confirm && this.debugData?.planData) {
          this.testSaveOnly(this.debugData.planData)
        }
      }
    })
  },

  // 仅测试保存功能
  async testSaveOnly(planData) {
    if (!planData) {
      wx.showToast({ title: '没有可保存的数据', icon: 'none' })
      return
    }

    console.log('💾 开始测试保存功能')
    console.log('📦 准备保存的数据:', JSON.stringify(planData, null, 2))

    const userId = Auth.getCurrentUserId()
    console.log('👤 当前用户ID:', userId)

    this.setData({ isLoading: true })

    try {
      // 方法1：使用 aiIntegration.savePlanOnly
      console.log('🔄 方法1: 使用 aiIntegration.savePlanOnly')
      const result1 = await aiIntegration.savePlanOnly(userId, planData)
      console.log('📈 方法1结果:', result1)

      if (result1.success) {
        this.setData({ isLoading: false })
        wx.showModal({
          title: '✅ 保存成功',
          content: `行程ID: ${result1.data?.id}\n标题: ${result1.data?.title}`,
          showCancel: false
        })
        return
      } else {
        console.warn('⚠️ 方法1失败，尝试方法2')
      }

      // 方法2：直接使用数据库
      console.log('🔄 方法2: 直接使用 db.travelPlans.create')
      const result2 = await db.travelPlans.create(planData)
      console.log('📈 方法2结果:', result2)

      this.setData({ isLoading: false })

      if (result2.data) {
        wx.showModal({
          title: '✅ 保存成功',
          content: `行程ID: ${result2.data?.id}\n标题: ${result2.data?.title}`,
          showCancel: false
        })
      } else {
        wx.showModal({
          title: '❌ 保存失败',
          content: `方法1错误: ${result1.error || '无'}\n方法2错误: ${result2.error?.message || '无'}`,
          showCancel: false
        })
      }

    } catch (error) {
      this.setData({ isLoading: false })
      console.error('💥 保存过程异常:', error)
      wx.showModal({
        title: '💥 保存异常',
        content: error.message,
        showCancel: false
      })
    }
  },

  // 复用原有的表单方法
  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`formData.${field}`]: value
    })
  },

  onDayChange(e) {
    this.setData({
      'formData.days': this.data.dayOptions[e.detail.value],
      'formData.daysIndex': e.detail.value
    })
  },

  onStyleChange(e) {
    this.setData({
      'formData.style': e.detail.value
    })
  },

  onInterestToggle(e) {
    const index = e.currentTarget.dataset.index
    const interests = [...this.data.interests]
    interests[index].checked = !interests[index].checked
    this.setData({ interests })
  },

  // 快速填充测试数据
  fillTestData() {
    this.setData({
      'formData.destination': '北京',
      'formData.days': '3天',
      'formData.daysIndex': 2,
      'formData.travelers': '2',
      'formData.budget': '3000',
      'formData.style': 'comfortable',
      'formData.specialRequirements': '希望游览故宫和长城'
    })
  },

  goBack() {
    wx.navigateBack()
  }
})