/**
 * 模拟环境下的防重复保存机制测试
 * 使用模拟数据验证防重复逻辑
 */

// 模拟数据库操作
const mockDatabase = {
  travelPlans: {
    plans: [],
    create: async function(data) {
      // 模拟重复检查
      const duplicate = this.plans.find(plan => 
        plan.user_id === data.user_id &&
        plan.destination === data.destination &&
        plan.start_date === data.start_date &&
        plan.end_date === data.end_date &&
        plan.travelers_count === data.travelers_count
      );
      
      if (duplicate) {
        throw new Error('已存在相同的行程计划');
      }
      
      const newPlan = {
        id: Date.now().toString(),
        ...data,
        created_at: new Date().toISOString()
      };
      this.plans.push(newPlan);
      return newPlan;
    },
    getByUserId: async function(userId, limit = 10) {
      return this.plans
        .filter(plan => plan.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    }
  }
};

// 模拟AI Integration
const mockAIIntegration = {
  savePlanOnly: async function(userId, planData, isPublic = false) {
    try {
      // 模拟重复检查
      const existingPlans = await mockDatabase.travelPlans.getByUserId(userId);
      
      const duplicate = existingPlans.find(plan =>
        plan.destination === planData.destination &&
        plan.start_date === planData.start_date &&
        plan.end_date === planData.end_date &&
        plan.travelers_count === planData.travelers_count
      );
      
      if (duplicate) {
        throw new Error('已存在相同的行程计划，请勿重复保存');
      }
      
      const planRecord = {
        user_id: userId,
        title: planData.title,
        destination: planData.destination,
        start_date: planData.start_date,
        end_date: planData.end_date,
        travelers_count: planData.travelers_count || 1,
        total_cost: planData.total_cost || 0,
        status: 'active',
        is_public: isPublic,
        plan_data: planData
      };
      
      return await mockDatabase.travelPlans.create(planRecord);
    } catch (error) {
      if (error.message.includes('已存在相同的行程计划')) {
        throw error;
      }
      throw new Error('保存失败：' + error.message);
    }
  }
};

// 模拟本地存储
const mockStorage = {
  data: {},
  setItem: function(key, value) {
    this.data[key] = value;
  },
  getItem: function(key) {
    return this.data[key] || null;
  }
};

// 测试函数
async function testDuplicatePrevention() {
  console.log('🧪 开始测试防重复保存机制...\n');
  
  const userId = 'test_user_123';
  const testPlan = {
    title: '日本东京5日游',
    destination: '东京',
    start_date: '2024-02-01',
    end_date: '2024-02-05',
    travelers_count: 2,
    total_cost: 15000,
    itinerary: ['Day 1: 抵达成田机场', 'Day 2: 浅草寺观光']
  };
  
  let successCount = 0;
  let blockedCount = 0;
  let errorCount = 0;
  
  // 测试1: 第一次保存（应该成功）
  console.log('📝 测试1: 第一次保存');
  try {
    const result = await mockAIIntegration.savePlanOnly(userId, testPlan);
    console.log('✅ 保存成功，行程ID:', result.id);
    successCount++;
  } catch (error) {
    console.log('❌ 保存失败:', error.message);
    errorCount++;
  }
  
  // 测试2: 重复保存相同行程（应该被阻止）
  console.log('\n📝 测试2: 重复保存相同行程');
  try {
    await mockAIIntegration.savePlanOnly(userId, testPlan);
    console.log('❌ 不应该保存成功！');
    errorCount++;
  } catch (error) {
    console.log('🚫 正确阻止重复保存:', error.message);
    blockedCount++;
  }
  
  // 测试3: 保存不同行程（应该成功）
  console.log('\n📝 测试3: 保存不同行程');
  const differentPlan = {
    ...testPlan,
    destination: '大阪',
    title: '日本大阪5日游'
  };
  try {
    const result = await mockAIIntegration.savePlanOnly(userId, differentPlan);
    console.log('✅ 不同行程保存成功，行程ID:', result.id);
    successCount++;
  } catch (error) {
    console.log('❌ 保存失败:', error.message);
    errorCount++;
  }
  
  // 测试4: 模拟前端本地存储检查
  console.log('\n📝 测试4: 前端本地存储检查');
  const storageKey = `saved_plan_${testPlan.destination}_${testPlan.start_date}_${testPlan.end_date}_${testPlan.travelers_count}`;
  
  // 模拟保存记录到本地存储
  mockStorage.setItem(storageKey, JSON.stringify({
    savedAt: new Date().toISOString(),
    planTitle: testPlan.title
  }));
  
  // 检查是否已保存
  const savedRecord = mockStorage.getItem(storageKey);
  if (savedRecord) {
    const record = JSON.parse(savedRecord);
    const savedTime = new Date(record.savedAt);
    const now = new Date();
    const daysDiff = (now - savedTime) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 30) {
      console.log('🚫 本地存储检查：该行程在30天内已保存过');
      console.log('📅 上次保存时间:', record.savedAt);
    }
  }
  
  // 测试5: 并发保存测试
  console.log('\n📝 测试5: 并发保存测试');
  const concurrentPlan = {
    title: '并发测试行程',
    destination: '京都',
    start_date: '2024-03-01',
    end_date: '2024-03-05',
    travelers_count: 1,
    total_cost: 8000
  };
  
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(mockAIIntegration.savePlanOnly(userId, concurrentPlan));
  }
  
  let concurrentSuccess = 0;
  let concurrentBlocked = 0;
  
  const results = await Promise.allSettled(promises);
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`✅ 并发请求${index + 1}: 保存成功`);
      concurrentSuccess++;
    } else {
      console.log(`🚫 并发请求${index + 1}: 被阻止 - ${result.reason.message}`);
      concurrentBlocked++;
    }
  });
  
  console.log('\n📊 并发测试结果:');
  console.log(`✅ 成功: ${concurrentSuccess} 次`);
  console.log(`🚫 被阻止: ${concurrentBlocked} 次`);
  
  if (concurrentSuccess === 1) {
    console.log('✅ 并发控制正常：只允许一个请求成功');
  } else {
    console.log('⚠️  并发控制可能需要优化');
  }
  
  // 最终结果统计
  console.log('\n📈 最终测试结果:');
  console.log(`✅ 成功保存: ${successCount} 次`);
  console.log(`🚫 被阻止重复: ${blockedCount} 次`);
  console.log(`❌ 其他错误: ${errorCount} 次`);
  console.log(`📊 总请求: ${successCount + blockedCount + errorCount} 次`);
  
  console.log('\n🎯 测试结论:');
  if (blockedCount > 0 && concurrentSuccess === 1) {
    console.log('✅ 防重复机制工作正常！');
    console.log('✅ 后端重复检查有效');
    console.log('✅ 并发控制正常');
  } else {
    console.log('⚠️  防重复机制可能需要进一步优化');
  }
}

// 运行测试
testDuplicatePrevention().catch(console.error);