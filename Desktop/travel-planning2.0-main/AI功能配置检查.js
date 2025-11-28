// AI功能配置检查脚本
// 在微信开发者工具控制台运行此脚本来检查配置

console.log('🤖 AI Travel 微信小程序 - 功能配置检查')
console.log('='.repeat(50))

// 检查必要的模块
try {
  const AI_CONFIG = require('./utils/config').AI_CONFIG
  console.log('✅ AI_CONFIG 配置加载成功')
  console.log('   当前AI提供商:', AI_CONFIG.providers.map(p => p.name).join(', '))
  console.log('   主要API地址:', AI_CONFIG.apiUrl)
  console.log('   当前模型:', AI_CONFIG.model)
} catch (error) {
  console.log('❌ AI_CONFIG 配置加载失败:', error.message)
}

try {
  const SUPABASE_CONFIG = require('./utils/config').SUPABASE_CONFIG
  console.log('✅ SUPABASE_CONFIG 配置加载成功')
  console.log('   Supabase URL:', SUPABASE_CONFIG.url)
  console.log('   匿名密钥:', SUPABASE_CONFIG.anonKey.substring(0, 20) + '...')
} catch (error) {
  console.log('❌ SUPABASE_CONFIG 配置加载失败:', error.message)
}

// 检查域名配置
console.log('\n📋 需要配置的微信小程序域名白名单:')
console.log('1. https://hmnjuntvubqvbpeyqoxw.supabase.co (Supabase数据库)')
console.log('2. https://api.mistral.ai (Mistral AI)')
console.log('3. https://api.openai.com (OpenAI, 可选)')

// 检查AI服务
try {
  const aiService = require('./utils/ai-service').aiService
  console.log('✅ AI服务模块加载成功')
  console.log('   支持的提供商数量:', aiService.providers.length)
} catch (error) {
  console.log('❌ AI服务模块加载失败:', error.message)
}

// 检查数据库模块
try {
  const db = require('./utils/database').db
  console.log('✅ 数据库模块加载成功')
} catch (error) {
  console.log('❌ 数据库模块加载失败:', error.message)
}

console.log('\n🔧 配置步骤:')
console.log('1. 登录微信公众平台: https://mp.weixin.qq.com')
console.log('2. 进入开发 → 开发管理 → 开发设置')
console.log('3. 在request合法域名中添加上述域名')
console.log('4. 重启微信开发者工具')
console.log('5. 重新编译项目')

console.log('\n🎯 配置完成后可用的功能:')
console.log('- ✅ 用户登录/注册')
console.log('- ✅ AI智能行程规划')
console.log('- ✅ 行程数据保存和管理')
console.log('- ✅ 个人偏好设置')

console.log('\n💡 提示: 如果仍遇到域名错误，请检查:')
console.log('- 域名是否拼写正确')
console.log('- 是否包含https://前缀')
console.log('- 微信开发者工具是否已重启')
console.log('- 项目是否已重新编译')