// 手动创建行程页面
const Auth = require('../../utils/auth').Auth
// 使用真实的 Supabase 连接（需要配置域名白名单）
const supabase = require('../../utils/supabase').supabase
// const supabase = require('../../utils/supabase-mock').supabase

Page({
  data: {
    // 是否编辑模式
    isEdit: false,
    planId: null,
    
    // 表单数据
    formData: {
      title: '',
      destination: '',
      startDate: '',
      endDate: '',
      travelers: 1,
      budget: '',
      travelStyle: 'comfortable',
      description: '',
      tags: [],
      transportation: '',
      accommodation: '',
      specialRequirements: ''
    },

    // 日期范围
    minDate: new Date().toISOString().split('T')[0],
    
    // 旅行风格选项
    styleOptions: [
      { value: 'budget', label: '经济实惠' },
      { value: 'comfortable', label: '舒适享受' },
      { value: 'luxury', label: '轻奢型' },
      { value: 'premium', label: '奢华体验' }
    ],

    // 当前选中的风格索引
    selectedStyleIndex: 1, // 默认选中 comfortable

    // 常用标签
    commonTags: [
      '自由行', '跟团游', '亲子游', '蜜月游', 
      '毕业游', '美食之旅', '文化探索', '户外探险',
      '海岛度假', '城市观光', '乡村体验'
    ],

    // 表单验证错误
    errors: {},
    
    // 提交状态
    submitting: false
  },

  onLoad(options) {
    // 检查是否为编辑模式
    if (options.id) {
      this.setData({ 
        isEdit: true, 
        planId: options.id 
      })
      this.loadPlanData(options.id)
    }

    // 设置默认日期
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    this.setData({
      'formData.startDate': today.toISOString().split('T')[0],
      'formData.endDate': nextWeek.toISOString().split('T')[0]
    })
  },

  // 加载行程数据（编辑模式）
  async loadPlanData(planId) {
    const userId = Auth.getCurrentUserId()
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('travel_plans')
        .select('*')
        .eq('id', planId)
        .eq('user_id', userId)
        .single()

      if (error) throw error

      if (data) {
        // 找到对应的风格索引
        const travelStyle = data.travel_style || 'comfortable'
        const styleIndex = this.data.styleOptions.findIndex(item => item.value === travelStyle)
        
        this.setData({
          formData: {
            title: data.title || '',
            destination: data.destination || '',
            startDate: data.start_date || '',
            endDate: data.end_date || '',
            travelers: data.travelers_count || 1,
            budget: data.total_budget ? String(data.total_budget) : '',
            travelStyle: travelStyle,
            description: data.description || '',
            tags: data.tags || [],
            transportation: data.transportation || '',
            accommodation: data.accommodation || '',
            specialRequirements: data.special_requirements || ''
          },
          selectedStyleIndex: styleIndex >= 0 ? styleIndex : 1
        })
      }
    } catch (error) {
      console.error('加载行程数据失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 输入框变化
  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`formData.${field}`]: value,
      [`errors.${field}`]: '' // 清除错误
    })
  },

  // 日期选择
  onDateChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`formData.${field}`]: value,
      [`errors.${field}`]: ''
    })
  },

  // 人数调整
  onTravelersChange(e) {
    const travelers = parseInt(e.detail.value) || 1
    this.setData({
      'formData.travelers': Math.max(1, Math.min(99, travelers))
    })
  },

  // 风格选择
  onStyleChange(e) {
    const index = parseInt(e.detail.value)
    const style = this.data.styleOptions[index].value
    this.setData({
      'formData.travelStyle': style,
      selectedStyleIndex: index
    })
  },

  // 标签选择
  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = this.data.formData.tags || []
    const index = tags.indexOf(tag)
    
    if (index > -1) {
      // 移除标签
      tags.splice(index, 1)
    } else {
      // 添加标签
      tags.push(tag)
    }
    
    this.setData({
      'formData.tags': tags
    })
  },

  // 添加自定义标签
  addCustomTag() {
    wx.showModal({
      title: '添加标签',
      editable: true,
      placeholderText: '请输入标签名称',
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          const tags = this.data.formData.tags || []
          const newTag = res.content.trim()
          
          if (!tags.includes(newTag)) {
            tags.push(newTag)
            this.setData({
              'formData.tags': tags
            })
          }
        }
      }
    })
  },

  // 表单验证
  validateForm() {
    const { formData } = this.data
    const errors = {}
    
    if (!formData.title?.trim()) {
      errors.title = '请输入行程标题'
    }
    
    if (!formData.destination?.trim()) {
      errors.destination = '请输入目的地'
    }
    
    if (!formData.startDate) {
      errors.startDate = '请选择开始日期'
    }
    
    if (!formData.endDate) {
      errors.endDate = '请选择结束日期'
    }
    
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        errors.endDate = '结束日期不能早于开始日期'
      }
    }
    
    if (!formData.budget || parseFloat(formData.budget) <= 0) {
      errors.budget = '请输入有效的预算'
    }
    
    this.setData({ errors })
    
    if (Object.keys(errors).length > 0) {
      wx.showToast({
        title: '请检查表单',
        icon: 'none'
      })
      return false
    }
    
    return true
  },

  // 提交表单
  async submitForm() {
    // 检查登录
    if (!Auth.requireLogin()) {
      return
    }

    // 验证表单
    if (!this.validateForm()) {
      return
    }

    const userId = Auth.getCurrentUserId()
    const { formData, isEdit, planId } = this.data

    // 计算天数
    const startDate = new Date(formData.startDate)
    const endDate = new Date(formData.endDate)
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1

    // 准备数据
    const planData = {
      title: formData.title.trim(),
      destination: formData.destination.trim(),
      description: formData.description?.trim() || null,
      start_date: formData.startDate,
      end_date: formData.endDate,
      total_days: totalDays,
      travelers_count: formData.travelers,
      total_budget: parseFloat(formData.budget),
      travel_style: formData.travelStyle,
      tags: formData.tags,
      transportation: formData.transportation?.trim() || null,
      accommodation: formData.accommodation?.trim() || null,
      special_requirements: formData.specialRequirements?.trim() || null,
      status: 'planned',
      is_ai_generated: false
    }

    this.setData({ submitting: true })

    try {
      let result

      if (isEdit) {
        // 更新现有行程
        result = await supabase
          .from('travel_plans')
          .update(planData)
          .eq('id', planId)
          .eq('user_id', userId)
          .select()
      } else {
        // 创建新行程
        planData.user_id = userId
        result = await supabase
          .from('travel_plans')
          .insert(planData)
          .select()
      }

      const { data, error } = result

      if (error) throw error

      wx.showToast({
        title: isEdit ? '更新成功' : '创建成功',
        icon: 'success'
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 1500)

    } catch (error) {
      console.error('保存行程失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 重置表单
  resetForm() {
    wx.showModal({
      title: '确认重置',
      content: '确定要清空所有表单内容吗？',
      success: (res) => {
        if (res.confirm) {
          const today = new Date()
          const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          
          this.setData({
            formData: {
              title: '',
              destination: '',
              startDate: today.toISOString().split('T')[0],
              endDate: nextWeek.toISOString().split('T')[0],
              travelers: 1,
              budget: '',
              travelStyle: 'comfortable',
              description: '',
              tags: [],
              transportation: '',
              accommodation: '',
              specialRequirements: ''
            },
            errors: {}
          })
        }
      }
    })
  }
})
