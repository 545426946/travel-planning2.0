// 模拟用户已登录的测试
console.log('=== 模拟用户已登录的测试 ===');

// 首先设置所有必需的全局变量和函数

// 1. 模拟微信小程序的全局对象和API
global.wx = {
  showToast: function(options) {
    console.log('wx.showToast:', options);
  },
  showLoading: function(options) {
    console.log('wx.showLoading:', options);
  },
  hideLoading: function() {
    console.log('wx.hideLoading');
  },
  navigateBack: function() {
    console.log('wx.navigateBack');
  },
  navigateTo: function(options) {
    console.log('wx.navigateTo:', options);
  },
  showModal: function(options) {
    console.log('wx.showModal:', options);
    if (options.success) {
      options.success({ confirm: true });
    }
  },
  showActionSheet: function(options) {
    console.log('wx.showActionSheet:', options);
    if (options.success) {
      options.success({ tapIndex: 0 });
    }
  },
  showShareMenu: function(options) {
    console.log('wx.showShareMenu:', options);
  },
  setClipboardData: function(options) {
    console.log('wx.setClipboardData:', options);
    if (options.success) {
      options.success();
    }
  },
  setStorageSync: function(key, value) {
    console.log('wx.setStorageSync:', key, value);
  },
  getStorageSync: function(key) {
    console.log('wx.getStorageSync:', key);
    // 模拟用户已登录
    if (key === 'userInfo') {
      return { id: 'test-user-id', username: '测试用户' };
    }
    return null;
  },
  request: function(options) {
    console.log('wx.request:', options);
    // 模拟成功的响应
    setTimeout(function() {
      if (options.success) {
        options.success({
          data: {
            id: 'test-plan-id',
            title: '测试行程',
            destination: '北京',
            start_date: '2024-01-01',
            end_date: '2024-01-03',
            total_days: 3,
            travelers_count: 2,
            total_budget: 5000,
            travel_style: 'comfortable',
            status: 'planned',
            is_ai_generated: false,
            tags: null,
            transportation: '飞机',
            accommodation: '酒店',
            special_requirements: '',
            itinerary: '第一天：天安门广场\n第二天：故宫\n第三天：长城',
            interests: null,
            created_at: '2023-12-01',
            user_id: 'test-user-id'
          }
        });
      }
    }, 100);
  }
};

// 2. 模拟Page函数
global.Page = function(config) {
  console.log('\n=== Page函数被调用 ===');
  console.log('配置的方法:', Object.keys(config));
  
  // 创建页面实例
  const pageInstance = {
    data: config.data || {},
    setData: function(newData) {
      console.log('setData被调用:', newData);
      // 合并数据
      Object.assign(this.data, newData);
      console.log('当前数据:', this.data);
    }
  };
  
  // 绑定所有方法到页面实例
  Object.keys(config).forEach(function(key) {
    if (typeof config[key] === 'function') {
      pageInstance[key] = config[key].bind(pageInstance);
    } else {
      pageInstance[key] = config[key];
    }
  });
  
  console.log('\n=== 测试页面生命周期 ===');
  
  // 测试onLoad方法
  if (pageInstance.onLoad) {
    console.log('\n--- 测试onLoad方法 ---');
    try {
      pageInstance.onLoad({ id: 'test-plan-id' });
      console.log('✅ onLoad执行成功');
      console.log('最终数据状态:', pageInstance.data);
      
      // 检查关键数据是否加载成功
      if (pageInstance.data.plan) {
        console.log('✅ 行程数据加载成功:', {
          title: pageInstance.data.plan.title,
          destination: pageInstance.data.plan.destination,
          totalDays: pageInstance.data.plan.totalDays
        });
      } else {
        console.log('❌ 行程数据未加载');
      }
      
      if (pageInstance.data.dailyItinerary && pageInstance.data.dailyItinerary.length > 0) {
        console.log('✅ 每日行程数据加载成功:', pageInstance.data.dailyItinerary.length + '天');
      } else {
        console.log('❌ 每日行程数据未加载');
      }
      
    } catch (error) {
      console.log('❌ onLoad执行失败:', error.message);
      console.log('错误堆栈:', error.stack);
    }
  }
  
  return pageInstance;
};

// 3. 模拟getApp函数
global.getApp = function() {
  return {
    globalData: {
      userInfo: { id: 'test-user-id', username: '测试用户' },
      isLoggedIn: true
    }
  };
};

// 4. 模拟setTimeout
global.setTimeout = setTimeout;

// 5. 加载依赖模块
const authModule = require('./utils/auth.js');
const supabaseModule = require('./utils/supabase.js');

console.log('Auth模块加载成功');
console.log('Supabase模块加载成功');

// 6. 设置全局变量，让计划详情页面能够访问
global.Auth = authModule.Auth;
global.supabase = supabaseModule.supabase;

console.log('\n=== 开始加载计划详情页面 ===');

// 7. 现在加载计划详情页面
try {
  require('./pages/plan-detail/plan-detail.js');
  console.log('\n✅ 计划详情页面加载成功');
} catch (error) {
  console.log('\n❌ 计划详情页面加载失败:', error.message);
  console.log('错误堆栈:', error.stack);
}