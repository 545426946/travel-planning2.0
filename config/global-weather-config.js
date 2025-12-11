/**
 * 全局天气配置文件
 */

module.exports = {
  globalWeatherConfig: {
    // 聚合数据天气API配置
    juhe: {
      baseUrl: 'http://apis.juhe.cn/simpleWeather/query',
      apiKey: 'YOUR_API_KEY' // 请替换为实际的API密钥
    },
    // 缓存配置
    cache: {
      timeout: 30 * 60 * 1000 // 30分钟
    },
    // 请求配置
    request: {
      timeout: 10000
    }
  }
}
