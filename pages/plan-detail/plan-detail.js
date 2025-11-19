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
    dailyItinerary: []
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

      this.setData({
        plan,
        dailyItinerary,
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
    
    // 增强的解析：支持多种AI格式
    let dayContents = []
    
    // 尝试匹配详细格式（Day X - 日期）
    const detailDayPattern = /Day\s*(\d+)[\s-]*([^:
]*?)[:：]?([\s\S]*?)(?=Day\s*\d+|$)/gi
    let match
    const detailDays = []
    
    // 重置正则表达式
    const newPattern = new RegExp(detailDayPattern.source, detailDayPattern.flags)
    
    while ((match = newPattern.exec(itinerary)) !== null) {
      detailDays.push({
        dayNum: parseInt(match[1]),
        date: match[2].trim(),
        content: match[3].trim()
      })
    }
    
    if (detailDays.length > 0) {
      // 使用详细格式的数据
      dayContents = detailDays
    } else {
      // 尝试简单格式（第X天）
      const simpleDayPattern = /第([一二三四五六七八九十\d]+)天[\s:：]([\s\S]*?)(?=第[一二三四五六七八九十\d]+天|$)/gi
      const simplePattern = new RegExp(simpleDayPattern.source, simpleDayPattern.flags)
      
      while ((match = simplePattern.exec(itinerary)) !== null) {
        const dayNum = this.chineseToNumber(match[1])
        dayContents.push({
          dayNum: dayNum,
          date: '',
          content: match[2].trim()
        })
      }
      
      // 如果还是没有，按阿拉伯数字分割
      if (dayContents.length === 0) {
        const arabicDayPattern = /Day\s*(\d+)[\s:：]([\s\S]*?)(?=Day\s*\d+|$)/gi
        const arabicPattern = new RegExp(arabicDayPattern.source, arabicDayPattern.flags)
        
        while ((match = arabicPattern.exec(itinerary)) !== null) {
          dayContents.push({
            dayNum: parseInt(match[1]),
            date: '',
            content: match[2].trim()
          })
        }
      }
    }

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
    }

    return dailyPlans
  },

  // 提取活动项
  extractActivities(content) {
    const activities = []
    
    // 详细时间模式：支持上午/下午/晚上 + 具体时间
    const timePatterns = [
      // 具体时间：8:00-12:00
      /(\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})?[\s:：]*([^\n]+)/g,
      // 时段模式：上午 (8:00-12:00)
      /(上午|下午|晚上|深夜|凌晨)\s*[\(（](\d{1,2}[:：]\d{2})\s*[-–—]\s*(\d{1,2}[:：]\d{2})[\)）][\s:：]*([^\n]+)/g,
      // 简单时段：上午、下午、晚上
      /(上午|下午|晚上)[\s:：]*([^\n]+)/g,
      // 餐饮时间
      /(早餐|午餐|晚餐|夜宵)[\s:：]*([^\n]+)/g
    ]
    
    // 尝试每种模式
    for (const pattern of timePatterns) {
      let match
      const newPattern = new RegExp(pattern.source, pattern.flags)
      
      while ((match = newPattern.exec(content)) !== null) {
        let time = ''
        let title = ''
        
        if (match.length >= 4 && match[1].includes(':')) {
          // 具体时间格式
          time = match[1] + (match[2] ? ' - ' + match[2] : '')
          title = match[3] || match[2] || ''
        } else if (match.length >= 3) {
          // 时段格式
          time = match[1]
          title = match[2]
        } else {
          // 简单格式
          time = match[1]
          title = match[2] || ''
        }
        
        // 清理标题
        title = title.trim().replace(/^[:：\s]+/, '')
        
        // 跳过无效活动
        if (title && title.length > 2 && !title.includes('费用') && !title.includes('总计')) {
          activities.push({
            time: time,
            title: title.substring(0, 60),
            location: this.extractLocation(title),
            price: this.extractPrice(title),
            type: this.getActivityType(time, title)
          })
        }
      }
      
      // 如果找到了活动，就不再尝试其他模式
      if (activities.length > 0) break
    }

    // 如果还是没有找到，按行智能分割
    if (activities.length === 0) {
      const lines = content.split('\n').filter(l => l.trim())
      const timeKeywords = ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']
      
      lines.forEach(line => {
        const trimmedLine = line.trim()
        if (trimmedLine && !trimmedLine.match(/^(第|Day|费用|总计|交通|住宿|餐饮)/)) {
          let time = '全天'
          
          // 检查是否包含时间关键词
          for (const timeKeyword of timeKeywords) {
            if (trimmedLine.includes(timeKeyword)) {
              time = timeKeyword
              break
            }
          }
          
          activities.push({
            time: time,
            title: trimmedLine.substring(0, 60),
            location: this.extractLocation(trimmedLine),
            price: this.extractPrice(trimmedLine),
            type: this.getActivityType(time, trimmedLine)
          })
        }
      })
    }

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
    const match = text.match(/(?:在|到|前往|参观|游览)\s*([^，。,
]+)/)
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

  // 添加活动
  addActivity() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 高德地图导航
  navigateToMap() {
    if (!this.data.plan?.destination) {
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
              status: 'planned',
              is_ai_generated: false, // 复制的行程标记为手动创建
              tags: plan.tags || [],
              transportation: plan.transportation,
              accommodation: plan.accommodation,
              special_requirements: plan.specialRequirements,
              itinerary: plan.itinerary,
              interests: typeof plan.interests === 'string' ? plan.interests : JSON.stringify(plan.interests || [])
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

  // 编辑行程
  editPlan() {
    wx.showToast({
      title: '编辑功能开发中',
      icon: 'none'
    })
  },

  // 修改状态
  changeStatus() {
    const statuses = ['planned', 'ongoing', 'completed']
    const currentIndex = statuses.indexOf(this.data.plan.status)
    const nextIndex = (currentIndex + 1) % statuses.length
    const nextStatus = statuses[nextIndex]

    wx.showModal({
      title: '修改状态',
      content: `将状态修改为：${this.getStatusText(nextStatus)}`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const { error } = await supabase
              .from('travel_plans')
              .update({ status: nextStatus })
              .eq('id', this.data.planId)

            if (error) throw error

            // 更新本地数据
            this.setData({
              'plan.status': nextStatus
            })

            wx.showToast({
              title: '状态已更新',
              icon: 'success'
            })
          } catch (error) {
            console.error('更新状态失败:', error)
            wx.showToast({
              title: '更新失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 复制行程
  duplicatePlan() {
    wx.showModal({
      title: '复制行程',
      content: '确定要复制这个行程吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const plan = this.data.plan
            const newPlan = {
              user_id: Auth.getCurrentUserId(),
              title: plan.title + ' - 副本',
              description: plan.description,
              destination: plan.destination,
              start_date: plan.startDate,
              end_date: plan.endDate,
              total_budget: plan.budget,
              total_days: plan.totalDays,
              travelers_count: plan.travelers,
              travel_style: plan.travelStyle,
              interests: plan.interests,
              itinerary: plan.itinerary,
              is_ai_generated: false, // 复制的行程标记为非AI生成
              status: 'planned',
              tags: plan.tags,
              transportation: plan.transportation,
              accommodation: plan.accommodation,
              special_requirements: plan.specialRequirements
            }

            const { error } = await supabase
              .from('travel_plans')
              .insert(newPlan)

            if (error) throw error

            wx.showToast({
              title: '复制成功',
              icon: 'success'
            })

            // 询问是否查看新行程
            setTimeout(() => {
              wx.showModal({
                title: '复制成功',
                content: '是否查看复制的新行程？',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.redirectTo({
                      url: `/pages/plan-detail/plan-detail?id=${newPlan.id}`
                    })
                  }
                }
              })
            }, 1500)

          } catch (error) {
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

  // 显示更多操作
  showMoreActions() {
    const actions = ['分享行程', '导出PDF', '删除行程']
    
    wx.showActionSheet({
      itemList: actions,
      success: async (res) => {
        switch (res.tapIndex) {
          case 0:
            this.sharePlan()
            break
          case 1:
            this.exportPDF()
            break
          case 2:
            this.deletePlan()
            break
        }
      }
    })
  },

  // 分享行程
  sharePlan() {
    const plan = this.data.plan
    const shareText = `📍 ${plan.destination}
📅 ${plan.startDate} 至 ${plan.endDate}
👥 ${plan.travelers}人
💰 预算¥${plan.budget}

${plan.title}`

    wx.showShareMenu({
      withShareTicket: true,
      success: () => {
        // 也可以复制到剪贴板
        wx.setClipboardData({
          data: shareText,
          success: () => {
            wx.showToast({
              title: '行程信息已复制',
              icon: 'success'
            })
          }
        })
      }
    })
  },

  // 导出PDF
  exportPDF() {
    wx.showToast({
      title: '导出功能开发中',
      icon: 'none'
    })
  },

  // 删除行程
  deletePlan() {
    wx.showModal({
      title: '删除行程',
      content: '确定要删除这个行程吗？此操作不可撤销。',
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
            console.error('删除行程失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 返回上一页
  navigateBack() {
    wx.navigateBack()
  }
})
