// 测试修复后的防重复保存机制
const { aiIntegration } = require('./utils/ai-integration')

// 模拟微信小程序环境
global.wx = {
  getStorageSync: (key) => {
    if (key === 'saved_ai_plans') {
      return [
        {
          key: '北京_2024-02-01_2024-02-03_2',
          timestamp: Date.now() - 24 * 60 * 60 * 1000, // 1天前
          planId: 'test-plan-123',
          title: '北京三日游'
        }
      ]
    }
    return []
  },
  setStorageSync: (key, data) => {
    console.log(`✅ 本地存储已更新: ${key}`, data)
  }
}

// 模拟用户信息
const mockUserInfo = {
  id: 'test-user-123',
  nickname: '测试用户'
}

// 模拟行程数据
const mockPlanData = {
  title: '北京三日游 - 测试防重复',
  description: '探索北京的历史文化',
  destination: '北京',
  startDate: '2024-02-01',
  endDate: '2024-02-03',
  budget: 3000,
  totalDays: 3,
  travelersCount: 2,
  travelStyle: 'comfortable',
  itinerary: 'Day 1: 故宫\nDay 2: 长城\nDay 3: 天坛',
  is_ai_generated: true
}

async function testDuplicatePrevention() {
  console.log('🧪 开始测试防重复保存机制...\n')
  
  try {
    // 测试1：第一次保存（应该成功）
    console.log('📋 测试1: 第一次保存行程')
    const result1 = await aiIntegration.savePlanOnly(mockUserInfo.id, {
      ...mockPlanData,
      title: '北京三日游 - 第一次保存',
      startDate: '2024-02-10', // 不同日期
      endDate: '2024-02-12'
    })
    
    if (result1.success) {
      console.log('✅ 第一次保存成功:', result1.data.id)
    } else {
      console.log('❌ 第一次保存失败:', result1.error)
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // 测试2：重复保存相同行程（应该被阻止）
    console.log('📋 测试2: 重复保存相同行程（应该被阻止）')
    const result2 = await aiIntegration.savePlanOnly(mockUserInfo.id, {
      ...mockPlanData,
      title: '北京三日游 - 重复保存'
    })
    
    if (result2.success) {
      console.log('❌ 防重复机制失效！重复保存成功:', result2.data.id)
      console.log('⚠️  这表明防重复机制没有生效')
    } else if (result2.isDuplicate) {
      console.log('✅ 防重复机制生效！重复保存被阻止:', result2.error)
    } else {
      console.log('❓ 保存失败，但不是重复问题:', result2.error)
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // 测试3：保存不同行程（应该成功）
    console.log('📋 测试3: 保存不同行程（应该成功）')
    const result3 = await aiIntegration.savePlanOnly(mockUserInfo.id, {
      ...mockPlanData,
      title: '上海三日游 - 不同行程',
      destination: '上海',
      startDate: '2024-03-01',
      endDate: '2024-03-03'
    })
    
    if (result3.success) {
      console.log('✅ 不同行程保存成功:', result3.data.id)
    } else {
      console.log('❌ 不同行程保存失败:', result3.error)
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // 测试4：模拟网络延迟情况下的重复点击
    console.log('📋 测试4: 模拟网络延迟下的重复点击')
    console.log('⏱️  快速连续调用保存方法...')
    
    const promises = []
    for (let i = 0; i < 3; i++) {
      promises.push(
        aiIntegration.savePlanOnly(mockUserInfo.id, {
          ...mockPlanData,
          title: `杭州三日游 - 并发测试${i}`,
          destination: '杭州',
          startDate: `2024-04-0${i+1}`,
          endDate: `2024-04-0${i+3}`
        })
      )
    }
    
    const results = await Promise.allSettled(promises)
    const successCount = results.filter(r => r.value && r.value.success).length
    const duplicateCount = results.filter(r => r.value && r.value.isDuplicate).length
    
    console.log(`✅ 成功保存: ${successCount} 次`)
    console.log(`🚫 被阻止的重复: ${duplicateCount} 次`)
    console.log(`📊 总请求: ${results.length} 次`)
    
    if (successCount === 1) {
      console.log('✅ 并发防护机制正常工作！')
    } else {
      console.log('⚠️  并发情况下可能存在重复保存风险')
    }
    
  } catch (error) {
    console.error('测试过程中出现错误:', error)
  }
  
  console.log('\n🎯 测试完成！')
  console.log('总结：')
  console.log('- ✅ 第一次保存：应该成功')
  console.log('- ✅ 重复保存：应该被阻止')
  console.log('- ✅ 不同行程：应该成功')
  console.log('- ✅ 并发保存：应该只允许一个成功')
}

// 运行测试
testDuplicatePrevention().catch(console.error)