// 行程详情页面
var Auth = require('../../utils/auth').Auth
var supabase = require('../../utils/supabase').supabase

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
    dailyItinerary: []
  },

  onLoad: function(options) {
    if (!options.id) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(function() {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({ planId: options.id })
    this.loadPlanDetail()
  },

  // 加载行程详情
  loadPlanDetail: function() {
    console.log('开始加载行程详情，ID:', this.data.planId)
    
    var userId = Auth.getCurrentUserId()
    if (!userId) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(function() {
        wx.navigateTo({
          url: '/pages/login/login'
        })
      }, 1500)
      return
    }

    this.setData({ loading: true, showError: false })

    var that = this
    supabase
      .from('travel_plans')
      .select('*')
      .eq('id', this.data.planId)
      .eq('user_id', userId) // 确保只能查看自己的行程
      .single()
      .then(function(result) {
        var data = result.data
        var error = result.error

        console.log('查询结果:', { data: data, error: error })

        if (error) {
          console.error('数据库查询错误:', error)
          
          // 区分不同类型的错误
          if (error.code === 'PGRST116') {
            throw new Error('未找到该行程，可能已被删除')
          } else if (error.code === 'PGRST301') {
            throw new Error('权限不足，无法查看此行程')
          } else if (error.message && error.message.includes('JWT')) {
            throw new Error('登录已过期，请重新登录')
          } else if (error.message && error.message.includes('network')) {
            throw new Error('网络连接失败')
          } else if (error.errMsg) {
            // 处理微信小程序的网络错误
            throw new Error('网络连接失败: ' + error.errMsg)
          } else {
            throw error
          }
        }

        if (!data) {
          console.log('行程不存在')
          throw new Error('未找到该行程')
        }

        console.log('成功获取行程数据:', data)

        // 数据验证和处理
        var plan = that.processPlanData(data)
        console.log('处理后的行程数据:', plan)

        // 解析每日行程
        var dailyItinerary = that.parseItinerary(plan.itinerary, plan.totalDays)
        console.log('解析后的每日行程数据:', dailyItinerary)

        that.setData({
          plan: plan,
          dailyItinerary: dailyItinerary,
          loading: false,
          showError: false
        })

        console.log('页面数据设置完成:', {
          plan: plan,
          dailyItinerary: dailyItinerary,
          loading: false
        })
      })
      .catch(function(error) {
        console.error('加载行程详情失败:', error)
        that.setData({ loading: false })
        
        // 显示具体的错误信息
        that.showError('加载失败', error.message || '网络连接异常')
      })
  },

  // 处理行程数据
  processPlanData: function(data) {
    try {
      // 验证必要字段
      if (!data.id) {
        throw new Error('行程ID缺失')
      }

      // 计算总天数
      var totalDays = data.total_days || 1
      if (data.start_date && data.end_date) {
        var calculatedDays = this.calculateDays(data.start_date, data.end_date)
        if (calculatedDays > 0) {
          totalDays = calculatedDays
        }
      }

      // 确保有有效的日期
      var startDate = data.start_date
      var endDate = data.end_date
      
      if (!startDate && endDate) {
        // 只有结束日期，推算开始日期
        var end = new Date(endDate)
        end.setDate(end.getDate() - totalDays + 1)
        startDate = end.toISOString().split('T')[0]
      } else if (startDate && !endDate) {
        // 只有开始日期，推算结束日期
        var start = new Date(startDate)
        start.setDate(start.getDate() + totalDays - 1)
        endDate = start.toISOString().split('T')[0]
      } else if (!startDate && !endDate) {
        // 都没有，使用当前日期
        var today = new Date()
        startDate = today.toISOString().split('T')[0]
        var end = new Date(today)
        end.setDate(end.getDate() + totalDays - 1)
        endDate = end.toISOString().split('T')[0]
      }

      return {
        id: data.id,
        title: this.sanitizeText(data.title) || '未命名行程',
        description: this.sanitizeText(data.description) || '暂无描述',
        destination: this.sanitizeText(data.destination) || '未知目的地',
        startDate: startDate,
        endDate: endDate,
        totalDays: totalDays,
        travelers: Math.max(1, parseInt(data.travelers_count) || 1),
        budget: Math.max(0, parseInt(data.total_budget) || 0),
        travelStyle: data.travel_style || 'comfortable',
        status: data.status || 'planned',
        isAIGenerated: Boolean(data.is_ai_generated),
        tags: this.normalizeTags(data.tags),
        transportation: this.sanitizeText(data.transportation) || '待定',
        accommodation: this.sanitizeText(data.accommodation) || '待定',
        specialRequirements: this.sanitizeText(data.special_requirements) || '',
        itinerary: this.sanitizeText(data.itinerary) || this.generateDefaultItinerary(totalDays, data.destination),
        interests: this.parseInterests(data.interests),
        createdAt: data.created_at,
        image: this.getImageUrl(data.id, data.destination)
      }
    } catch (error) {
      console.error('处理行程数据失败:', error)
      // 返回一个最小化的有效行程对象
      return {
        id: data.id,
        title: '未命名行程',
        description: '暂无描述',
        destination: '未知目的地',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        totalDays: 1,
        travelers: 1,
        budget: 0,
        travelStyle: 'comfortable',
        status: 'planned',
        isAIGenerated: false,
        tags: [],
        transportation: '待定',
        accommodation: '待定',
        specialRequirements: '',
        itinerary: '暂无详细行程',
        interests: [],
        createdAt: data.created_at,
        image: this.getImageUrl(data.id, null)
      }
    }
  },

  // 清理文本
  sanitizeText: function(text) {
    if (!text) return ''
    if (typeof text !== 'string') return String(text)
    return text.trim()
  },

  // 生成默认行程
  generateDefaultItinerary: function(totalDays, destination) {
    var itinerary = ''
    for (var i = 1; i <= totalDays; i++) {
      itinerary += 'Day ' + i + ': 探索' + (destination || '目的地') + '的精彩之处\n'
      itinerary += '上午：参观当地景点\n'
      itinerary += '下午：体验当地文化\n'
      itinerary += '晚上：品尝当地美食\n\n'
    }
    return itinerary
  },

  // 解析兴趣偏好
  parseInterests: function(interests) {
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
  normalizeTags: function(tags) {
    if (!tags) return []
    
    var normalizedTags = []
    
    if (typeof tags === 'string') {
      try {
        normalizedTags = JSON.parse(tags)
      } catch (e) {
        // 如果不是JSON，尝试按逗号分割
        normalizedTags = tags.split(',').map(function(tag) { return tag.trim() }).filter(function(tag) { return tag })
      }
    } else if (Array.isArray(tags)) {
      normalizedTags = tags
    } else {
      normalizedTags = [tags]
    }
    
    // 过滤空标签并限制数量
    return normalizedTags.filter(function(tag) { return tag && typeof tag === 'string' }).slice(0, 10)
  },

  // 解析行程为每日安排
  parseItinerary: function(itinerary, totalDays) {
    if (!itinerary) {
      console.log('行程内容为空，创建默认行程')
      return this.createDefaultItinerary(totalDays)
    }

    var dailyPlans = []
    
    console.log('开始解析行程，总天数:', totalDays)
    console.log('行程内容前500字符:', itinerary.substring(0, 500))
    
    try {
      // 增强的解析：支持多种AI格式
      var dayContents = []
      
      // 首先尝试匹配详细格式（Day X - 日期）
      var detailDayPattern = /Day\s*(\d+)\s*[-—]\s*([\d]{4}-[\d]{2}-[\d]{2})\s*[:：]\s*([\s\S]*?)(?=Day\s*\d+[-—][\d]{4}-[\d]{2}-[\d]{2}|$)/gi
      var match
      var detailDays = []
      
      while ((match = detailDayPattern.exec(itinerary)) !== null) {
        var dayData = {
          dayNum: parseInt(match[1]),
          date: match[2].trim(),
          content: match[3].trim()
        }
        detailDays.push(dayData)
        console.log('解析到Day ' + dayData.dayNum + ':', dayData.date, '内容长度:', dayData.content.length)
      }
      
      console.log('详细格式解析结果:', detailDays.length, '天')
      
      if (detailDays.length > 0) {
        dayContents = detailDays
      } else {
        // 尝试简化的Day格式（没有日期）
        var simpleDayPattern = /Day\s*(\d+)\s*[:：]\s*([\s\S]*?)(?=Day\s*\d+[:：]|$)/gi
        
        while ((match = simpleDayPattern.exec(itinerary)) !== null) {
          var dayData = {
            dayNum: parseInt(match[1]),
            date: '',
            content: match[2].trim()
          }
          dayContents.push(dayData)
          console.log('简化格式解析到Day ' + dayData.dayNum + '，内容长度:', dayData.content.length)
        }
        
        // 如果还是没有，尝试中文格式（第X天）
        if (dayContents.length === 0) {
          var chineseDayPattern = /第([一二三四五六七八九十\d]+)天[\s:：]([\s\S]*?)(?=第[一二三四五六七八九十\d]+天|$)/gi
          
          while ((match = chineseDayPattern.exec(itinerary)) !== null) {
            var dayNum = this.chineseToNumber(match[1])
            var dayData = {
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
          var daySections = itinerary.split(/Day\s*\d+/gi)
          var validSections = daySections.filter(function(section, index) {
            if (index === 0 && section.length > 0 && !section.includes('上午') && !section.includes('下午') && !section.includes('晚上')) {
              return false
            }
            return section.trim().length > 10
          })
          
          validSections.forEach(function(section, index) {
            var dayNum = index + 1
            var dayData = {
              dayNum: dayNum,
              date: '',
              content: section.trim()
            }
            dayContents.push(dayData)
            console.log('按分割解析到第' + dayNum + '天，内容长度:', section.length)
          })
        }
        
        // 如果还是没有解析到任何天数，尝试智能分段
        if (dayContents.length === 0 && totalDays > 0) {
          console.log('尝试智能分段解析...')
          
          // 按句子分割
          var sentences = itinerary.split(/[。！？；\n]/g).filter(function(s) { return s.trim().length > 5 })
          
          if (sentences.length > 0) {
            // 平均分配到各天
            var sentencesPerDay = Math.ceil(sentences.length / totalDays)
            
            for (var dayIndex = 0; dayIndex < totalDays; dayIndex++) {
              var startIdx = dayIndex * sentencesPerDay
              var endIdx = Math.min(startIdx + sentencesPerDay, sentences.length)
              var dayContent = sentences.slice(startIdx, endIdx).join('。')
              
              if (dayContent.trim().length > 0) {
                dayContents.push({
                  dayNum: dayIndex + 1,
                  date: '',
                  content: dayContent
                })
                console.log('智能分段解析到第' + (dayIndex + 1) + '天，内容长度:', dayContent.length)
              }
            }
          }
        }
      }
      
      console.log('最终解析结果:', dayContents.length, '天数据')

      // 确保有足够的天数
      for (var i = 0; i < totalDays; i++) {
        var dayNum = i + 1
        var dayData = dayContents.find(function(d) { return d.dayNum === dayNum })
        var content = ''
        var date = ''
        
        if (dayData) {
          content = dayData.content
          date = dayData.date || this.calculateDate(this.data.plan?.startDate, i)
        } else {
          if (dayContents[i]) {
            content = dayContents[i].content
            date = dayContents[i].date || this.calculateDate(this.data.plan?.startDate, i)
          } else {
            content = '暂无安排'
            date = this.calculateDate(this.data.plan?.startDate, i)
          }
        }

        // 提取活动项
        var activities = this.extractActivities(content)

        dailyPlans.push({
          day: dayNum,
          date: date,
          content: content,
          activities: activities
        })
        
        console.log('第' + dayNum + '天解析完成:', {
          hasContent: content.length > 0,
          hasActivities: activities.length > 0,
          activityCount: activities.length,
          contentLength: content.length
        })
      }

      console.log('parseItinerary完成，返回数据:', dailyPlans)
      return dailyPlans
      
    } catch (error) {
      console.error('解析行程失败:', error)
      return this.createDefaultItinerary(totalDays)
    }
  },

  // 创建默认行程
  createDefaultItinerary: function(totalDays) {
    var dailyPlans = []
    
    for (var i = 0; i < totalDays; i++) {
      var dayNum = i + 1
      var date = this.calculateDate(this.data.plan?.startDate, i)
      
      dailyPlans.push({
        day: dayNum,
        date: date,
        content: '暂无安排',
        activities: []
      })
    }
    
    console.log('创建默认行程，共', totalDays, '天')
    return dailyPlans
  },

  // 显示错误
  showError: function(title, detail) {
    this.setData({
      showError: true,
      errorMessage: title || '出错了',
      errorDetail: detail || '',
      loading: false
    })
  },

  // 隐藏错误
  hideError: function() {
    this.setData({
      showError: false,
      errorMessage: '',
      errorDetail: ''
    })
  },

  // 提取活动
  extractActivities: function(content) {
    if (!content || typeof content !== 'string') {
      return []
    }
    
    var activities = []
    var lines = content.split('\n').filter(function(line) { return line.trim() })
    
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      var trimmed = line.trim()
      if (!trimmed) continue
      
      // 匹配时间段 (上午、下午、晚上、早晨、中午、傍晚、夜间、凌晨、深夜)
      var timeMatch = trimmed.match(/^(上午|下午|晚上|早晨|中午|傍晚|夜间|凌晨|深夜|早上|午后|晚间|夜晚|清晨|黄昏)[:：]\s*(.+)$/)
      if (timeMatch) {
        activities.push({
          time: timeMatch[1],
          activity: timeMatch[2].trim()
        })
        continue
      }
      
      // 匹配具体时间 (9:00, 14:30 等)
      var timeMatch2 = trimmed.match(/^(\d{1,2}[:：]\d{2})\s*[:：]\s*(.+)$/)
      if (timeMatch2) {
        activities.push({
          time: timeMatch2[1],
          activity: timeMatch2[2].trim()
        })
        continue
      }
      
      // 匹配列表项 (-, •, ○, □)
      var listMatch = trimmed.match(/^[-•○□]\s*(.+)$/)
      if (listMatch) {
        activities.push({
          time: '全天',
          activity: listMatch[1].trim()
        })
        continue
      }
      
      // 匹配数字列表 (1., 2., 3.)
      var numberMatch = trimmed.match(/^(\d+)\.\s*(.+)$/)
      if (numberMatch) {
        activities.push({
          time: '全天',
          activity: numberMatch[2].trim()
        })
        continue
      }
      
      // 匹配“第X个景点”或“第X站”
      var spotMatch = trimmed.match(/^第([\d一二三四五六七八九十]+)(个景点|站)[:：]\s*(.+)$/)
      if (spotMatch) {
        activities.push({
          time: '第' + spotMatch[1] + spotMatch[2],
          activity: spotMatch[3].trim()
        })
        continue
      }
      
      // 普通文本，如果上一个活动存在，追加到上一个活动
      if (activities.length > 0) {
        var lastActivity = activities[activities.length - 1]
        lastActivity.activity += ' ' + trimmed
      } else {
        // 如果没有活动，创建一个新的活动
        activities.push({
          time: '全天',
          activity: trimmed
        })
      }
    }
    
    return activities
  },

  // 获取活动类型
  getActivityType: function(time, title) {
    if (title.includes('餐') || title.includes('吃') || title.includes('美食')) return 'dining'
    if (title.includes('住') || title.includes('酒店') || title.includes('民宿')) return 'accommodation'
    if (title.includes('车') || title.includes('飞机') || title.includes('高铁')) return 'transport'
    if (title.includes('景点') || title.includes('参观') || title.includes('游览')) return 'sightseeing'
    if (title.includes('买') || title.includes('购') || title.includes('商场')) return 'shopping'
    return 'activity'
  },

  // 提取地点
  extractLocation: function(text) {
    var match = text.match(/(?:在|到|前往|参观|游览)\s*([^，.\n]+)/)
    return match ? match[1].trim() : ''
  },

  // 提取价格
  extractPrice: function(text) {
    var match = text.match(/[¥￥](\d+)/)
    return match ? match[1] : null
  },

  // 计算日期
  calculateDate: function(startDate, dayOffset) {
    if (!startDate) return ''
    var date = new Date(startDate)
    date.setDate(date.getDate() + dayOffset)
    return (date.getMonth() + 1) + '/' + date.getDate()
  },

  // 中文数字转换
  chineseToNumber: function(chinese) {
    var numbers = {
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
    var match = chinese.match(/\d+/)
    return match ? parseInt(match[0]) : 1
  },

  // 计算天数
  calculateDays: function(startDate, endDate) {
    if (!startDate || !endDate) return 1
    var start = new Date(startDate)
    var end = new Date(endDate)
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  },

  // 获取图片URL
  getImageUrl: function(id, destination) {
    return 'https://picsum.photos/seed/' + (destination || id) + '/800/400.jpg'
  },

  // 切换日期
  selectDay: function(e) {
    var day = parseInt(e.currentTarget.dataset.day)
    this.setData({ selectedDay: day })
  },

  // 添加活动
  addActivity: function() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 高德地图导航
  navigateToMap: function() {
    if (!this.data.plan || !this.data.plan.destination) {
      wx.showToast({
        title: '暂无目的地信息',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 分享行程
  sharePlan: function() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    
    wx.showToast({
      title: '点击右上角分享',
      icon: 'none'
    })
  },

  // 返回上一页
  navigateBack: function() {
    wx.navigateBack()
  },

  // 获取状态文本
  getStatusText: function(status) {
    var statusMap = {
      'planned': '计划中',
      'confirmed': '已确认',
      'ongoing': '进行中',
      'completed': '已完成',
      'cancelled': '已取消'
    }
    return statusMap[status] || '未知状态'
  },

  // 获取旅行风格文本
  getTravelStyleText: function(style) {
    var styleMap = {
      'budget': '经济型',
      'comfortable': '舒适型',
      'luxury': '豪华型',
      'adventure': '探险型',
      'cultural': '文化型',
      'relaxing': '休闲型'
    }
    return styleMap[style] || '未知风格'
  },

  // 编辑行程
  editPlan: function() {
    if (!this.data.plan) {
      wx.showToast({
        title: '数据加载中',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/create-plan/create-plan?id=' + this.data.planId
    })
  },

  // 更改状态
  changeStatus: function() {
    var statusOptions = ['planned', 'confirmed', 'ongoing', 'completed', 'cancelled']
    var statusTexts = ['计划中', '已确认', '进行中', '已完成', '已取消']
    
    wx.showActionSheet({
      itemList: statusTexts,
      success: function(res) {
        var newStatus = statusOptions[res.tapIndex]
        this.updatePlanStatus(newStatus)
      }.bind(this)
    })
  },

  // 更新行程状态
  updatePlanStatus: function(newStatus) {
    var that = this
    wx.showLoading({ title: '更新中...' })
    
    supabase
      .from('travel_plans')
      .update({ status: newStatus })
      .eq('id', this.data.planId)
      .eq('user_id', Auth.getCurrentUserId())
      .single()
      .then(function(result) {
        var data = result.data
        var error = result.error
        
        if (error) throw error
        
        wx.hideLoading()
        wx.showToast({
          title: '状态已更新',
          icon: 'success'
        })
        
        // 更新本地数据
        var plan = Object.assign({}, that.data.plan, { status: newStatus })
        that.setData({ plan: plan })
      })
      .catch(function(error) {
        wx.hideLoading()
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        })
        console.error('更新状态失败:', error)
      })
  },

  // 显示更多操作
  showMoreActions: function() {
    var actions = ['删除行程', '导出行程', '分享行程']
    
    wx.showActionSheet({
      itemList: actions,
      success: function(res) {
        switch (res.tapIndex) {
          case 0:
            this.deletePlan()
            break
          case 1:
            this.exportPlan()
            break
          case 2:
            this.sharePlan()
            break
        }
      }.bind(this)
    })
  },

  // 删除行程
  deletePlan: function() {
    wx.showModal({
      title: '删除行程',
      content: '确定要删除这个行程吗？此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#FF6B6B',
      success: function(res) {
        if (res.confirm) {
          this.performDelete()
        }
      }.bind(this)
    })
  },

  // 执行删除
  performDelete: function() {
    var that = this
    wx.showLoading({ title: '删除中...' })
    
    supabase
      .from('travel_plans')
      .delete()
      .eq('id', this.data.planId)
      .eq('user_id', Auth.getCurrentUserId())
      .then(function(result) {
        var error = result.error
        
        if (error) throw error
        
        wx.hideLoading()
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        
        setTimeout(function() {
          wx.navigateBack()
        }, 1500)
      })
      .catch(function(error) {
        wx.hideLoading()
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        })
        console.error('删除失败:', error)
      })
  },

  // 导出行程
  exportPlan() {
    if (!this.data.plan) {
      wx.showToast({
        title: '数据加载中',
        icon: 'none'
      })
      return
    }

    var plan = this.data.plan
    var exportText = plan.title + '\n'
    exportText += '目的地：' + plan.destination + '\n'
    exportText += '天数：' + plan.totalDays + '天\n'
    exportText += '人数：' + plan.travelers + '人\n'
    exportText += '预算：¥' + plan.budget + '\n'
    exportText += '开始日期：' + plan.startDate + '\n'
    exportText += '结束日期：' + plan.endDate + '\n\n'
    
    exportText += '行程安排：\n'
    this.data.dailyItinerary.forEach(function(day) {
      exportText += '\n第' + day.day + '天 (' + day.date + '):\n'
      if (day.activities && day.activities.length > 0) {
        day.activities.forEach(function(activity) {
          exportText += activity.time + ': ' + activity.title
          if (activity.location) {
            exportText += ' (' + activity.location + ')'
          }
          if (activity.price) {
            exportText += ' ¥' + activity.price
          }
          exportText += '\n'
        })
      } else {
        exportText += day.content + '\n'
      }
    })

    if (plan.description) {
      exportText += '\n行程描述：\n' + plan.description + '\n'
    }

    wx.setClipboardData({
      data: exportText,
      success: function() {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      },
      fail: function() {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        })
      }
    })
  },

  // 复制行程
  duplicatePlan: function() {
    var that = this
    wx.showModal({
      title: '复制行程',
      content: '确定要复制这个行程吗？',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '复制中...' })
          
          var userId = Auth.getCurrentUserId()
          var plan = that.data.plan
          
          // 创建新行程（不包含id和created_at）
          var newPlan = {
            user_id: userId,
            title: plan.title + ' (副本)',
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
          
          supabase
            .from('travel_plans')
            .insert(newPlan)
            .select()
            .then(function(result) {
              var data = result.data
              var error = result.error
              
              wx.hideLoading()
              
              if (error) throw error
              
              wx.showModal({
                title: '复制成功',
                content: '是否要查看新复制的行程？',
                success: function(modalRes) {
                  if (modalRes.confirm && data && data[0]) {
                    // 跳转到新行程的详情页
                    wx.redirectTo({
                      url: '/pages/plan-detail/plan-detail?id=' + data[0].id
                    })
                  } else {
                    // 返回列表页
                    wx.navigateBack()
                  }
                }
              })
            })
            .catch(function(error) {
              wx.hideLoading()
              console.error('复制行程失败:', error)
              wx.showToast({
                title: '复制失败',
                icon: 'none'
              })
            })
        }
      }
    })
  },

  // 更改状态
  changeStatus: function() {
    var statusOptions = [
      { value: 'planned', label: '计划中' },
      { value: 'ongoing', label: '进行中' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' }
    ]

    var currentStatus = this.data.plan.status
    var itemList = statusOptions.map(function(item) {
      return item.value === currentStatus ? '✓ ' + item.label : item.label
    })
    
    var that = this
    wx.showActionSheet({
      itemList: itemList,
      success: function(res) {
        var newStatus = statusOptions[res.tapIndex].value
        
        if (newStatus === currentStatus) {
          return
        }

        supabase
          .from('travel_plans')
          .update({ status: newStatus })
          .eq('id', that.data.planId)
          .then(function(result) {
            var error = result.error

            if (error) throw error

            wx.showToast({
              title: '状态已更新',
              icon: 'success'
            })

            // 重新加载行程详情
            that.loadPlanDetail()
          })
          .catch(function(error) {
            console.error('更新状态失败:', error)
            wx.showToast({
              title: '更新失败',
              icon: 'none'
            })
          })
      }
    })
  },

  // 更多操作
  showMoreActions: function() {
    var itemList = ['复制行程', '更改状态', '导出行程', '分享行程']
    
    wx.showActionSheet({
      itemList: itemList,
      success: function(res) {
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
      }.bind(this)
    })
  },

  // 导出行程
  exportPlan: function() {
    var plan = this.data.plan
    var content = '【' + plan.title + '】\n\n'
    content += '📍 目的地：' + plan.destination + '\n'
    content += '📅 日期：' + plan.startDate + ' 至 ' + plan.endDate + ' (' + plan.totalDays + '天)\n'
    content += '👥 人数：' + plan.travelers + '人\n'
    content += '💰 预算：¥' + plan.budget + '\n\n'
    
    if (plan.description) {
      content += '📝 描述：' + plan.description + '\n\n'
    }
    
    // 添加每日行程
    if (this.data.dailyItinerary && this.data.dailyItinerary.length > 0) {
      content += '📋 行程安排：\n\n'
      this.data.dailyItinerary.forEach(function(day) {
        content += '第' + day.day + '天 (' + day.date + ')：\n' + day.content + '\n\n'
      })
    }
    
    // 复制到剪贴板
    wx.setClipboardData({
      data: content,
      success: function() {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  },

  // 删除行程
  deletePlan: function() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除"' + (this.data.plan && this.data.plan.title) + '"吗？',
      confirmColor: '#FF6B6B',
      success: function(res) {
        if (res.confirm) {
          var that = this
          supabase
            .from('travel_plans')
            .delete()
            .eq('id', this.data.planId)
            .then(function(result) {
              var error = result.error

              if (error) throw error

              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })

              setTimeout(function() {
                wx.navigateBack()
              }, 1500)
            })
            .catch(function(error) {
              console.error('删除失败:', error)
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              })
            })
        }
      }.bind(this)
    })
  },

  // 测试解析功能（开发调试时使用）
  testParseItinerary: function() {
    if (!this.data.plan || !this.data.plan.itinerary) {
      console.log('没有行程数据可以测试')
      return
    }
    
    console.log('=== 开始测试行程解析 ===')
    console.log('原始行程长度:', this.data.plan.itinerary.length)
    
    var testResult = this.parseItinerary(this.data.plan.itinerary, this.data.plan.totalDays)
    
    console.log('=== 解析结果 ===')
    console.log('解析出的天数:', testResult.length)
    
    var that = this
    testResult.forEach(function(day, index) {
      console.log('--- 第' + (index + 1) + '天 ---')
      console.log('日期:', day.date)
      console.log('内容长度:', day.content.length)
      console.log('活动数量:', day.activities.length)
      
      day.activities.forEach(function(activity, actIndex) {
        console.log('  活动' + (actIndex + 1) + ':', {
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