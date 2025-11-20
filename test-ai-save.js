// 测试AI生成行程保存逻辑
const { aiIntegration } = require('./utils/ai-integration')

async function testAISaveLogic() {
  console.log('=== 开始测试AI生成行程保存逻辑 ===\n')
  
  // 模拟用户数据
  const mockUserId = 'test-user-123'
  const mockUserInput = '我想去杭州旅游3天，预算2000元，2个人，喜欢自然风光和美食'
  
  console.log('测试场景1: planIntelligentItinerary默认保存（saveToDatabase=true）')
  try {
    const result1 = await aiIntegration.planIntelligentItinerary(
      mockUserId,
      mockUserInput,
      {},
      true // 明确设置为true
    )
    
    if (result1.success) {
      console.log('✅ 场景1成功 - 生成并保存了行程')
      console.log('   - 行程ID:', result1.data?.id)
      console.log('   - 标题:', result1.planData?.title)
      console.log('   - 是否AI生成:', result1.data?.is_ai_generated)
    } else {
      console.log('❌ 场景1失败:', result1.error)
    }
  } catch (error) {
    console.log('❌ 场景1异常:', error.message)
  }
  
  console.log('\n测试场景2: planIntelligentItinerary不保存（saveToDatabase=false）')
  try {
    const result2 = await aiIntegration.planIntelligentItinerary(
      mockUserId,
      mockUserInput + '（测试2）',
      {},
      false // 设置为不保存
    )
    
    if (result2.success) {
      console.log('✅ 场景2成功 - 只生成不保存')
      console.log('   - 有planData数据:', !!result2.planData)
      console.log('   - 有data数据:', !!result2.data)
      console.log('   - 标题:', result2.planData?.title)
    } else {
      console.log('❌ 场景2失败:', result2.error)
    }
  } catch (error) {
    console.log('❌ 场景2异常:', error.message)
  }
  
  console.log('\n测试场景3: savePlanOnly直接保存')
  try {
    // 先生成但不保存
    const result3 = await aiIntegration.planIntelligentItinerary(
      mockUserId,
      mockUserInput + '（测试3）',
      {},
      false
    )
    
    if (result3.success && result3.planData) {
      console.log('✅ 先生成成功，现在保存...')
      
      const saveResult = await aiIntegration.savePlanOnly(
        mockUserId,
        result3.planData
      )
      
      if (saveResult.success) {
        console.log('✅ savePlanOnly保存成功')
        console.log('   - 行程ID:', saveResult.data?.id)
        console.log('   - 是否AI生成:', saveResult.data?.is_ai_generated)
      } else {
        console.log('❌ savePlanOnly保存失败:', saveResult.error)
      }
    } else {
      console.log('❌ 先生成失败:', result3.error)
    }
  } catch (error) {
    console.log('❌ 场景3异常:', error.message)
  }
  
  console.log('\n=== 测试完成 ===')
  
  // 分析可能的问题
  console.log('\n=== 问题分析 ===')
  console.log('1. planIntelligentItinerary默认saveToDatabase=true，会保存一次')
  console.log('2. 如果用户点击保存，savePlanOnly会再保存一次')
  console.log('3. 如果代码中有重复调用，可能会保存多次')
  console.log('4. 需要检查是否有循环调用或重复触发保存的情况')
}

// 运行测试
testAISaveLogic().catch(console.error)