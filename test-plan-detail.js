// 测试 plan-detail.js 的代码
const fs = require('fs');
const path = require('path');

// 读取文件内容
const filePath = path.join(__dirname, 'pages/plan-detail/plan-detail.js');
const fileContent = fs.readFileSync(filePath, 'utf8');

// 模拟微信小程序环境
const mockWx = {
  request: function(options) {
    console.log('模拟请求:', options.url);
    // 模拟成功响应
    if (options.success) {
      options.success({
        data: {
          id: 1,
          title: '测试行程',
          description: '这是一个测试行程',
          destination: '北京',
          start_date: '2024-01-01',
          end_date: '2024-01-03',
          total_days: 3,
          travelers_count: 2,
          total_budget: 5000,
          travel_style: 'comfortable',
          status: 'planned',
          is_ai_generated: true,
          tags: '文化,美食',
          transportation: '高铁',
          accommodation: '酒店',
          special_requirements: '无特殊要求',
          itinerary: 'Day 1: 抵达北京\n上午：参观天安门\n下午：游览故宫\n晚上：品尝北京烤鸭\n\nDay 2: 北京深度游\n上午：爬长城\n下午：参观颐和园\n晚上：王府井购物\n\nDay 3: 离开北京\n上午：天坛公园\n下午：返程',
          interests: '历史文化,美食',
          created_at: '2024-01-01T00:00:00Z'
        }
      });
    }
  },
  showToast: function(options) {
    console.log('显示提示:', options.title);
  },
  showLoading: function(options) {
    console.log('显示加载:', options.title);
  },
  hideLoading: function() {
    console.log('隐藏加载');
  }
};

// 模拟 Page 函数
global.Page = function(config) {
  console.log('创建页面配置');
  
  // 模拟页面数据
  const pageData = {
    data: {
      planId: 1,
      plan: null,
      loading: true,
      error: ''
    },
    setData: function(newData) {
      Object.assign(this.data, newData);
      console.log('数据更新:', newData);
    }
  };
  
  // 合并配置
  Object.assign(pageData, config);
  
  // 测试 processPlanData 方法
  if (pageData.processPlanData) {
    const testData = {
      id: 1,
      title: '测试行程',
      description: '这是一个测试行程',
      destination: '北京',
      start_date: '2024-01-01',
      end_date: '2024-01-03',
      total_days: 3,
      travelers_count: 2,
      total_budget: 5000,
      travel_style: 'comfortable',
      status: 'planned',
      is_ai_generated: true,
      tags: '文化,美食',
      transportation: '高铁',
      accommodation: '酒店',
      special_requirements: '无特殊要求',
      itinerary: 'Day 1: 抵达北京\n上午：参观天安门\n下午：游览故宫\n晚上：品尝北京烤鸭\n\nDay 2: 北京深度游\n上午：爬长城\n下午：参观颐和园\n晚上：王府井购物\n\nDay 3: 离开北京\n上午：天坛公园\n下午：返程',
      interests: '历史文化,美食',
      created_at: '2024-01-01T00:00:00Z'
    };
    
    console.log('测试 processPlanData...');
    const result = pageData.processPlanData(testData);
    console.log('processPlanData 结果:', JSON.stringify(result, null, 2));
  }
  
  // 测试 parseItinerary 方法
  if (pageData.parseItinerary) {
    const testItinerary = 'Day 1: 抵达北京\n上午：参观天安门\n下午：游览故宫\n晚上：品尝北京烤鸭\n\nDay 2: 北京深度游\n上午：爬长城\n下午：参观颐和园\n晚上：王府井购物';
    
    console.log('测试 parseItinerary...');
    const result = pageData.parseItinerary(testItinerary, 2);
    console.log('parseItinerary 结果:', JSON.stringify(result, null, 2));
  }
  
  console.log('测试完成');
};

// 模拟 getApp 函数
global.getApp = function() {
  return {
    globalData: {
      apiUrl: 'https://api.example.com'
    }
  };
};

// 模拟 wx 对象
global.wx = mockWx;

// 执行文件内容
try {
  eval(fileContent);
  console.log('文件执行成功，没有语法错误');
} catch (error) {
  console.error('文件执行失败:', error.message);
  console.error('错误堆栈:', error.stack);
}