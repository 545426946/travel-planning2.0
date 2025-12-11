// 行程详情页面
const Auth = require('../../utils/auth').Auth
const supabase = require('../../utils/supabase').supabase

Page({
  data: {
    // 行程ID
    planId: null,
    // 行程详情
    plan: null,
    // 当前选中的日期（第几天）
    selectedDay: 1,
    // 加载状态
    loading: true,
    // 每日行程数据
    dailyItinerary: [],
    // 编辑模式
    editMode: false,
    // 正在编辑的活动
    editingActivity: null,
    editingDayIndex: -1,
    editingActivityIndex: -1,
    // 显示添加活动弹窗
    showAddModal: false,
    // 新活动表单
    newActivity: {
      time: '09:00',
      title: '',
      location: '',
      price: ''
    },
    // 显示编辑基本信息弹窗
    showEditBasicModal: false,
    // 基本信息编辑表单
    editBasicForm: {
      title: '',
      destination: '',
      description: '',
      budget: '',
      travelers: 1
    },
    // 保存状态
    saving: false
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({ planId: options.id })
    this.loadPlanDetail()
  },

  // 加载行程详情
  async loadPlanDetail() {
    const userId = Auth.getCurrentUserId()
    if (!userId) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login'
        })
      }, 1500)
      return
    }

    this.setData({ loading: true })

    try {
      console.log('正在查询行程详情:', {
        planId: this.data.planId,
        userId: userId
      })

      const { data, error } = await supabase
        .from('travel_plans')
        .select('*')
        .eq('id', this.data.planId)
        .eq('user_id', userId) // 确保只能查看自己的行程
        .single()

      console.log('查询结果:', { data, error })

      if (error) {
        console.error('数据库查询错误:', error)
        throw error
      }

      if (!data) {
        console.log('行程不存在')
        wx.showToast({
          title: '行程不存在',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        return
      }

      console.log('成功获取行程数据:', data)

      // 处理行程数据，确保完整性
      const plan = {
        id: data.id,
        title: data.title || '未命名行程',
        description: data.description || '暂无描述',
        destination: data.destination || '未知目的地',
        startDate: data.start_date,
        endDate: data.end_date,
        totalDays: data.total_days || this.calculateDays(data.start_date, data.end_date),
        travelers: data.travelers_count || 1,
        budget: data.total_budget || 0,
        travelStyle: data.travel_style || 'comfortable',
        status: data.status || 'planned',
        isAIGenerated: data.is_ai_generated || false,
        tags: this.normalizeTags(data.tags),
        transportation: data.transportation || '待定',
        accommodation: data.accommodation || '待定',
        specialRequirements: data.special_requirements || '',
        itinerary: data.itinerary || '暂无详细行程',
        interests: this.parseInterests(data.interests),
        createdAt: data.created_at,
        image: this.getImageUrl(data.id, data.destination)
      }

      console.log('处理后的行程数据:', plan)

      // 解析每日行程
      const dailyItinerary = this.parseItinerary(plan.itinerary, plan.totalDays)

      console.log('解析后的每日行程数据:', dailyItinerary)

      this.setData({
        plan,
        dailyItinerary,
        loading: false
      })

      console.log('页面数据设置完成:', {
        plan: plan,
        dailyItinerary: dailyItinerary,
        loading: false
      })

    } catch (error) {
      console.error('加载行程详情失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 解析兴趣偏好
  parseInterests(interests) {
    if (!interests) return []
    if (typeof interests === 'string') {
      try {
        return JSON.parse(interests)
      } catch (e) {
        return []
      }
    }
    return interests
  },

  // 标准化标签
  normalizeTags(tags) {
    if (!tags) return []
    
    let normalizedTags = []
    
    if (typeof tags === 'string') {
      try {
        normalizedTags = JSON.parse(tags)
      } catch (e) {
        // 如果不是JSON，尝试按逗号分割
        normalizedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      }
    } else if (Array.isArray(tags)) {
      normalizedTags = tags
    } else {
      normalizedTags = [tags]
    }
    
    // 过滤空标签并限制数量
    return normalizedTags.filter(tag => tag && typeof tag === 'string').slice(0, 10)
  },

  // 解析行程为每日安排
  parseItinerary(itinerary, totalDays) {
    if (!itinerary) return []

    const dailyPlans = []
    
    console.log('开始解析行程，总天数:', totalDays)
    console.log('行程内容前500字符:', itinerary.substring(0, 500))
    
    // 增强的解析：支持多种AI格式
    let dayContents = []
    
    // 首先尝试匹配详细格式（Day X - 日期）
    // 修复正则表达式，使其能正确匹配当前数据格式
    const detailDayPattern = /Day\s*(\d+)\s*[-—]\s*([\d]{4}-[\d]{2}-[\d]{2})\s*[:：]\s*([\s\S]*?)(?=Day\s*\d+[-—][\d]{4}-[\d]{2}-[\d]{2}|$)/gi
    let match
    const detailDays = []
    
    // 重置正则表达式
    const newPattern = new RegExp(detailDayPattern.source, detailDayPattern.flags)
    
    while ((match = newPattern.exec(itinerary)) !== null) {
      const dayData = {
        dayNum: parseInt(match[1]),
        date: match[2].trim(),
        content: match[3].trim()
      }
      detailDays.push(dayData)
      console.log('解析到Day ' + dayData.dayNum + ':', dayData.date, '内容长度:', dayData.content.length)
    }
    
    console.log('详细格式解析结果:', detailDays.length, '天')
    
    if (detailDays.length > 0) {
      // 使用详细格式的数据
      dayContents = detailDays
    } else {
      // 尝试简化的Day格式（没有日期）
      const simpleDayPattern = /Day\s*(\d+)\s*[:：]\s*([\s\S]*?)(?=Day\s*\d+[:：]|$)/gi
      const simplePattern = new RegExp(simpleDayPattern.source, simpleDayPattern.flags)
      
      while ((match = simplePattern.exec(itinerary)) !== null) {
        const dayData = {
          dayNum: parseInt(match[1]),
          date: '',
          content: match[2].trim()
        }
        dayContents.push(dayData)
        console.log('简化格式解析到Day ' + dayData.dayNum + '，内容长度:', dayData.content.length)
      }
      
      // 如果还是没有，尝试中文格式（第X天）
      if (dayContents.length === 0) {
        const chineseDayPattern = /第([一二三四五六七八九十\d]+)天[\s:：]([\s\S]*?)(?=第[一二三四五六七八九十\d]+天|$)/gi
        const chinesePattern = new RegExp(chineseDayPattern.source, chineseDayPattern.flags)
        
        while ((match = chinesePattern.exec(itinerary)) !== null) {
          const dayNum = this.chineseToNumber(match[1])
          const dayData = {
            dayNum: dayNum,
            date: '',
            content: match[2].trim()
          }
          dayContents.push(dayData)
          console.log('解析到第' + dayNum + '天，内容长度:', dayData.content.length)
        }
      }
      
      // 如果还是没有，尝试按每个"Day"分割
      if (dayContents.length === 0) {
        const daySections = itinerary.split(/Day\s*\d+/gi)
        // 过滤掉空的部分
        const validSections = daySections.filter((section, index) => {
          // 第一个部分可能是开头的介绍，不是具体行程
          if (index === 0 && section.length > 0 && !section.includes('上午') && !section.includes('下午') && !section.includes('晚上')) {
            return false
          }
          return section.trim().length > 10 // 只保留有实际内容的部分
        })
        
        validSections.forEach((section, index) => {
          const dayNum = index + 1
          const dayData = {
            dayNum: dayNum,
            date: '',
            content: section.trim()
          }
          dayContents.push(dayData)
          console.log('按分割解析到第' + dayNum + '天，内容长度:', section.length)
        })
      }
    }
    
    console.log('最终解析结果:', dayContents.length, '天数据')

    // 确保有足够的天数
    for (let i = 0; i < totalDays; i++) {
      const dayNum = i + 1
      let dayData = dayContents.find(d => d.dayNum === dayNum)
      let content = ''
      let date = ''
      
      if (dayData) {
        content = dayData.content
        date = dayData.date || this.calculateDate(this.data.plan?.startDate, i)
      } else {
        // 尝试从备用数组获取
        if (dayContents[i]) {
          content = dayContents[i].content
          date = dayContents[i].date || this.calculateDate(this.data.plan?.startDate, i)
        } else {
          content = '暂无安排'
          date = this.calculateDate(this.data.plan?.startDate, i)
        }
      }

      // 提取活动项
      const activities = this.extractActivities(content)

      dailyPlans.push({
        day: dayNum,
        date: date,
        content: content,
        activities: activities
      })
      
      console.log(`第${dayNum}天解析完成:`, {
        hasContent: content.length > 0,
        hasActivities: activities.length > 0,
        activityCount: activities.length,
        contentLength: content.length
      })
    }

    console.log('parseItinerary完成，返回数据:', dailyPlans)
    return dailyPlans
  },

  // 提取活动项
  extractActivities(content) {
    const activities = []
    
    console.log('开始提取活动，内容前200字符:', content.substring(0, 200))
    
    // 根据当前数据格式的特点，定制化的解析模式
    const timePatterns = [
      // 匹配时间段模式：🌅 上午 (8:00-12:00)：[内容]
      /🌅☀️🌙?\s*(上午|下午|晚上)\s*[\(（](\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})[\)）][\s:：]*([^\n]+)/g,
      // 匹配emoji + 时间段：🌅 上午 (8:00-12:00)：
      /[🌅☀️🌙]\s*(上午|下午|晚上)\s*[\(（](\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})[\)）][\s:：]*([^\n]+)/g,
      // 匹配具体时间点：8:00-10:00：[内容]
      /(\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})[\s:：]*([^\n]+)/g,
      // 匹配时间段：上午 (8:00-12:00)：[内容]
      /(上午|下午|晚上)\s*[\(（](\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})[\)）][\s:：]*([^\n]+)/g,
      // 匹配简单时间段：上午、下午、晚上 + 内容
      /(早餐|午餐|晚餐|上午|下午|晚上)[\s:：]*([^\n]+)/g,
      // 匹配破折号分隔的活动：- [内容]（门票：[价格]）
      /-\s*([^：\n]+)(?:[:：]\s*([^：\n]+))?/g
    ]
    
    // 先尝试匹配最精确的模式
    for (let patternIndex = 0; patternIndex < timePatterns.length; patternIndex++) {
      const pattern = timePatterns[patternIndex]
      let match
      const newPattern = new RegExp(pattern.source, pattern.flags)
      
      console.log(`尝试模式 ${patternIndex + 1}:`, pattern.source.substring(0, 50) + '...')
      
      while ((match = newPattern.exec(content)) !== null) {
        let time = ''
        let title = ''
        let price = null
        
        // 根据不同的匹配模式解析
        if (match.length >= 5) {
          // 时间段格式 (上午/下午/晚上 + 具体时间)
          time = match[1] + ' (' + match[2] + '-' + match[3] + ')'
          title = match[4] || ''
        } else if (match.length >= 4 && match[1].includes(':')) {
          // 具体时间格式
          time = match[1] + (match[2] ? '-' + match[2] : '')
          title = match[3] || match[2] || ''
        } else if (match.length >= 3) {
          // 简单格式
          time = match[1]
          title = match[2] || ''
        } else {
          continue
        }
        
        // 清理和验证标题
        title = title.trim()
          .replace(/^[-:\s：]+/, '') // 移除开头的符号
          .replace(/^\([^)]*\)\s*/, '') // 移除开头的括号内容
          .replace(/门票[：:]\s*\d+元[\/]?人?/, '') // 移除门票价格信息
          .replace(/预估人均消费[：:]\s*\d+元/, '') // 移除消费信息
          .trim()
        
        // 提取价格
        price = this.extractPrice(title)
        
        // 跳过无效或重复的活动
        if (title && title.length > 3 && 
            !title.includes('费用') && 
            !title.includes('总计') && 
            !title.includes('交通') &&
            !title.includes('住宿') &&
            !title.match(/^(打车|公交车)/)) {
          
          const activity = {
            time: time,
            title: title.substring(0, 80),
            location: this.extractLocation(title),
            price: price,
            type: this.getActivityType(time, title)
          }
          
          // 避免重复添加相同的活动
          const isDuplicate = activities.some(existing => 
            existing.title === activity.title && existing.time === activity.time
          )
          
          if (!isDuplicate) {
            activities.push(activity)
            console.log('添加活动:', { time: activity.time, title: activity.title.substring(0, 30) })
          }
        }
      }
      
      // 如果找到了活动，就不再尝试其他模式
      if (activities.length > 0) {
        console.log(`模式 ${patternIndex + 1} 成功匹配到 ${activities.length} 个活动`)
        break
      }
    }

    // 如果还是没有找到足够的活动，按行智能分割
    if (activities.length < 3) {
      console.log('活动数量不足，尝试按行分割')
      const lines = content.split('\n').filter(l => l.trim())
      
      lines.forEach(line => {
        const trimmedLine = line.trim()
        
        // 跳过标题行和费用行
        if (trimmedLine && 
            !trimmedLine.match(/^(🌅|☀️|🌙|第|Day|费用|总计|交通|住宿|餐饮|📍|📅|👥|💰|🎯|📋|🚗|🏨|⚠️)/) &&
            trimmedLine.length > 5) {
          
          // 查找时间信息
          let time = '全天'
          const timeMatch = trimmedLine.match(/(\d{1,2}[:：]\d{2})|(\d{1,2}[:：]\d{2}\s*[-–—]\s*\d{1,2}[:：]\d{2})/)
          if (timeMatch) {
            time = timeMatch[0]
          }
          
          // 查找地点信息
          const location = this.extractLocation(trimmedLine)
          
          // 查找价格信息
          const price = this.extractPrice(trimmedLine)
          
          // 清理标题
          let title = trimmedLine
            .replace(/^[：:\s-]+/, '')
            .replace(/门票[：:]\s*\d+元[\/]?人?/, '')
            .replace(/预估人均消费[：:]\s*\d+元/, '')
            .trim()
          
          if (title.length > 3) {
            const activity = {
              time: time,
              title: title.substring(0, 80),
              location: location,
              price: price,
              type: this.getActivityType(time, title)
            }
            
            // 避免重复
            const isDuplicate = activities.some(existing => 
              existing.title === activity.title
            )
            
            if (!isDuplicate) {
              activities.push(activity)
            }
          }
        }
      })
    }

    console.log('最终提取到活动数量:', activities.length)
    activities.forEach((activity, index) => {
      console.log(`活动${index + 1}:`, {
        time: activity.time,
        title: activity.title.substring(0, 30),
        location: activity.location,
        price: activity.price
      })
    })

    return activities
  },

  // 获取活动类型
  getActivityType(time, title) {
    if (title.includes('餐') || title.includes('吃') || title.includes('美食')) return 'dining'
    if (title.includes('住') || title.includes('酒店') || title.includes('民宿')) return 'accommodation'
    if (title.includes('车') || title.includes('飞机') || title.includes('高铁')) return 'transport'
    if (title.includes('景点') || title.includes('参观') || title.includes('游览')) return 'sightseeing'
    if (title.includes('买') || title.includes('购') || title.includes('商场')) return 'shopping'
    return 'activity'
  },

  // 提取地点
  extractLocation(text) {
    const match = text.match(/(?:在|到|前往|参观|游览)\s*([^，.\n]+)/)
    return match ? match[1].trim() : ''
  },

  // 提取价格
  extractPrice(text) {
    const match = text.match(/[¥￥](\d+)/)
    return match ? match[1] : null
  },

  // 计算日期
  calculateDate(startDate, dayOffset) {
    if (!startDate) return ''
    const date = new Date(startDate)
    date.setDate(date.getDate() + dayOffset)
    return `${date.getMonth() + 1}/${date.getDate()}`
  },

  // 中文数字转换
  chineseToNumber(chinese) {
    const numbers = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15
    }
    
    // 直接匹配
    if (numbers[chinese]) {
      return numbers[chinese]
    }
    
    // 组合数字（如：二十三）
    if (chinese.includes('二十')) {
      return 20 + (numbers[chinese.replace('二十', '')] || 0)
    }
    
    if (chinese.includes('三十')) {
      return 30 + (numbers[chinese.replace('三十', '')] || 0)
    }
    
    // 尝试提取阿拉伯数字
    const match = chinese.match(/\d+/)
    return match ? parseInt(match[0]) : 1
  },

  // 计算天数
  calculateDays(startDate, endDate) {
    if (!startDate || !endDate) return 1
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  },

  // 获取图片URL
  getImageUrl(id, destination) {
    return `https://picsum.photos/seed/${destination || id}/800/400.jpg`
  },

  // 切换日期
  selectDay(e) {
    const day = parseInt(e.currentTarget.dataset.day)
    this.setData({ selectedDay: day })
  },

  // 切换编辑模式
  toggleEditMode() {
    this.setData({
      editMode: !this.data.editMode,
      editingActivity: null,
      editingDayIndex: -1,
      editingActivityIndex: -1
    })
    
    if (this.data.editMode) {
      wx.showToast({
        title: '已进入编辑模式',
        icon: 'none'
      })
    }
  },

  // 显示添加活动弹窗
  showAddActivityModal() {
    this.setData({
      showAddModal: true,
      newActivity: {
        time: '09:00',
        title: '',
        location: '',
        price: ''
      }
    })
  },

  // 隐藏添加活动弹窗
  hideAddModal() {
    this.setData({
      showAddModal: false
    })
  },

  // 新活动表单输入
  onNewActivityInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`newActivity.${field}`]: e.detail.value
    })
  },

  // 时间选择
  onTimeChange(e) {
    this.setData({
      'newActivity.time': e.detail.value
    })
  },

  // 添加活动
  addActivity() {
    const { newActivity, selectedDay, dailyItinerary } = this.data
    
    if (!newActivity.title.trim()) {
      wx.showToast({
        title: '请输入活动名称',
        icon: 'none'
      })
      return
    }

    const dayIndex = dailyItinerary.findIndex(d => d.day === selectedDay)
    if (dayIndex === -1) return

    const activity = {
      time: newActivity.time,
      title: newActivity.title.trim(),
      location: newActivity.location.trim(),
      price: newActivity.price ? parseFloat(newActivity.price) : null,
      type: this.getActivityType(newActivity.time, newActivity.title)
    }

    // 添加到当天的活动列表
    const activities = [...dailyItinerary[dayIndex].activities, activity]
    
    // 按时间排序
    activities.sort((a, b) => {
      const timeA = a.time.replace(/[^0-9:]/g, '').split(':')[0] || '00'
      const timeB = b.time.replace(/[^0-9:]/g, '').split(':')[0] || '00'
      return parseInt(timeA) - parseInt(timeB)
    })

    this.setData({
      [`dailyItinerary[${dayIndex}].activities`]: activities,
      showAddModal: false
    })

    // 保存到数据库
    this.saveItinerary()
  },

  // 编辑活动
  editActivity(e) {
    if (!this.data.editMode) return
    
    const { dayIndex, activityIndex } = e.currentTarget.dataset
    const activity = this.data.dailyItinerary[dayIndex].activities[activityIndex]
    
    this.setData({
      editingActivity: { ...activity },
      editingDayIndex: dayIndex,
      editingActivityIndex: activityIndex
    })
  },

  // 编辑活动表单输入
  onEditActivityInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`editingActivity.${field}`]: e.detail.value
    })
  },

  // 编辑活动时间选择
  onEditTimeChange(e) {
    this.setData({
      'editingActivity.time': e.detail.value
    })
  },

  // 保存编辑的活动
  saveEditActivity() {
    const { editingActivity, editingDayIndex, editingActivityIndex, dailyItinerary } = this.data
    
    if (!editingActivity.title.trim()) {
      wx.showToast({
        title: '活动名称不能为空',
        icon: 'none'
      })
      return
    }

    const activities = [...dailyItinerary[editingDayIndex].activities]
    activities[editingActivityIndex] = {
      ...editingActivity,
      title: editingActivity.title.trim(),
      location: editingActivity.location?.trim() || '',
      price: editingActivity.price ? parseFloat(editingActivity.price) : null,
      type: this.getActivityType(editingActivity.time, editingActivity.title)
    }

    // 按时间排序
    activities.sort((a, b) => {
      const timeA = a.time.replace(/[^0-9:]/g, '').split(':')[0] || '00'
      const timeB = b.time.replace(/[^0-9:]/g, '').split(':')[0] || '00'
      return parseInt(timeA) - parseInt(timeB)
    })

    this.setData({
      [`dailyItinerary[${editingDayIndex}].activities`]: activities,
      editingActivity: null,
      editingDayIndex: -1,
      editingActivityIndex: -1
    })

    this.saveItinerary()
  },

  // 取消编辑活动
  cancelEditActivity() {
    this.setData({
      editingActivity: null,
      editingDayIndex: -1,
      editingActivityIndex: -1
    })
  },

  // 删除活动
  deleteActivity(e) {
    const { dayIndex, activityIndex } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个活动吗？',
      success: (res) => {
        if (res.confirm) {
          const activities = [...this.data.dailyItinerary[dayIndex].activities]
          activities.splice(activityIndex, 1)
          
          this.setData({
            [`dailyItinerary[${dayIndex}].activities`]: activities
          })
          
          this.saveItinerary()
        }
      }
    })
  },

  // 显示编辑基本信息弹窗
  showEditBasicInfo() {
    const { plan } = this.data
    this.setData({
      showEditBasicModal: true,
      editBasicForm: {
        title: plan.title || '',
        destination: plan.destination || '',
        description: plan.description || '',
        budget: plan.budget ? String(plan.budget) : '',
        travelers: plan.travelers || 1
      }
    })
  },

  // 隐藏编辑基本信息弹窗
  hideEditBasicModal() {
    this.setData({
      showEditBasicModal: false
    })
  },

  // 基本信息表单输入
  onBasicFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`editBasicForm.${field}`]: e.detail.value
    })
  },

  // 保存基本信息
  async saveBasicInfo() {
    const { editBasicForm, planId } = this.data
    
    if (!editBasicForm.title.trim()) {
      wx.showToast({
        title: '请输入行程标题',
        icon: 'none'
      })
      return
    }

    this.setData({ saving: true })

    try {
      const { error } = await supabase
        .from('travel_plans')
        .update({
          title: editBasicForm.title.trim(),
          destination: editBasicForm.destination.trim(),
          description: editBasicForm.description.trim(),
          total_budget: parseFloat(editBasicForm.budget) || 0,
          travelers_count: parseInt(editBasicForm.travelers) || 1
        })
        .eq('id', planId)

      if (error) throw error

      // 更新本地数据
      this.setData({
        'plan.title': editBasicForm.title.trim(),
        'plan.destination': editBasicForm.destination.trim(),
        'plan.description': editBasicForm.description.trim(),
        'plan.budget': parseFloat(editBasicForm.budget) || 0,
        'plan.travelers': parseInt(editBasicForm.travelers) || 1,
        showEditBasicModal: false,
        saving: false
      })

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (error) {
      console.error('保存基本信息失败:', error)
      this.setData({ saving: false })
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 保存行程到数据库
  async saveItinerary() {
    const { dailyItinerary, planId, plan } = this.data
    
    // 将结构化数据转换回文本格式
    let itineraryText = ''
    
    dailyItinerary.forEach(day => {
      itineraryText += `Day ${day.day} - ${plan.startDate ? this.formatDateForDay(plan.startDate, day.day - 1) : day.date}：\n`
      
      if (day.activities && day.activities.length > 0) {
        day.activities.forEach(activity => {
          itineraryText += `${activity.time}：${activity.title}`
          if (activity.location) {
            itineraryText += `（${activity.location}）`
          }
          if (activity.price) {
            itineraryText += ` 门票：${activity.price}元`
          }
          itineraryText += '\n'
        })
      } else {
        itineraryText += '暂无安排\n'
      }
      
      itineraryText += '\n'
    })

    try {
      const { error } = await supabase
        .from('travel_plans')
        .update({ itinerary: itineraryText })
        .eq('id', planId)

      if (error) throw error

      // 更新本地plan数据
      this.setData({
        'plan.itinerary': itineraryText
      })

      wx.showToast({
        title: '已保存',
        icon: 'success'
      })
    } catch (error) {
      console.error('保存行程失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 格式化日期
  formatDateForDay(startDate, dayOffset) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + dayOffset)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 打开地图页面
  openMap() {
    if (!this.data.plan?.destination) {
      wx.showToast({
        title: '暂无目的地信息',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: `/pages/plan-map/plan-map?id=${this.data.planId}`
    })
  },

  // 分享行程
  sharePlan() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    
    wx.showToast({
      title: '点击右上角分享',
      icon: 'none'
    })
  },

  // 复制行程
  async duplicatePlan() {
    wx.showModal({
      title: '复制行程',
      content: '确定要复制这个行程吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '复制中...' })

          try {
            const userId = Auth.getCurrentUserId()
            const plan = this.data.plan
            
            // 创建新行程（不包含id和created_at）
            const newPlan = {
              user_id: userId,
              title: `${plan.title} (副本)`,
              description: plan.description,
              destination: plan.destination,
              start_date: plan.startDate,
              end_date: plan.endDate,
              total_days: plan.totalDays,
              travelers_count: plan.travelers,
              total_budget: plan.budget,
              travel_style: plan.travelStyle,
              interests: plan.interests,
              itinerary: plan.itinerary,
              is_ai_generated: false, // 复制的行程标记为手动创建
              status: 'planned',
              tags: plan.tags,
              transportation: plan.transportation,
              accommodation: plan.accommodation,
              special_requirements: plan.specialRequirements
            }

            const { data, error } = await supabase
              .from('travel_plans')
              .insert(newPlan)
              .select()

            wx.hideLoading()

            if (error) throw error

            wx.showModal({
              title: '复制成功',
              content: '是否要查看新复制的行程？',
              success: (modalRes) => {
                if (modalRes.confirm && data && data[0]) {
                  // 跳转到新行程的详情页
                  wx.redirectTo({
                    url: `/pages/plan-detail/plan-detail?id=${data[0].id}`
                  })
                } else {
                  // 返回列表页
                  wx.navigateBack()
                }
              }
            })

          } catch (error) {
            wx.hideLoading()
            console.error('复制行程失败:', error)
            wx.showToast({
              title: '复制失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 更改状态
  changeStatus() {
    const statusOptions = [
      { value: 'planned', label: '计划中' },
      { value: 'ongoing', label: '进行中' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' }
    ]

    const currentStatus = this.data.plan.status
    const itemList = statusOptions.map(item => 
      item.value === currentStatus ? `✓ ${item.label}` : item.label
    )
    
    wx.showActionSheet({
      itemList: itemList,
      success: async (res) => {
        const newStatus = statusOptions[res.tapIndex].value
        
        if (newStatus === currentStatus) {
          return
        }

        try {
          const { error } = await supabase
            .from('travel_plans')
            .update({ status: newStatus })
            .eq('id', this.data.planId)

          if (error) throw error

          wx.showToast({
            title: '状态已更新',
            icon: 'success'
          })

          // 重新加载行程详情
          this.loadPlanDetail()

        } catch (error) {
          console.error('更新状态失败:', error)
          wx.showToast({
            title: '更新失败',
            icon: 'none'
          })
        }
      }
    })
  },

  // 更多操作
  showMoreActions() {
    const itemList = ['复制行程', '更改状态', '导出行程', '分享行程']
    
    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            // 复制行程
            this.duplicatePlan()
            break
          case 1:
            // 更改状态
            this.changeStatus()
            break
          case 2:
            // 导出行程
            this.exportPlan()
            break
          case 3:
            // 分享行程
            this.sharePlan()
            break
        }
      }
    })
  },

  // 导出行程
  exportPlan() {
    const plan = this.data.plan
    let content = `【${plan.title}】

`
    content += `📍 目的地：${plan.destination}
`
    content += `📅 日期：${plan.startDate} 至 ${plan.endDate} (${plan.totalDays}天)
`
    content += `👥 人数：${plan.travelers}人
`
    content += `💰 预算：¥${plan.budget}

`
    
    if (plan.description) {
      content += `📝 描述：${plan.description}

`
    }
    
    // 添加每日行程
    if (this.data.dailyItinerary && this.data.dailyItinerary.length > 0) {
      content += `📋 行程安排：

`
      this.data.dailyItinerary.forEach(day => {
        content += `第${day.day}天 (${day.date})：
${day.content}

`
      })
    }
    
    // 复制到剪贴板
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  },

  // 编辑行程
  editPlan() {
    wx.navigateTo({
      url: `/pages/create-plan/create-plan?id=${this.data.planId}`
    })
  },

  // 删除行程
  deletePlan() {
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${this.data.plan?.title}"吗？`,
      confirmColor: '#FF6B6B',
      success: async (res) => {
        if (res.confirm) {
          try {
            const { error } = await supabase
              .from('travel_plans')
              .delete()
              .eq('id', this.data.planId)

            if (error) throw error

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })

            setTimeout(() => {
              wx.navigateBack()
            }, 1500)

          } catch (error) {
            console.error('删除失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 获取旅行风格文本
  getTravelStyleText(style) {
    const styleMap = {
      'luxury': '轻奢型',
      'comfortable': '舒适享受',
      'premium': '奢华体验',
      'budget': '经济实惠',
      'adventure': '探险刺激'
    }
    return styleMap[style] || '舒适享受'
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'planned': '计划中',
      'ongoing': '进行中',
      'completed': '已完成',
      'cancelled': '已取消'
    }
    return statusMap[status] || '未知'
  },

  // 返回上一页
  navigateBack() {
    wx.navigateBack()
  },

  // 测试解析功能（开发调试时使用）
  testParseItinerary() {
    if (!this.data.plan?.itinerary) {
      console.log('没有行程数据可以测试')
      return
    }
    
    console.log('=== 开始测试行程解析 ===')
    console.log('原始行程长度:', this.data.plan.itinerary.length)
    
    const testResult = this.parseItinerary(this.data.plan.itinerary, this.data.plan.totalDays)
    
    console.log('=== 解析结果 ===')
    console.log('解析出的天数:', testResult.length)
    
    testResult.forEach((day, index) => {
      console.log(`--- 第${index + 1}天 ---`)
      console.log('日期:', day.date)
      console.log('内容长度:', day.content.length)
      console.log('活动数量:', day.activities.length)
      
      day.activities.forEach((activity, actIndex) => {
        console.log(`  活动${actIndex + 1}:`, {
          time: activity.time,
          title: activity.title.substring(0, 30),
          location: activity.location,
          price: activity.price,
          type: activity.type
        })
      })
    })
    
    console.log('=== 测试完成 ===')
  }
})