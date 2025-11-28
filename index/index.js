// 获取应用实例
const app = getApp()
const supabase = require('../utils/supabase').supabase
const aiIntegration = require('../utils/ai-integration').aiIntegration
const Auth = require('../utils/auth').Auth

Page({
  data: {
    // 当前激活的 Tab
    currentTab: 0,
    // 用户信息
    userInfo: null,
    // 用户统计信息
    stats: {
      visitedPlaces: 0,
      favoriteRoutes: 0
    },
    // 旅行参数
    travelParams: {
      destination: '',
      description: '',
      type: '',
      days: 3,
      travelers: 2,
      budget: 2000,
      style: 'comfortable'
    },
    // AI推荐数据
    aiRecommendations: [],
    // Tabs 数据
    tabs: [
      { 
        text: '首页', 
        icon: 'home',
        activeIcon: 'home-filled'
      },
      { 
        text: '行程规划', 
        icon: 'calendar',
        activeIcon: 'calendar-filled'
      },
      { 
        text: '热门景点', 
        icon: 'location',
        activeIcon: 'location-filled'
      },
      { 
        text: '个人主页', 
        icon: 'person',
        activeIcon: 'person-filled'
      }
    ],
    // Banner 数据
    banners: [
      {
        image: 'https://picsum.photos/seed/banner1/800/400.jpg'
      },
      {
        image: 'https://picsum.photos/seed/banner2/800/400.jpg'
      }
    ],
    // AI 推荐路线数据
    aiRoutes: [
      {
        name: '江南水乡三日游',
        desc: '苏州-杭州经典线路',
        image: 'https://picsum.photos/seed/route1/600/320.jpg'
      },
      {
        name: '川西环线自驾',
        desc: '雪山草原深度体验',
        image: 'https://picsum.photos/seed/route2/600/320.jpg'
      }
    ],
    // 精选目的地数据
    destinations: [
      {
        name: '桂林山水',
        image: 'https://picsum.photos/seed/destination1/400/280.jpg'
      },
      {
        name: '张家界',
        image: 'https://picsum.photos/seed/destination2/400/280.jpg'
      },
      {
        name: '三亚海滩',
        image: 'https://picsum.photos/seed/destination3/400/280.jpg'
      },
      {
        name: '西安古城',
        image: 'https://picsum.photos/seed/destination4/400/280.jpg'
      }
    ],
    // 行程规划数据
    travelPlans: [
      {
        date: '今天',
        from: '北京',
        to: '上海',
        time: '08:00 - 20:00'
      },
      {
        date: '明天',
        from: '上海',
        to: '杭州',
        time: '09:00 - 18:00'
      }
    ],
    // 热门景点数据
    hotSpots: [
      {
        name: '故宫博物院',
        rating: 4.8,
        description: '明清两代皇家宫殿，世界文化遗产',
        image: 'https://picsum.photos/seed/spot1/200/200.jpg'
      },
      {
        name: '九寨沟风景区',
        rating: 4.9,
        description: '以彩池群、瀑布群闻名的自然保护区',
        image: 'https://picsum.photos/seed/spot2/200/200.jpg'
      }
    ],
    // 我的行程数据
    myTravelPlans: [
      {
        title: '云南大理丽江五日游',
        duration: '5天4晚',
        image: 'https://picsum.photos/seed/plan1/400/240.jpg'
      },
      {
        title: '日本东京京都七日游',
        duration: '7天6晚',
        image: 'https://picsum.photos/seed/plan2/400/240.jpg'
      }
    ]
  },

  onLoad() {
    console.log('页面加载完成');
    console.log('当前Tab:', this.data.currentTab);
    console.log('Tab数据:', this.data.tabs);
    
    // 获取用户信息
    const userInfo = Auth.getCurrentUser()
    if (userInfo) {
      this.setData({ userInfo })
      // 加载用户统计信息
      this.loadUserStats()
      // 加载用户的行程数据
      this.loadUserTravelPlans()
    }
    
    // 加载热门景点数据（公共数据）
    this.loadDestinations()
  },

  onShow() {
    // 每次页面显示时检查用户登录状态
    const userInfo = Auth.getCurrentUser()
    this.setData({ userInfo })
    if (userInfo) {
      this.loadUserStats()
      this.loadUserTravelPlans()
    } else {
      // 未登录则清空用户相关数据
      this.setData({
        myTravelPlans: [],
        travelPlans: [],
        stats: { visitedPlaces: 0, favoriteRoutes: 0 }
      })
    }
  },

  // 加载热门景点
  loadDestinations() {
    supabase
      .from('destinations')
      .select('*')
      .eq('is_featured', true)
      .order('rating', { ascending: false })
      .limit(8)
      .then((result) => {
        const data = result.data;
        const error = result.error;
        if (error) {
          console.error('加载景点数据失败:', error)
          return
        }

        // 转换数据格式
        const destinations = (Array.isArray(data) ? data : []).map(item => ({
          name: item.name,
          description: item.description || '',
          image: item.image_url,
          rating: item.rating,
          location: item.location
        }))

        this.setData({ 
          destinations,
          hotSpots: destinations.slice(0, 6).map(item => ({
            name: item.name,
            rating: item.rating,
            description: item.description,
            image: item.image
          }))
        })
        
        console.log('景点数据加载成功:', destinations.length)
      })
      .catch(error => {
        console.error('加载景点数据出错:', error)
      })
  },

  // 加载行程数据（仅加载当前用户的行程）
  loadUserTravelPlans() {
    const userId = Auth.getCurrentUserId()
    
    if (!userId) {
      console.log('用户未登录，跳过加载个人行程')
      return
    }

    supabase
      .from('travel_plans')
      .select('*')
      .eq('user_id', userId)  // 关键：只查询当前用户的行程
      .eq('status', 'planned')
      .order('created_at', { ascending: false })
      .limit(10)
      .then((result) => {
        const data = result.data;
        const error = result.error;
        if (error) {
          console.error('加载行程数据失败:', error)
          return
        }

        // 转换数据格式
        const travelPlans = (Array.isArray(data) ? data : []).map(item => ({
          id: item.id,
          title: item.title,
          duration: this.calculateDuration(item.start_date, item.end_date),
          image: `https://picsum.photos/seed/plan${item.id}/400/240.jpg`,
          destination: item.destination,
          startDate: item.start_date,
          endDate: item.end_date,
          userId: item.user_id  // 保存用户ID用于权限验证
        }))

        this.setData({ 
          myTravelPlans: travelPlans,
          aiRoutes: (Array.isArray(data) ? data.slice(0, 2) : []).map(item => ({
            id: item.id,
            name: item.title,
            desc: item.description || item.destination,
            image: `https://picsum.photos/seed/route${item.id}/600/320.jpg`,
            userId: item.user_id
          }))
        })
        
        console.log('用户行程数据加载成功:', travelPlans.length)
      })
      .catch(error => {
        console.error('加载行程数据出错:', error)
      })
  },

  // 计算行程持续时间
  calculateDuration(startDate, endDate) {
    if (!startDate || !endDate) return '待定'
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    
    return `${days}天${days - 1}晚`
  },

  // 切换 Tab
  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    console.log('切换到Tab索引:', index);
    if (!isNaN(index)) {
      // 如果是行程规划Tab（索引1），跳转到行程规划页面
      if (index === 1) {
        wx.navigateTo({
          url: '/pages/travel-plans/travel-plans'
        });
        return;
      }
      
      this.setData({
        currentTab: index
      });
    }
  },

  // 探索目的地
  exploreDestinations() {
    console.log('探索目的地');
    // 可以跳转到热门景点页面
    this.setData({
      currentTab: 2
    });
  },

  // AI 智能规划行程
  async aiPlanItinerary() {
    console.log('AI 智能规划行程');
    
    // 检查登录状态
    if (!Auth.requireLogin()) {
      return
    }

    // 跳转到AI规划页面
    wx.navigateTo({
      url: '/pages/ai-plan/ai-plan'
    })
  },

  // 智能景点推荐
  async getSmartRecommendations() {
    console.log('获取智能景点推荐');
    
    // 检查登录状态
    if (!Auth.requireLogin()) {
      return
    }

    const userId = Auth.getCurrentUserId()

    wx.showLoading({ title: 'AI 正在推荐...' });
    
    try {
      const result = await aiIntegration.getSmartDestinationRecommendations(userId);

      wx.hideLoading();

      if (result.success) {
        this.setData({ 
          aiRecommendations: result.recommendations.destinations || []
        });
        
        wx.showToast({
          title: '推荐获取成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '推荐获取失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('获取推荐失败:', error);
      wx.showToast({
        title: '推荐获取失败',
        icon: 'none'
      });
    }
  },

  // AI 问答助手
  async showAIHelper() {
    console.log('AI 问答助手');
    
    const userId = Auth.getCurrentUserId()
    
    wx.showModal({
      title: 'AI 旅行助手',
      content: '请输入您的旅行问题，我会为您详细解答',
      editable: true,
      placeholderText: '例如：云南最佳旅游时间是什么时候？',
      success: async (res) => {
        if (res.confirm && res.content.trim()) {
          wx.showLoading({ title: 'AI 正在思考...' });
          
          try {
            const result = await aiIntegration.askTravelQuestion(
              userId,
              res.content
            );

            wx.hideLoading();

            if (result.success) {
              this.showAIResultModal('AI 回答', result.answer);
            } else {
              wx.showToast({
                title: 'AI 回答失败',
                icon: 'none'
              });
            }
          } catch (error) {
            wx.hideLoading();
            console.error('AI 问答失败:', error);
            wx.showToast({
              title: 'AI 回答失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 显示AI结果模态框
  showAIResultModal(title, content) {
    wx.showModal({
      title: title,
      content: content.length > 500 ? content.substring(0, 500) + '更多' : content,
      showCancel: false,
      confirmText: '知道了',
      success: () => {
        if (content.length > 500) {
          // 长内容可以复制到剪贴板
          wx.setClipboardData({
            data: content,
            success: () => {
              wx.showToast({
                title: '完整内容已复制',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  },

  // 添加新计划方法（支持AI和手动创建）
  addNewPlan() {
    console.log('新建行程');
    
    // 提供AI辅助和手动创建选项
    wx.showActionSheet({
      itemList: ['AI 智能规划', '手动创建行程'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.aiPlanItinerary();
        } else if (res.tapIndex === 1) {
          this.createManualPlan();
        }
      }
    });
  },

  // 手动创建行程
  async createManualPlan() {
    // 检查登录状态
    if (!Auth.requireLogin()) {
      return
    }

    const userId = Auth.getCurrentUserId()

    // 示例：创建一个新行程
    const newPlan = {
      title: '新旅行计划',
      description: '这是一个新创建的旅行计划',
      destination: '待定',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      budget: 2000,
      travel_type: 'leisure',
      status: 'planned',
      user_id: userId,  // 关键：设置为当前用户ID
      is_ai_generated: false,
      tags: ['自由行', '休闲']
    }

    supabase
      .from('travel_plans')
      .insert(newPlan)
      .select()
      .then((result) => {
        const data = result.data;
        const error = result.error;
        if (error) {
          console.error('创建行程失败:', error)
          wx.showToast({
            title: '创建失败',
            icon: 'none'
          });
          return
        }

        wx.showToast({
          title: '创建成功',
          icon: 'success'
        });

        // 重新加载用户的行程数据
        this.loadUserTravelPlans()
      })
      .catch(error => {
        console.error('创建行程出错:', error)
        wx.showToast({
          title: '创建失败',
          icon: 'none'
        });
      })
  },

  // 跳转到登录页面
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  // 加载用户统计信息
  async loadUserStats() {
    const userId = Auth.getCurrentUserId()
    
    if (!userId) {
      console.log('用户未登录，跳过加载统计信息')
      return
    }

    try {
      // 并行查询用户统计数据（只查询当前用户的数据）
      const results = await Promise.all([
        // 查询用户的行程数量
        supabase
          .from('travel_plans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)  // 关键：只统计当前用户的数据
          .eq('status', 'completed'),
        
        // 查询用户的收藏数量
        supabase
          .from('user_favorites')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)  // 关键：只统计当前用户的数据
      ])

      const visitedPlaces = results[0].count || 0
      const favoriteRoutes = results[1].count || 0

      this.setData({
        stats: {
          visitedPlaces,
          favoriteRoutes
        }
      })

      console.log('用户统计信息:', { visitedPlaces, favoriteRoutes })
    } catch (error) {
      console.error('加载用户统计信息失败:', error)
    }
  },

  // 用户登出
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗?',
      confirmText: '退出',
      confirmColor: '#FF6B6B',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 使用Auth工具清除登录信息
          Auth.clearUserLogin()

          // 更新页面状态
          this.setData({ 
            userInfo: null,
            stats: { visitedPlaces: 0, favoriteRoutes: 0 },
            myTravelPlans: [],
            travelPlans: [],
            aiRecommendations: [],
            currentTab: 0  // 切换到首页
          })

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          })

          // 重新加载基础数据（不依赖用户的数据）
          setTimeout(() => {
            this.loadDestinations()
          }, 500)
        }
      }
    })
  },

  // 用户个人资料
  showUserOptions() {
    if (!this.data.userInfo) {
      this.goToLogin()
      return
    }

    wx.showActionSheet({
      itemList: ['个人资料', '我的收藏', '设置', '退出登录'],
      itemColor: '#2c3e50',
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            // 个人资料
            this.showUserProfile()
            break
          case 1:
            // 我的收藏
            this.setData({ currentTab: 3 })
            break
          case 2:
            // 设置
            this.showSettings()
            break
          case 3:
            // 退出登录
            this.logout()
            break
        }
      }
    })
  },

  // 显示用户个人资料
  showUserProfile() {
    const userInfo = this.data.userInfo;
      const stats = this.data.stats;
    
    wx.showModal({
      title: '个人资料',
      content: '姓名：' + userInfo.name + '\n登录方式：' + (userInfo.loginType === 'wechat' ? '微信登录' : '账号登录') + '\n去过的地方：' + stats.visitedPlaces + '\n收藏路线：' + stats.favoriteRoutes,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 显示设置
  showSettings() {
    wx.showModal({
      title: '设置',
      content: '更多设置功能正在开发中',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 从热门景点生成行程
  async generateItineraryFromSpot(e) {
    const spot = e.currentTarget.dataset.spot
    
    if (!Auth.requireLogin()) {
      return
    }

    // 显示行程参数选择弹窗
    this.showTravelPlanModal({
      destination: spot.name,
      description: spot.description,
      type: 'hotspot'
    })
  },

  // 从精选目的地生成行程
  async generateItineraryFromDestination(e) {
    const destination = e.currentTarget.dataset.destination
    
    if (!Auth.requireLogin()) {
      return
    }

    // 显示行程参数选择弹窗
    this.showTravelPlanModal({
      destination: destination.name,
      description: destination.description,
      type: 'destination'
    })
  },

  // 使用AI生成行程
  async generateItineraryWithAI(params) {
    const userId = Auth.getCurrentUserId()
    const { destination, description, type, days = 3, travelers = 2, budget = 2000, style = 'comfortable' } = params
    
    // 如果AI调用失败，使用预设的行程模板
    const generateDefaultItinerary = (dest, totalDays, totalTravelers, totalBudget, travelStyle) => {
      // 根据目的地生成特色内容
      const getDestinationInfo = (destination) => {
        const destMap = {
          '北京': {
            attractions: ['故宫博物院', '天安门广场', '长城', '颐和园'],
            food: ['北京烤鸭', '炸酱面', '豆汁儿', '护国寺小吃'],
            tips: '北京历史文化丰富，建议提前预约门票'
          },
          '上海': {
            attractions: ['外滩', '东方明珠塔', '豫园', '南京路步行街'],
            food: ['小笼包', '生煎包', '上海本帮菜', '糖醋排骨'],
            tips: '上海现代化程度高，交通便利，注意节假日期间人流'
          },
          '杭州': {
            attractions: ['西湖', '灵隐寺', '雷峰塔', '宋城'],
            food: ['西湖醋鱼', '东坡肉', '龙井虾仁', '叫花鸡'],
            tips: '杭州风景优美，春季最佳，注意景区内交通安排'
          },
          '三亚': {
            attractions: ['天涯海角', '亚龙湾', '南山文化旅游区', '大东海'],
            food: ['海鲜大餐', '椰子鸡', '海南粉', '清补凉'],
            tips: '三亚热带气候，注意防晒，带好防晒用品'
          },
          '西安': {
            attractions: ['兵马俑', '大雁塔', '古城墙', '回民街'],
            food: ['肉夹馍', '羊肉泡馍', '凉皮', 'biangbiang面'],
            tips: '西安历史悠久，美食众多，建议合理安排时间'
          }
        }
        
        return destMap[destination] || {
          attractions: ['当地著名景点', '历史文化景区', '自然风光', '特色街区'],
          food: ['当地特色美食', '传统小吃', '地方菜肴', '特色饮品'],
          tips: '请提前了解当地天气和景点开放时间，做好出行准备'
        }
      }
      
      const info = getDestinationInfo(dest)
      
      // 根据旅行风格调整内容
      const getStyleContent = (style, totalBudget, totalTravelers) => {
        const styleDescriptions = {
          'budget': {
            accommodation: '经济型酒店或青年旅社',
            food: '当地特色小吃和街边美食',
            transport: '公共交通和步行',
            tips: '选择免费景点和优惠活动，提前预订获得折扣'
          },
          'comfortable': {
            accommodation: '市中心舒适酒店',
            food: '知名餐厅和特色美食',
            transport: '出租车和地铁结合',
            tips: '合理安排景点参观时间，避免高峰期'
          },
          'premium': {
            accommodation: '精品酒店或星级酒店',
            food: '高档餐厅和米其林推荐',
            transport: '专车或包车服务',
            tips: '预订VIP服务，享受优先通道'
          },
          'luxury': {
            accommodation: '五星级酒店或度假村',
            food: '顶级餐厅和私房菜',
            transport: '专车接送和直升机游览',
            tips: '安排私人导游，定制专属行程'
          },
          'adventure': {
            accommodation: '特色民宿或露营',
            food: '当地农家菜和野味',
            transport: '徒步和户外探险',
            tips: '准备专业装备，注意安全防护'
          }
        }
        
        return styleDescriptions[style] || styleDescriptions['comfortable']
      }
      
      const styleContent = getStyleContent(travelStyle, totalBudget, totalTravelers)
      const budgetPerDay = Math.floor(totalBudget / totalDays)
      const budgetPerPersonPerDay = Math.floor(totalBudget / totalDays / totalTravelers)
      
      let itinerary = `📍 ${dest}${totalDays}天${totalDays-1}夜${this.getStyleName(travelStyle)}行程\n\n`
      
      // 为每一天生成行程
      for (let day = 1; day <= totalDays; day++) {
        const attractionIndex = (day - 1) % info.attractions.length
        const foodIndex = (day - 1) % info.food.length
        
        if (day === 1) {
          itinerary += `第${day}天：
🌅 上午：抵达${dest}，入住${styleContent.accommodation}，适应当地环境
🍽️ 中午：品尝${styleContent.food}——${info.food[foodIndex]}
☀️ 下午：参观${info.attractions[attractionIndex]}，感受当地历史文化
🌙 晚上：体验当地夜生活，享用特色晚餐\n\n`
        } else if (day === totalDays) {
          itinerary += `第${day}天：
🌅 上午：游览${info.attractions[(attractionIndex + 1) % info.attractions.length]}，完成最后的观光
🍽️ 中午：享用告别午宴，品味最后一道${info.food[(foodIndex + 1) % info.food.length]}
☀️ 下午：自由活动或购物，购买特色纪念品
🌙 晚上：整理行装，准备返程\n\n`
        } else {
          itinerary += `第${day}天：
🌅 上午：深度游览${info.attractions[(attractionIndex + 1) % info.attractions.length]}，探索更多精彩
🍽️ 中午：在景区附近享用${info.food[(foodIndex + 1) % info.food.length]}
☀️ 下午：参观${info.attractions[(attractionIndex + 2) % info.attractions.length]}，拍照留念
🌙 晚上：体验当地特色活动，购买纪念品\n\n`
        }
      }
      
      itinerary += `💰 费用预算：
- 总预算：¥${totalBudget} (${totalDays}天 × ${totalTravelers}人)
- 人均预算：¥${Math.floor(totalBudget / totalTravelers)}
- 每日人均：¥${budgetPerPersonPerDay}

🎯 旅行风格：${this.getStyleName(travelStyle)}
- 住宿：${styleContent.accommodation}
- 餐饮：${styleContent.food}
- 交通：${styleContent.transport}

💡 贴心提示：
- ${info.tips}
- ${styleContent.tips}
- 建议提前查看天气预报，准备合适的衣物
- 注意保管个人财物，确保旅行安全`
      
      return itinerary
    }
    
    let itinerary = ''
    
    try {
      // 根据旅行风格生成对应的提示词
      const getStylePrompt = (style, totalBudget, totalTravelers) => {
        const stylePrompts = {
          'budget': `预算有限，注重性价比。优先选择免费景点、经济型住宿和当地特色小吃。使用公共交通，寻找优惠活动。`,
          'comfortable': `平衡体验与花费。选择舒适酒店、知名餐厅和便捷交通。合理安排时间，避免过于紧张。`,
          'premium': `追求品质体验。选择精品住宿、高档餐厅和专车服务。包含VIP体验和特色活动。`,
          'luxury': `尊贵享受。选择五星级酒店、米其林餐厅和私人服务。包含高端活动和专属体验。`,
          'adventure': `特色体验。选择户外住宿、当地美食和徒步探险。包含刺激活动和深度文化体验。`
        }
        
        const budgetPerPerson = Math.floor(totalBudget / totalTravelers)
        return stylePrompts[style] + `\n预算说明：总预算¥${totalBudget}，人均¥${budgetPerPerson}，请合理安排各项花费。`
      }

      const prompt = `请为${destination}生成一个${days}天${travelers}人的详细旅行计划。
      
地点信息：${description || '热门旅游景点'}

旅行参数：
- 旅行天数：${days}天
- 出行人数：${travelers}人  
- 总预算：¥${budget}
- 旅行风格：${this.getStyleName(style)}

旅行风格要求：
${getStylePrompt(style, budget, travelers)}

请按照以下格式生成行程：
Day 1 - ${startDate.toISOString().split('T')[0]}：
🌅 上午 (8:00-12:00)：[具体活动安排]
🍽️ 中午 (12:00-13:00)：[午餐建议]
☀️ 下午 (13:00-17:00)：[具体活动安排]
🌙 晚上 (18:00-22:00)：[晚餐和晚间活动]

Day 2 - ${new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}：
🌅 上午 (8:00-12:00)：[具体活动安排]
🍽️ 中午 (12:00-13:00)：[午餐建议]
☀️ 下午 (13:00-17:00)：[具体活动安排]
🌙 晚上 (18:00-22:00)：[晚餐和晚间活动]

${days >= 3 ? `
Day 3 - ${new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}：
🌅 上午 (8:00-12:00)：[具体活动安排]
🍽️ 中午 (12:00-13:00)：[午餐建议]
☀️ 下午 (13:00-17:00)：[具体活动安排]
🌙 晚上 (18:00-22:00)：[晚餐和晚间活动]` : ''}

${days >= 4 ? `
Day 4 - ${new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}：
🌅 上午 (8:00-12:00)：[具体活动安排]
🍽️ 中午 (12:00-13:00)：[午餐建议]
☀️ 下午 (13:00-17:00)：[具体活动安排]
🌙 晚上 (18:00-22:00)：[晚餐和晚间活动]` : ''}

要求：
1. 结合当地特色和文化，${type === 'hotspot' ? '重点突出景点特色' : '全面展示目的地亮点'}
2. 根据旅行风格选择合适的住宿、餐饮和交通方式
3. 预算分配合理：住宿约占40%，餐饮约占25%，交通约占20%，门票约占10%，其他约占15%
4. 时间安排合理，不要太赶，考虑${travelers}人的团队体验
5. 每日活动要有具体时间、地点和特色内容
6. 考虑季节性和实际可行性`

      // 调用AI服务生成行程
      const aiService = require('../utils/ai-service').aiService
      
      wx.showLoading({ title: 'AI正在规划中...' })
      
      const response = await aiService.callAPI([
        {
          role: 'system',
          content: '你是一个专业的旅行规划师，擅长为用户制定详细、实用的旅行行程。'
        },
        {
          role: 'user',
          content: prompt
        }
      ])

      wx.hideLoading()
      
      console.log('AI API完整响应:', response)
      
      // 处理不同的响应格式
      if (typeof response === 'string') {
        itinerary = response
      } else if (response && response.choices && response.choices[0] && response.choices[0].message) {
        itinerary = response.choices[0].message.content
      } else if (response && response.content) {
        itinerary = response.content
      } else {
        console.warn('AI响应格式异常，使用默认行程')
        itinerary = generateDefaultItinerary(destination)
      }
      
      // 如果仍然为空，使用默认行程
      if (!itinerary || itinerary.trim() === '') {
        console.warn('AI行程为空，使用默认行程')
        itinerary = generateDefaultItinerary(destination, days, travelers, budget, style)
      }
      
      console.log('最终行程内容长度:', itinerary.length)
      console.log('行程内容预览:', itinerary.substring(0, 100) + '...')
      
      } catch (error) {
        console.error('AI调用失败，使用默认行程:', error)
        itinerary = generateDefaultItinerary(destination, days, travelers, budget, style)
      }

    // 保存到数据库
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + (days - 1) * 24 * 60 * 60 * 1000) // 根据用户选择的天数计算结束日期
    
      console.log('生成行程的日期范围:', {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: days,
        travelers: travelers,
        budget: budget,
        style: style
      })
    
    // 获取旅行风格名称
    const getStyleName = (style) => {
      const styleNames = {
        'budget': '经济实惠型',
        'comfortable': '舒适享受型',
        'premium': '品质出行型',
        'luxury': '奢华体验型',
        'adventure': '探险刺激型'
      }
      return styleNames[style] || '舒适享受型'
    }
    
    const newPlan = {
      user_id: userId,
      title: `${destination}${days}天${days-1}夜${getStyleName(style)}`,
      description: `AI为您定制的${destination}${days}天${travelers}人${getStyleName(style)}，预算¥${budget}`,
      destination: destination,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      total_days: days,
      travelers_count: travelers,
      total_budget: budget,
      travel_style: style,
      status: 'planned',
      is_ai_generated: true,
      tags: ['AI生成', destination, getStyleName(style), `${days}天游`],
      transportation: this.getTransportationSuggestion(style),
      accommodation: this.getAccommodationSuggestion(style),
      special_requirements: this.getSpecialRequirements(style, destination),
      itinerary: itinerary
    }

    try {
      const { data, error } = await supabase
        .from('travel_plans')
        .insert(newPlan)
        .select()

      if (error) {
        throw error
      }

      const planId = data?.[0]?.id
      if (!planId) {
        throw new Error('保存行程失败')
      }

      return {
        success: true,
        planId: planId,
        message: '行程生成成功'
      }
    } catch (dbError) {
      console.error('保存行程失败:', dbError)
      throw new Error('保存行程失败: ' + dbError.message)
    }
  },

  // 获取旅行风格名称
  getStyleName(style) {
    const styleNames = {
      'budget': '经济实惠型',
      'comfortable': '舒适享受型',
      'premium': '品质出行型',
      'luxury': '奢华体验型',
      'adventure': '探险刺激型'
    }
    return styleNames[style] || '舒适享受型'
  },

  // 获取交通建议
  getTransportationSuggestion(style) {
    const suggestions = {
      'budget': '建议使用公共交通（地铁、公交）和步行',
      'comfortable': '建议使用出租车、地铁和步行结合',
      'premium': '建议使用专车服务或租车',
      'luxury': '建议使用专车接送、包车或直升机游览',
      'adventure': '建议使用户外交通工具和徒步'
    }
    return suggestions[style] || suggestions['comfortable']
  },

  // 获取住宿建议
  getAccommodationSuggestion(style) {
    const suggestions = {
      'budget': '建议选择经济型酒店、青年旅社或民宿',
      'comfortable': '建议选择市中心舒适酒店或精品民宿',
      'premium': '建议选择星级酒店或精品度假村',
      'luxury': '建议选择五星级酒店或奢华度假村',
      'adventure': '建议选择特色民宿、露营或当地人家'
    }
    return suggestions[style] || suggestions['comfortable']
  },

  // 获取特殊要求
  getSpecialRequirements(style, destination) {
    const requirements = {
      'budget': `请携带学生证或相关证件以获得优惠，建议下载${destination}旅游APP获取折扣信息`,
      'comfortable': `建议提前了解${destination}天气情况，准备舒适的步行鞋和常用药品`,
      'premium': `建议预订VIP服务，携带商务服装，了解高端餐厅的着装要求`,
      'luxury': `建议预订私人导游服务，准备正装，了解高端场所的消费习惯`,
      'adventure': `请准备专业户外装备、防晒用品和急救包，确保户外活动安全`
    }
    return requirements[style] || requirements['comfortable']
  },

  // 显示行程参数选择弹窗
  showTravelPlanModal(params) {
    const { destination, description, type } = params
    
    wx.showModal({
      title: `定制${destination}行程`,
      content: '请选择您的旅行偏好，AI将为您量身定制行程',
      showCancel: false,
      confirmText: '开始定制',
      success: (res) => {
        if (res.confirm) {
          this.showTravelParameterSelector(params)
        }
      }
    })
  },

  // 显示详细的行程参数选择器
  showTravelParameterSelector(params) {
    const { destination, description, type } = params
    
    // 使用页面数据存储参数
    this.setData({
      travelParams: {
        destination: destination,
        description: description,
        type: type,
        days: 3,
        travelers: 2,
        budget: 2000,
        style: 'comfortable'
      }
    })
    
    // 创建自定义参数选择界面
    wx.showActionSheet({
      itemList: ['3天2夜', '4天3夜', '5天4夜', '7天6夜', '自定义天数'],
      success: (res) => {
        let days = 3
        switch (res.tapIndex) {
          case 0: days = 3; break
          case 1: days = 4; break
          case 2: days = 5; break
          case 3: days = 7; break
          case 4: this.showCustomDaysInput(params); return
        }
        
        this.setData({
          'travelParams.days': days
        })
        this.showTravelersSelector(params)
      }
    })
  },

  // 自定义天数输入
  showCustomDaysInput(params) {
    wx.showModal({
      title: '自定义旅行天数',
      editable: true,
      placeholderText: '请输入天数(1-30天)',
      success: (res) => {
        if (res.confirm) {
          const days = parseInt(res.content)
          if (days && days >= 1 && days <= 30) {
            this.setData({
              'travelParams.days': days
            })
            this.showTravelersSelector(params)
          } else {
            wx.showToast({
              title: '请输入1-30之间的数字',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 显示人数选择
  showTravelersSelector(params) {
    wx.showActionSheet({
      itemList: ['1人', '2人', '3-4人', '5-8人', '自定义人数'],
      success: (res) => {
        let travelers = 2
        switch (res.tapIndex) {
          case 0: travelers = 1; break
          case 1: travelers = 2; break
          case 2: travelers = 3; break
          case 3: travelers = 6; break
          case 4: this.showCustomTravelersInput(params); return
        }
        
        this.setData({
          'travelParams.travelers': travelers
        })
        this.showBudgetSelector(params)
      }
    })
  },

  // 自定义人数输入
  showCustomTravelersInput(params) {
    wx.showModal({
      title: '自定义出行人数',
      editable: true,
      placeholderText: '请输入人数(1-20人)',
      success: (res) => {
        if (res.confirm) {
          const travelers = parseInt(res.content)
          if (travelers && travelers >= 1 && travelers <= 20) {
            this.setData({
              'travelParams.travelers': travelers
            })
            this.showBudgetSelector(params)
          } else {
            wx.showToast({
              title: '请输入1-20之间的数字',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 显示预算选择
  showBudgetSelector(params) {
    const { destination } = params
    wx.showActionSheet({
      itemList: [
        `经济实惠 (¥500-1000)`,
        `舒适享受 (¥1000-3000)`,
        `品质出行 (¥3000-5000)`,
        `奢华体验 (¥5000-10000)`,
        '自定义预算'
      ],
      success: (res) => {
        let budget = 2000
        switch (res.tapIndex) {
          case 0: budget = 800; break
          case 1: budget = 2000; break
          case 2: budget = 4000; break
          case 3: budget = 8000; break
          case 4: this.showCustomBudgetInput(params); return
        }
        
        this.setData({
          'travelParams.budget': budget
        })
        this.showTravelStyleSelector(params)
      }
    })
  },

  // 自定义预算输入
  showCustomBudgetInput(params) {
    wx.showModal({
      title: '自定义旅行预算',
      editable: true,
      placeholderText: '请输入预算金额(元)',
      success: (res) => {
        if (res.confirm) {
          const budget = parseInt(res.content)
          if (budget && budget >= 100 && budget <= 100000) {
            this.setData({
              'travelParams.budget': budget
            })
            this.showTravelStyleSelector(params)
          } else {
            wx.showToast({
              title: '请输入100-100000之间的金额',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 显示旅行风格选择
  showTravelStyleSelector(params) {
    wx.showActionSheet({
      itemList: [
        '经济实惠型 (注重性价比)',
        '舒适享受型 (平衡体验与花费)',
        '品质出行型 (追求品质)',
        '奢华体验型 (尊贵享受)',
        '探险刺激型 (特色体验)'
      ],
      success: (res) => {
        let style = 'comfortable'
        switch (res.tapIndex) {
          case 0: style = 'budget'; break
          case 1: style = 'comfortable'; break
          case 2: style = 'premium'; break
          case 3: style = 'luxury'; break
          case 4: style = 'adventure'; break
        }
        
        this.setData({
          'travelParams.style': style
        })
        
        // 确认所有参数后，生成行程
        this.confirmAndGenerateItinerary()
      }
    })
  },

  // 确认参数并生成行程
  confirmAndGenerateItinerary() {
    const params = this.data.travelParams
    const { destination, days, travelers, budget, style } = params
    
    // 显示确认信息
    const styleText = {
      'budget': '经济实惠型',
      'comfortable': '舒适享受型', 
      'premium': '品质出行型',
      'luxury': '奢华体验型',
      'adventure': '探险刺激型'
    }
    
    wx.showModal({
      title: '确认行程参数',
      content: `目的地：${destination}\n旅行天数：${days}天\n出行人数：${travelers}人\n预算金额：¥${budget}\n旅行风格：${styleText[style]}`,
      confirmText: '开始生成',
      cancelText: '重新设置',
      success: (res) => {
        if (res.confirm) {
          this.generateAIItineraryWithParams(params)
        } else {
          // 重新开始参数选择
          this.showTravelPlanModal(params)
        }
      }
    })
  },

  // 根据用户参数生成AI行程
  async generateAIItineraryWithParams(params) {
    const { destination, description, type, days, travelers, budget, style } = params
    
    wx.showLoading({ title: 'AI正在为您定制行程...' })
    
    try {
      const result = await this.generateItineraryWithAI({
        destination: destination,
        description: description,
        type: type,
        days: days,
        travelers: travelers,
        budget: budget,
        style: style
      })
      
      wx.hideLoading()
      
      if (result.success) {
        wx.showModal({
          title: '行程定制成功',
          content: `已为您生成${destination}的${days}天${travelers}人个性化行程安排，是否立即查看？`,
          confirmText: '查看行程',
          cancelText: '稍后查看',
          success: (res) => {
            if (res.confirm && result.planId) {
              wx.navigateTo({
                url: `/pages/plan-detail/plan-detail?id=${result.planId}`
              })
            }
          }
        })
      } else {
        wx.showToast({
          title: result.message || '生成失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('生成行程失败:', error)
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      })
    }
  },

  // 图片加载错误处理
  onImageError(e) {
    console.log('图片加载失败:', e.detail);
    // 可以设置默认图片
  }
});