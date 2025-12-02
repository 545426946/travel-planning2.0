// pages/ai-plan/ai-plan.js
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
    console.log('AI规划页面加载')
  },

  // 目的地输入
  onDestinationInput(e) {
    this.setData({
      'formData.destination': e.detail.value
    })
  },

  // 天数选择
  onDaysChange(e) {
    const index = e.detail.value
    this.setData({
      'formData.daysIndex': index,
      'formData.days': this.data.dayOptions[index]
    })
  },

  // 出行人数输入
  onTravelersInput(e) {
    this.setData({
      'formData.travelers': e.detail.value
    })
  },

  // 预算输入
  onBudgetInput(e) {
    this.setData({
      'formData.budget': e.detail.value
    })
  },

  // 兴趣偏好点击
  onInterestTap(e) {
    const index = e.currentTarget.dataset.index
    const interests = this.data.interests
    interests[index].checked = !interests[index].checked
    this.setData({ interests })
  },

  // 旅行风格点击
  onStyleTap(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      'formData.style': value
    })
  },

  // 特殊要求输入
  onSpecialRequirementsInput(e) {
    this.setData({
      'formData.specialRequirements': e.detail.value
    })
  },

  // 表单验证
  validateForm() {
    const { destination, days, travelers, budget } = this.data.formData

    if (!destination.trim()) {
      wx.showToast({
        title: '请输入目的地',
        icon: 'none'
      })
      return false
    }

    if (!days) {
      wx.showToast({
        title: '请选择旅行天数',
        icon: 'none'
      })
      return false
    }

    if (!travelers || travelers <= 0) {
      wx.showToast({
        title: '请输入正确的出行人数',
        icon: 'none'
      })
      return false
    }

    if (!budget || budget <= 0) {
      wx.showToast({
        title: '请输入正确的预算',
        icon: 'none'
      })
      return false
    }

    return true
  },

  // 生成AI提示词
  generatePrompt() {
    const { destination, days, travelers, budget, style, specialRequirements } = this.data.formData
    
    // 获取选中的兴趣
    const selectedInterests = this.data.interests
      .filter(item => item.checked)
      .map(item => item.label)
      .join('、')

    // 风格映射和详细要求
    const styleMap = {
      luxury: {
        name: '轻奢型',
        accommodation: '四星级以上酒店',
        dining: '当地特色餐厅',
        transport: '舒适型交通'
      },
      comfortable: {
        name: '舒适享受',
        accommodation: '经济舒适型酒店',
        dining: '当地美食体验',
        transport: '便捷交通'
      },
      premium: {
        name: '奢华体验',
        accommodation: '五星级豪华酒店',
        dining: '高档餐厅',
        transport: '专车服务'
      }
    }

    const currentStyle = styleMap[style] || styleMap.comfortable
    
    let prompt = `请为我规划一次${destination}的详细旅行行程。

基础信息：
- 目的地：${destination}
- 旅行天数：${days}
- 出行人数：${travelers}人
- 总预算：${budget}元
- 旅行风格：${currentStyle.name}
- 兴趣爱好：${selectedInterests || '无特殊要求'}
`
    
    if (specialRequirements.trim()) {
      prompt += `- 特殊要求：${specialRequirements}
`
    }
    
    prompt += `
请按照以下要求生成详细行程：
1. 时间安排精确到具体时间段（上午8:00-12:00，下午13:00-17:00，晚上18:00-22:00）
2. 费用估算要符合实际（住宿${currentStyle.accommodation}，餐饮${currentStyle.dining}，交通${currentStyle.transport}）
3. 包含当地特色美食推荐
4. 考虑景点之间的交通时间
5. 提供实用的旅行贴士
6. 每日行程要合理，不要过于赶时间
7. 景点推荐要符合${travelers}人的游玩体验

请生成完整的旅行计划，包含详细的费用明细。`
    
    return prompt
  },

  // 取消
  onCancel() {
    wx.navigateBack()
  },

  // 提交
  async onSubmit() {
    // 验证表单
    if (!this.validateForm()) {
      return
    }

    // 检查登录状态
    if (!Auth.requireLogin()) {
      return
    }

    const userId = Auth.getCurrentUserId()

    this.setData({ isLoading: true })

    try {
      // 生成AI提示词
      const userInput = this.generatePrompt()

      console.log('AI规划输入:', userInput)

      // 准备表单数据传递给AI
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

      console.log('表单数据:', formDataForAI)

      // 调用AI规划服务（传入表单数据，不自动保存）
      const result = await aiIntegration.planIntelligentItinerary(userId, userInput, formDataForAI, false)

      this.setData({ isLoading: false })

      if (result.success && result.aiResponse) {
        // 显示AI规划结果，让用户选择是否保存
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
      console.error('AI规划失败:', error)
      wx.showModal({
        title: '规划失败',
        content: '抱歉，AI规划出现错误，请稍后重试',
        showCancel: false,
        confirmText: '知道了'
      })
    }
  },

  // 显示规划结果并提供建议选项
  showPlanResultWithOptions(aiResponse, planData, formData) {
    // 检查 planData 是否有效
    if (!planData) {
      console.warn('警告: planData 为空或无效')
      // 创建一个基本的 planData
      planData = {
        title: `${formData.destination || '未知目的地'}${formData.days || '3天'}游 - AI智能规划`,
        description: aiResponse.substring(0, 200),
        destination: formData.destination || '未知目的地',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + (parseInt(formData.days || 3) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        budget: parseFloat(formData.budget) || 0,
        totalDays: parseInt(formData.days) || 3,
        travelersCount: parseInt(formData.travelers) || 1,
        travelStyle: formData.style || 'comfortable',
        interests: formData.interests || [],
        itinerary: aiResponse,
        tags: ['AI规划'],
        transportation: '',
        accommodation: '',
        specialRequirements: formData.specialRequirements || ''
      }
    }

    // 保存当前数据到实例变量
    this.currentPlanData = {
      planData: planData,
      aiResponse: aiResponse,
      formData: formData
    }

    // 直接显示生成完成的简单提示，不展示复杂的JSON内容
    wx.showModal({
      title: '🎉 AI规划完成',
      content: `已为您完成${formData.destination}${formData.days}的详细行程规划，包含每日具体安排、费用预算和实用建议。是否保存此行程？`,
      confirmText: '保存行程',
      cancelText: '重新生成',
      success: (res) => {
        if (res.confirm) {
          // 用户选择保存
          this.saveCurrentPlan()
        } else {
          // 用户选择重新生成，显示提示
          wx.showModal({
            title: '提示',
            content: '是否要重新生成行程规划？\n当前规划不会被保存。',
            confirmText: '重新生成',
            cancelText: '返回',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 重新生成 - 直接重新调用提交
                this.onSubmit()
              } else {
                // 返回上一页
                wx.navigateBack()
              }
            }
          })
        }
      }
    })
  },

  // 显示规划结果（原有方法保留作为备用）
  showPlanResult(aiResponse, planData) {
    wx.showModal({
      title: '🎉 AI规划完成',
      content: '您的行程规划已生成完成！\n\n建议您保存此行程，以便在"我的行程"中查看详细内容。',
      showCancel: false,
      confirmText: '查看详情',
      success: (res) => {
        if (res.confirm && planData && planData.id) {
          // 跳转到行程详情页（如果有的话）
          console.log('查看行程详情:', planData.id)
        }
      }
    })
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

    // 防止重复保存
    if (this.isSaving) {
      console.log('正在保存中，跳过重复调用')
      return
    }

    this.isSaving = true
    const userId = Auth.getCurrentUserId()
    
    this.setData({ isLoading: true })

    try {
      console.log('开始保存行程，标题:', this.currentPlanData.planData.title)
      
      // 调用保存服务
      const result = await aiIntegration.savePlanOnly(userId, this.currentPlanData.planData)

      this.setData({ isLoading: false })
      this.isSaving = false

      if (result.success) {
        console.log('行程保存成功，ID:', result.data?.id)
        
        wx.showToast({
          title: '保存成功',
          icon: 'success',
          duration: 1500
        })

        // 清除当前数据，防止重复保存
        this.currentPlanData = null

        // 延迟返回并刷新列表
        setTimeout(() => {
          wx.navigateBack({
            success: () => {
              // 通知上一个页面刷新数据
              const pages = getCurrentPages()
              const prevPage = pages[pages.length - 2]
              if (prevPage && prevPage.loadTravelPlans) {
                console.log('通知上一页刷新行程列表')
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
          showCancel: false,
          confirmText: '知道了'
        })
      }
    } catch (error) {
      this.setData({ isLoading: false })
      this.isSaving = false
      console.error('保存行程失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  }
})
