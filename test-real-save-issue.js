// 更真实的测试 - 模拟微信小程序环境
const { aiIntegration } = require('./utils/ai-integration.js')

// 模拟wx对象
global.wx = {
  getStorageSync: (key) => {
    if (key === 'userInfo') {
      return { id: 'test-user-123', nickname: '测试用户' }
    }
    return null
  },
  setStorageSync: () => {},
  removeStorageSync: () => {}
}

// 模拟测试数据
const testPlanData = {
  title: '测试行程 - 防止重复保存',
  description: '这是一个测试行程，用于验证保存逻辑',
  destination: '测试城市',
  startDate: '2024-12-25',
  endDate: '2024-12-30',
  budget: 5000,
  totalDays: 5,
  travelersCount: 2,
  travelStyle: '休闲',
  interests: ['美食', '文化'],
  itinerary: [
    {
      day: 1,
      date: '2024-12-25',
      activities: ['到达测试城市', '入住酒店']
    }
  ],
  tags: ['测试', 'AI生成'],
  transportation: '飞机',
  accommodation: '酒店',
  specialRequirements: '无特殊要求'
}

async function testRealSaveIssue() {
  console.log('=== 开始真实环境测试 ===')
  
  try {
    const userId = 'test-user-123'
    
    console.log('1. 测试单次保存...')
    const result1 = await aiIntegration.savePlanOnly(userId, testPlanData)
    console.log('第一次保存结果:', result1.success ? '成功' : '失败')
    
    if (result1.success) {
      console.log('✅ 第一次保存成功，行程ID:', result1.data.id)
      
      // 等待1秒
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log('2. 测试重复保存（应该被阻止）...')
      const result2 = await aiIntegration.savePlanOnly(userId, testPlanData)
      console.log('第二次保存结果:', result2.success ? '成功' : '失败')
      
      if (result2.success) {
        console.log('⚠️  第二次也保存成功了 - 可能存在重复保存问题！')
        console.log('新行程ID:', result2.data.id)
        console.log('⚠️  这表明系统没有防止重复保存的机制！')
      } else {
        console.log('✅ 第二次保存失败（预期行为）:', result2.error)
      }
      
      // 测试第三次保存
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('3. 测试第三次保存...')
      const result3 = await aiIntegration.savePlanOnly(userId, testPlanData)
      console.log('第三次保存结果:', result3.success ? '成功' : '失败')
      
      if (result3.success) {
        console.log('🚨 第三次也保存成功了 - 确认存在重复保存问题！')
        console.log('第三个行程ID:', result3.data.id)
      }
    } else {
      console.log('❌ 第一次保存失败:', result1.error)
    }
    
    console.log('\n=== 测试 planIntelligentItinerary 方法 ===')
    
    // 测试AI规划但不自动保存
    const userInput = '帮我规划一个5天的测试城市旅游行程'
    const formData = {
      destination: '测试城市',
      days: 5,
      travelers: 2,
      budget: 5000,
      style: '休闲'
    }
    
    console.log('4. 测试AI规划（不自动保存）...')
    const result4 = await aiIntegration.planIntelligentItinerary(
      userId, 
      userInput, 
      formData, 
      false  // 不自动保存
    )
    
    console.log('AI规划结果:', result4.success ? '成功' : '失败')
    if (result4.success && result4.planData) {
      console.log('✅ AI规划成功，准备手动保存...')
      console.log('生成的行程标题:', result4.planData.title)
      
      // 手动保存
      const result5 = await aiIntegration.savePlanOnly(userId, result4.planData)
      console.log('手动保存结果:', result5.success ? '成功' : '失败')
      if (result5.success) {
        console.log('手动保存的行程ID:', result5.data.id)
      }
    }
    
  } catch (error) {
    console.error('测试过程中出现错误:', error)
  }
  
  console.log('\n=== 测试完成 ===')
  console.log('结论：如果上面显示多次保存成功，说明系统确实存在重复保存问题')
}

// 运行测试
testRealSaveIssue()