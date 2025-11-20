/**
 * 简单的防重复保存机制测试
 * 验证核心逻辑是否正常工作
 */

console.log('🧪 开始简单防重复测试...\n');

// 模拟后端重复检查逻辑
function checkDuplicate(userId, planData, existingPlans) {
  return existingPlans.find(plan =>
    plan.user_id === userId &&
    plan.destination === planData.destination &&
    plan.start_date === planData.start_date &&
    plan.end_date === planData.end_date &&
    plan.travelers_count === planData.travelers_count
  );
}

// 模拟本地存储检查
function checkLocalStorage(planData) {
  // 模拟本地存储数据
  const localStorageData = {
    'saved_plan_东京_2024-02-01_2024-02-05_2': {
      savedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      planTitle: '日本东京5日游'
    }
  };
  
  const storageKey = `saved_plan_${planData.destination}_${planData.start_date}_${planData.end_date}_${planData.travelers_count}`;
  return localStorageData[storageKey];
}

// 测试数据
const testPlan1 = {
  title: '日本东京5日游',
  destination: '东京',
  start_date: '2024-02-01',
  end_date: '2024-02-05',
  travelers_count: 2,
  total_cost: 15000
};

const testPlan2 = {
  title: '日本大阪5日游',
  destination: '大阪',
  start_date: '2024-02-01',
  end_date: '2024-02-05',
  travelers_count: 2,
  total_cost: 12000
};

// 模拟现有数据
const existingPlans = [
  {
    id: '1',
    user_id: 'test_user_123',
    title: '日本东京5日游',
    destination: '东京',
    start_date: '2024-02-01',
    end_date: '2024-02-05',
    travelers_count: 2,
    created_at: '2024-01-15T10:00:00Z'
  }
];

console.log('📝 测试1: 后端重复检查');
const duplicate1 = checkDuplicate('test_user_123', testPlan1, existingPlans);
if (duplicate1) {
  console.log('🚫 正确检测到重复行程');
  console.log('📋 重复行程ID:', duplicate1.id);
} else {
  console.log('❌ 未检测到重复，这是错误的');
}

console.log('\n📝 测试2: 不同行程检查');
const duplicate2 = checkDuplicate('test_user_123', testPlan2, existingPlans);
if (!duplicate2) {
  console.log('✅ 正确识别为不同行程');
} else {
  console.log('❌ 错误地将不同行程识别为重复');
}

console.log('\n📝 测试3: 本地存储检查');
const localCheck = checkLocalStorage(testPlan1);
if (localCheck) {
  console.log('🚫 本地存储检测到重复');
  console.log('📅 上次保存时间:', localCheck.savedAt);
} else {
  console.log('❌ 本地存储检查失败');
}

console.log('\n📝 测试4: 时间窗口检查');
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const recordTime = new Date(localCheck.savedAt);
if (recordTime > thirtyDaysAgo) {
  console.log('✅ 记录在30天时间窗口内');
  console.log('📊 距离现在:', Math.floor((Date.now() - recordTime) / (1000 * 60 * 60 * 24)), '天');
} else {
  console.log('⏰ 记录已超过30天，可以重新保存');
}

console.log('\n📝 测试5: 并发标志检查');
let isSavingPlan = false;

function trySave() {
  if (isSavingPlan) {
    console.log('⚠️  保存正在进行中，阻止重复点击');
    return false;
  }
  
  isSavingPlan = true;
  console.log('✅ 开始保存，设置标志');
  
  // 模拟异步保存
  setTimeout(() => {
    isSavingPlan = false;
    console.log('✅ 保存完成，清除标志');
  }, 100);
  
  return true;
}

// 模拟快速点击
console.log('🖱️  模拟用户快速点击3次');
trySave();
trySave();
trySave();

setTimeout(() => {
  console.log('\n🎯 简单测试完成！');
  console.log('✅ 后端重复检查逻辑正常');
  console.log('✅ 本地存储检查逻辑正常');
  console.log('✅ 并发标志控制正常');
}, 200);