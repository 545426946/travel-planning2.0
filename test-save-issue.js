// 测试行程保存重复问题
const { aiIntegration } = require('./utils/ai-integration.js')
const Auth = require('./utils/auth.js')

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

async function testSaveIssue() {
  console.log('=== 开始测试行程保存问题 ===')
  
  try {
    // 模拟用户登录
    const mockUserId = 'test-user-123'
    
    console.log('1. 测试单次保存...')
    const result1 = await aiIntegration.savePlanOnly(mockUserId, testPlanData)
    console.log('第一次保存结果:', result1)
    
    if (result1.success) {
      console.log('✅ 第一次保存成功，行程ID:', result1.data.id)
      
      // 等待1秒
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log('2. 测试重复保存（应该被阻止）...')
      const result2 = await aiIntegration.savePlanOnly(mockUserId, testPlanData)
      console.log('第二次保存结果:', result2)
      
      if (result2.success) {
        console.log('⚠️  第二次也保存成功了 - 可能存在重复保存问题！')
        console.log('新行程ID:', result2.data.id)
      } else {
        console.log('✅ 第二次保存失败（预期行为）:', result2.error)
      }
    } else {
      console.log('❌ 第一次保存失败:', result1.error)
    }
    
    console.log('3. 测试 planIntelligentItinerary 方法...')
    const userInput = '帮我规划一个5天的测试城市旅游行程'
    const formData = {
      destination: '测试城市',
      days: 5,
      travelers: 2,
      budget: 5000,
      style: '休闲'
    }
    
    // 测试不保存模式
    const result3 = await aiIntegration.planIntelligentItinerary(
      mockUserId, 
      userInput, 
      formData, 
      false  // 不自动保存
    )
    
    console.log('AI规划结果（不保存）:', result3.success)
    if (result3.success && result3.planData) {
      console.log('✅ AI规划成功，准备手动保存...')
      
      // 手动保存
      const result4 = await aiIntegration.savePlanOnly(mockUserId, result3.planData)
      console.log('手动保存结果:', result4.success)
      if (result4.success) {
        console.log('手动保存的行程ID:', result4.data.id)
      }
    }
    
  } catch (error) {
    console.error('测试过程中出现错误:', error)
  }
  
  console.log('=== 测试完成 ===')
}

// 运行测试
testSaveIssue()