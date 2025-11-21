// utils/api-test.js - API 连接测试工具

const supabase = require('./supabase').supabase
const AI_CONFIG = require('./config').AI_CONFIG

/**
 * 测试 Supabase 数据库连接
 */
async function testSupabaseConnection() {
  console.log('=== 测试 Supabase 连接 ===')
  
  try {
    // 测试简单的查询
    const result = await new Promise((resolve) => {
      supabase
        .from('users')
        .select('id')
        .limit(1)
        .then(resolve)
    })

    if (result.error) {
      console.error('❌ Supabase 连接失败:', result.error)
      return {
        success: false,
        service: 'Supabase',
        error: result.error
      }
    }

    console.log('✅ Supabase 连接成功!')
    return {
      success: true,
      service: 'Supabase',
      message: '数据库连接正常'
    }
  } catch (error) {
    console.error('❌ Supabase 连接异常:', error)
    return {
      success: false,
      service: 'Supabase',
      error: error
    }
  }
}

/**
 * 测试 AI API 连接
 */
async function testAIConnection() {
  console.log('=== 测试 AI API 连接 ===')
  
  const provider = AI_CONFIG.providers[0] // 测试第一个提供商
  console.log('测试提供商:', provider.name)

  try {
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: provider.apiUrl,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
          'Accept': 'application/json'
        },
        data: {
          model: provider.model,
          messages: [
            {
              role: 'user',
              content: '你好，这是一个测试消息。请简短回复。'
            }
          ],
          temperature: 0.7,
          max_tokens: 50
        },
        timeout: 15000,
        success: (res) => resolve(res),
        fail: (err) => reject(err)
      })
    })

    if (response.statusCode === 200) {
      console.log('✅ AI API 连接成功!')
      console.log('响应数据:', response.data)
      return {
        success: true,
        service: 'AI API',
        provider: provider.name,
        message: 'AI 服务连接正常'
      }
    } else {
      console.error('❌ AI API 返回错误状态码:', response.statusCode)
      console.error('错误详情:', response.data)
      return {
        success: false,
        service: 'AI API',
        provider: provider.name,
        error: response.data
      }
    }
  } catch (error) {
    console.error('❌ AI API 连接失败:', error)
    return {
      success: false,
      service: 'AI API',
      provider: provider.name,
      error: error
    }
  }
}

/**
 * 测试所有 API 连接
 */
async function testAllConnections() {
  console.log('开始测试所有 API 连接...')
  
  const results = []
  
  // 测试 Supabase
  const supabaseResult = await testSupabaseConnection()
  results.push(supabaseResult)
  
  // 测试 AI API
  const aiResult = await testAIConnection()
  results.push(aiResult)
  
  // 汇总结果
  console.log('\n=== API 连接测试结果 ===')
  results.forEach(result => {
    const status = result.success ? '✅' : '❌'
    console.log(`${status} ${result.service}: ${result.success ? result.message : '连接失败'}`)
    if (!result.success && result.error) {
      console.log('  错误详情:', result.error)
    }
  })
  
  return results
}

module.exports = {
  testSupabaseConnection,
  testAIConnection,
  testAllConnections
}
