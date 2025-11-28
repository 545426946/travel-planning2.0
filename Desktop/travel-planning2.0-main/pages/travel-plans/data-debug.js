// 行程数据调试工具
const Auth = require('../../utils/auth').Auth
const supabase = require('../../utils/supabase').supabase

Page({
  data: {
    userInfo: null,
    userId: null,
    debugData: {
      userChecked: false,
      dbConnected: false,
      plansExist: false,
      totalPlans: 0,
      planDetails: []
    },
    isLoading: false
  },

  onLoad() {
    console.log('🔍 数据调试页面加载')
    this.runFullDebug()
  },

  async runFullDebug() {
    this.setData({ isLoading: true })

    try {
      // 步骤1: 检查登录状态
      await this.checkAuthStatus()
      
      // 步骤2: 检查数据库连接
      await this.checkDatabaseConnection()
      
      // 步骤3: 检查用户数据
      await this.checkUserPlans()
      
      // 步骤4: 检查所有数据（管理员视角）
      await this.checkAllPlans()

    } catch (error) {
      console.error('调试过程出错:', error)
      wx.showModal({
        title: '调试失败',
        content: error.message,
        showCancel: false
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 检查认证状态
  async checkAuthStatus() {
    console.log('🔐 检查认证状态...')
    
    const isLoggedIn = Auth.isLoggedIn()
    const userInfo = Auth.getCurrentUser()
    const userId = Auth.getCurrentUserId()
    
    console.log('登录状态:', isLoggedIn)
    console.log('用户信息:', userInfo)
    console.log('用户ID:', userId)

    this.setData({
      userInfo,
      userId,
      'debugData.userChecked': true
    })

    if (!isLoggedIn || !userId) {
      throw new Error('用户未登录或无法获取用户ID')
    }
  },

  // 检查数据库连接
  async checkDatabaseConnection() {
    console.log('🗄️ 检查数据库连接...')
    
    try {
      const result = await supabase
        .from('travel_plans')
        .select('count', { count: 'exact', head: true })
      
      console.log('数据库连接测试结果:', result)
      
      this.setData({
        'debugData.dbConnected': !result.error
      })

      if (result.error) {
        throw new Error(`数据库连接失败: ${result.error.message}`)
      }

    } catch (error) {
      console.error('数据库连接测试失败:', error)
      throw error
    }
  },

  // 检查用户行程
  async checkUserPlans() {
    if (!this.data.userId) {
      throw new Error('缺少用户ID，无法查询行程')
    }

    console.log('📋 检查用户行程，用户ID:', this.data.userId)

    try {
      const result = await supabase
        .from('travel_plans')
        .select('*')
        .eq('user_id', this.data.userId)

      console.log('用户行程查询结果:', result)

      if (result.error) {
        throw new Error(`查询用户行程失败: ${result.error.message}`)
      }

      const plans = result.data || []
      
      this.setData({
        'debugData.plansExist': plans.length > 0,
        'debugData.totalPlans': plans.length,
        'debugData.planDetails': plans
      })

      console.log(`✅ 用户 ${this.data.userId} 有 ${plans.length} 个行程`)

    } catch (error) {
      console.error('检查用户行程失败:', error)
      throw error
    }
  },

  // 检查所有行程（调试用）
  async checkAllPlans() {
    console.log('🌍 检查数据库中所有行程（调试用）...')

    try {
      const result = await supabase
        .from('travel_plans')
        .select('*')
        .limit(10) // 限制数量，避免数据太多

      console.log('所有行程查询结果:', result)

      if (result.error) {
        console.warn('查询所有行程失败（可能是权限问题）:', result.error)
        return
      }

      const allPlans = result.data || []
      console.log(`📊 数据库中共有 ${allPlans.length} 个行程`)

      if (allPlans.length > 0) {
        console.log('行程示例:', allPlans[0])
        console.log('所有用户ID:', [...new Set(allPlans.map(p => p.user_id))])
      }

    } catch (error) {
      console.error('检查所有行程失败:', error)
    }
  },

  // 创建测试数据
  async createTestData() {
    if (!this.data.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    this.setData({ isLoading: true })

    try {
      const testData = {
        user_id: this.data.userId,
        title: '测试行程 - 调试创建',
        description: '这是一个用于测试的行程',
        destination: '测试目的地',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total_days: 2,
        travelers_count: 1,
        total_budget: 1000,
        travel_style: 'comfortable',
        interests: ['测试'],
        itinerary: 'Day 1: 测试行程\nDay 2: 继续测试',
        is_ai_generated: false,
        status: 'planned',
        tags: ['测试数据'],
        transportation: '测试交通',
        accommodation: '测试住宿',
        special_requirements: '无特殊要求'
      }

      console.log('🆕 创建测试数据:', testData)

      const result = await supabase
        .from('travel_plans')
        .insert(testData)
        .select()
        .single()

      console.log('创建结果:', result)

      if (result.error) {
        throw new Error(`创建测试数据失败: ${result.error.message}`)
      }

      wx.showToast({
        title: '测试数据创建成功',
        icon: 'success'
      })

      // 重新检查数据
      setTimeout(() => {
        this.runFullDebug()
      }, 1000)

    } catch (error) {
      console.error('创建测试数据失败:', error)
      wx.showModal({
        title: '创建失败',
        content: error.message,
        showCancel: false
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 清理测试数据
  async cleanTestData() {
    if (!this.data.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认清理',
      content: '确定要删除所有测试行程吗？',
      success: async (res) => {
        if (!res.confirm) return

        this.setData({ isLoading: true })

        try {
          const result = await supabase
            .from('travel_plans')
            .delete()
            .eq('user_id', this.data.userId)
            .ilike('title', '%测试%')

          console.log('清理结果:', result)

          if (result.error) {
            throw new Error(`清理测试数据失败: ${result.error.message}`)
          }

          wx.showToast({
            title: '测试数据清理成功',
            icon: 'success'
          })

          // 重新检查数据
          setTimeout(() => {
            this.runFullDebug()
          }, 1000)

        } catch (error) {
          console.error('清理测试数据失败:', error)
          wx.showModal({
            title: '清理失败',
            content: error.message,
            showCancel: false
          })
        } finally {
          this.setData({ isLoading: false })
        }
      }
    })
  },

  // 返回
  goBack() {
    wx.navigateBack()
  },

  // 复制用户ID到剪贴板
  copyUserId() {
    if (!this.data.userId) {
      wx.showToast({ title: '用户ID为空', icon: 'none' })
      return
    }

    wx.setClipboardData({
      data: String(this.data.userId),
      success: () => {
        wx.showToast({ title: '用户ID已复制', icon: 'success' })
      }
    })
  }
})