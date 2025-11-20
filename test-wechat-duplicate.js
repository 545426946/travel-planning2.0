/**
 * 微信小程序环境下的防重复保存测试
 * 模拟真实的微信小程序环境
 */

// 模拟微信小程序环境
const mockWx = {
  request: function(options) {
    // 模拟网络请求
    setTimeout(() => {
      // 模拟不同的响应结果
      const random = Math.random();
      
      if (options.url.includes('/travel_plans')) {
        if (random > 0.7) {
          // 模拟重复保存
          options.fail && options.fail({
            errMsg: 'request:fail 已存在相同的行程计划'
          });
        } else {
          // 模拟成功保存
          options.success && options.success({
            data: {
              id: Date.now().toString(),
              created_at: new Date().toISOString()
            },
            statusCode: 200
          });
        }
      }
    }, 100);
  },
  
  getStorageSync: function(key) {
    // 模拟本地存储读取
    const storage = {
      'user_info': JSON.stringify({ id: 'test_user_123' }),
      'saved_plan_东京_2024-02-01_2024-02-05_2': JSON.stringify({
        savedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1天前
        planTitle: '日本东京5日游'
      })
    };
    return storage[key] || null;
  },
  
  setStorageSync: function(key, data) {
    console.log(`💾 本地存储: ${key} =`, data);
  },
  
  showToast: function(options) {
    console.log(`🍞 Toast: ${options.title} (${options.icon})`);
  },
  
  showModal: function(options) {
    console.log(`💬 确认对话框: ${options.title}`);
    console.log(`📝 内容: ${options.content}`);
    // 模拟用户点击确认
    setTimeout(() => {
      options.success && options.success({ confirm: true });
    }, 50);
  }
};

// 全局变量
global.wx = mockWx;

// 模拟页面状态
let pageState = {
  isSavingPlan: false,
  userInfo: null
};

// 模拟保存函数（基于实际代码）
async function saveAIGeneratedPlan(planData) {
  console.log('\n🚀 开始保存行程计划...');
  console.log('📋 计划数据:', JSON.stringify(planData, null, 2));
  
  // 检查是否正在保存中
  if (pageState.isSavingPlan) {
    console.log('⚠️  当前正在保存中，请稍候...');
    return;
  }
  
  // 获取用户信息
  const userInfoStr = mockWx.getStorageSync('user_info');
  const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
  if (!userInfo.id) {
    console.log('❌ 用户未登录');
    return;
  }
  
  // 本地存储检查
  const storageKey = `saved_plan_${planData.destination}_${planData.start_date}_${planData.end_date}_${planData.travelers_count}`;
  const savedRecord = mockWx.getStorageSync(storageKey);
  
  if (savedRecord) {
    const record = JSON.parse(savedRecord);
    const savedTime = new Date(record.savedAt);
    const now = new Date();
    const daysDiff = (now - savedTime) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 30) {
      console.log(`🚫 本地检查：该行程在30天内已保存过`);
      console.log(`📅 上次保存时间: ${record.savedAt}`);
      
      // 显示确认对话框
      mockWx.showModal({
        title: '重复保存提醒',
        content: `您已在 ${daysDiff.toFixed(1)} 天前保存过类似的行程，是否继续保存？`,
        success: function(res) {
          if (res.confirm) {
            console.log('✅ 用户选择继续保存');
            doSavePlan(planData, userInfo.id);
          } else {
            console.log('❌ 用户取消保存');
          }
        }
      });
      return;
    }
  }
  
  // 执行保存
  await doSavePlan(planData, userInfo.id);
}

async function doSavePlan(planData, userId) {
  pageState.isSavingPlan = true;
  
  try {
    console.log('💾 正在保存到数据库...');
    
    return new Promise((resolve, reject) => {
      mockWx.request({
        url: 'https://api.supabase.com/rest/v1/travel_plans',
        method: 'POST',
        data: {
          user_id: userId,
          title: planData.title,
          destination: planData.destination,
          start_date: planData.start_date,
          end_date: planData.end_date,
          travelers_count: planData.travelers_count,
          total_cost: planData.total_cost,
          plan_data: planData
        },
        success: function(res) {
          console.log('✅ 保存成功！');
          mockWx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          
          // 记录到本地存储
          const storageKey = `saved_plan_${planData.destination}_${planData.start_date}_${planData.end_date}_${planData.travelers_count}`;
          mockWx.setStorageSync(storageKey, JSON.stringify({
            savedAt: new Date().toISOString(),
            planTitle: planData.title
          }));
          
          resolve(res);
        },
        fail: function(error) {
          console.log('❌ 保存失败:', error.errMsg);
          mockWx.showToast({
            title: '保存失败，请重试',
            icon: 'error'
          });
          reject(error);
        },
        complete: function() {
          // 延迟重置标志，确保并发请求能被正确处理
          setTimeout(() => {
            pageState.isSavingPlan = false;
          }, 100);
        }
      });
    });
    
  } catch (error) {
    console.log('❌ 保存过程出错:', error);
    pageState.isSavingPlan = false;
    throw error;
  }
}

// 测试场景
async function runWeChatTests() {
  console.log('🧪 开始微信小程序环境测试...\n');
  
  const testPlan = {
    title: '日本东京5日游',
    destination: '东京',
    start_date: '2024-02-01',
    end_date: '2024-02-05',
    travelers_count: 2,
    total_cost: 15000,
    itinerary: ['Day 1: 抵达成田机场', 'Day 2: 浅草寺观光']
  };
  
  // 测试1: 第一次保存（应该成功）
  console.log('📝 测试1: 第一次保存');
  await saveAIGeneratedPlan(testPlan);
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // 测试2: 重复保存（应该被本地存储阻止）
  console.log('\n📝 测试2: 重复保存（本地存储检查）');
  await saveAIGeneratedPlan(testPlan);
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // 测试3: 不同行程（应该成功）
  console.log('\n📝 测试3: 不同行程');
  const differentPlan = {
    ...testPlan,
    destination: '大阪',
    title: '日本大阪5日游'
  };
  await saveAIGeneratedPlan(differentPlan);
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // 测试4: 并发保存
  console.log('\n📝 测试4: 并发保存测试');
  const concurrentPlan = {
    title: '京都赏樱3日游',
    destination: '京都',
    start_date: '2024-03-15',
    end_date: '2024-03-17',
    travelers_count: 1,
    total_cost: 8000
  };
  
  // 模拟快速点击
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(saveAIGeneratedPlan(concurrentPlan));
  }
  
  await Promise.allSettled(promises);
  
  console.log('\n🎯 微信小程序环境测试完成！');
}

// 运行测试
runWeChatTests().catch(console.error);