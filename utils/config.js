// utils/config.js - 小程序配置文件
// 微信小程序环境下的配置管理

// 小程序环境变量
const getAppConfig = () => {
  try {
    // 尝试从 app.js 的 globalData 获取配置
    const app = getApp()
    if (app && app.globalData && app.globalData.config) {
      return app.globalData.config
    }
    return {}
  } catch (error) {
    console.warn('无法获取应用配置，使用默认配置')
    return {}
  }
}

// AI 服务配置
const AI_CONFIG = {
  // 尝试多个AI服务，按优先级排序
  providers: [
    {
      name: 'mistral',
      apiKey: getAppConfig().AI_API_KEY || 'E8L3fryNUIsAoWvROdNrumpwFTtfuCBL',
      apiUrl: getAppConfig().AI_API_URL || 'https://api.mistral.ai/v1/chat/completions',
      model: getAppConfig().AI_MODEL || 'mistral-small-latest'
    },
    {
      name: 'openai',
      apiKey: 'sk-placeholder-key', // 需要配置真实的OpenAI密钥
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo'
    }
  ],
  // 当前使用的配置（向后兼容）
  apiKey: getAppConfig().AI_API_KEY || 'E8L3fryNUIsAoWvROdNrumpwFTtfuCBL',
  apiUrl: getAppConfig().AI_API_URL || 'https://api.mistral.ai/v1/chat/completions',
  model: getAppConfig().AI_MODEL || 'mistral-small-latest'
}

// Supabase 配置
const SUPABASE_CONFIG = {
  url: getAppConfig().SUPABASE_URL || 'https://hmnjuntvubqvbpeyqoxw.supabase.co',
  anonKey: getAppConfig().SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtbmp1bnR2dWJxdmJwZXlxb3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MjEwNDYsImV4cCI6MjA3ODk5NzA0Nn0.BCp0_8M3OhlIhLQ4fz54le-sWqZeUx9JDRXr1XRsX8g'
}

// 应用基础配置
const APP_CONFIG = {
  version: '1.0.0',
  name: '旅行规划',
  debug: true
}

module.exports = {
  AI_CONFIG,
  SUPABASE_CONFIG,
  APP_CONFIG,
  getAppConfig
}