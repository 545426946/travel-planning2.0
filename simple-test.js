// 简单的计划详情页面测试
console.log('=== 计划详情页面测试 ===');

// 模拟微信小程序环境
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
    return null;
  }
};

global.setTimeout = setTimeout;
global.console = console;

// 模拟Page函数
global.Page = function(config) {
  console.log('Page配置:', Object.keys(config));
  
  // 测试onLoad方法
  if (config.onLoad) {
    console.log('\n=== 测试onLoad方法 ===');
    try {
      config.onLoad({ id: 'test-plan-id' });
      console.log('✅ onLoad方法执行成功');
    } catch (error) {
      console.log('❌ onLoad方法执行失败:', error.message);
    }
  }
  
  // 测试loadPlanDetail方法
  if (config.loadPlanDetail) {
    console.log('\n=== 测试loadPlanDetail方法 ===');
    try {
      // 设置模拟数据
      if (config.data) {
        config.data.planId = 'test-plan-id';
      }
      config.loadPlanDetail();
      console.log('✅ loadPlanDetail方法执行成功');
    } catch (error) {
      console.log('❌ loadPlanDetail方法执行失败:', error.message);
    }
  }
  
  return config;
};

// 模拟Auth模块
global.Auth = {
  getCurrentUserId: function() {
    console.log('Auth.getCurrentUserId 被调用');
    return 'test-user-id';
  }
};

// 模拟supabase
global.supabase = {
  from: function(table) {
    console.log('supabase.from:', table);
    return {
      select: function(columns) {
        console.log('select:', columns);
        return {
          eq: function(field, value) {
            console.log('eq:', field, value);
            return {
              single: function() {
                console.log('single query');
                return Promise.resolve({
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
                    created_at: '2023-12-01'
                  },
                  error: null
                });
              }
            };
          }
        };
      },
      update: function(data) {
        console.log('update:', data);
        return {
          eq: function(field, value) {
            console.log('update eq:', field, value);
            return {
              single: function() {
                return Promise.resolve({ data: null, error: null });
              }
            };
          }
        };
      },
      delete: function() {
        console.log('delete operation');
        return {
          eq: function(field, value) {
            console.log('delete eq:', field, value);
            return Promise.resolve({ error: null });
          }
        };
      }
    };
  }
};

// 加载计划详情页面
try {
  console.log('\n=== 加载计划详情页面 ===');
  require('./pages/plan-detail/plan-detail.js');
  console.log('✅ 计划详情页面加载成功');
} catch (error) {
  console.log('❌ 计划详情页面加载失败:', error.message);
  console.log('错误堆栈:', error.stack);
}