// 测试错误显示功能
console.log('=== 测试错误显示功能 ===');

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
    // 模拟请求失败
    setTimeout(function() {
      console.log('🧪 模拟数据库查询错误...');
      if (options.fail) {
        try {
          options.fail({ errMsg: 'request:fail' });
        } catch (error) {
          console.log('✅ 错误被正确捕获和处理:', error.message);
          // 检查页面数据是否正确设置
          if (global.currentPage) {
            var pageData = global.currentPage.data;
            console.log('📊 页面错误状态:', {
              showError: pageData.showError,
              errorMessage: pageData.errorMessage,
              errorDetail: pageData.errorDetail,
              loading: pageData.loading
            });
            if (pageData.showError && pageData.errorMessage === '加载失败') {
              console.log('✅ 错误显示功能测试通过！');
            } else {
              console.log('❌ 错误显示功能测试失败');
            }
          }
        }
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
      
      // 检查错误状态
      if (this.data.showError) {
        console.log('✅ 错误状态已设置:', {
          showError: this.data.showError,
          errorMessage: this.data.errorMessage,
          errorDetail: this.data.errorDetail
        });
      }
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
  
  console.log('\n=== 测试错误处理 ===');
  
  // 测试showError方法
  if (pageInstance.showError) {
    console.log('\n--- 测试showError方法 ---');
    try {
      pageInstance.showError('测试错误标题', '测试错误详情');
      console.log('✅ showError执行成功');
    } catch (error) {
      console.log('❌ showError执行失败:', error.message);
    }
  }
  
  // 测试hideError方法
  if (pageInstance.hideError) {
    console.log('\n--- 测试hideError方法 ---');
    try {
      pageInstance.hideError();
      console.log('✅ hideError执行成功');
    } catch (error) {
      console.log('❌ hideError执行失败:', error.message);
    }
  }
  
  // 测试onLoad方法（模拟加载失败）
  if (pageInstance.onLoad) {
    console.log('\n--- 测试onLoad方法（模拟加载失败）---');
    try {
      pageInstance.onLoad({ id: 'test-plan-id' });
      console.log('✅ onLoad执行完成');
    } catch (error) {
      console.log('❌ onLoad执行失败:', error.message);
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