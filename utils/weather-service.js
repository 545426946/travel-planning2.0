// utils/weather-service.js - 天气服务模块
// 使用聚合数据天气API：http://apis.juhe.cn/simpleWeather/query

// 引入配置
const { weatherConfig } = require('../config/weather-config')
const { globalWeatherConfig } = require('../config/global-weather-config')

class WeatherService {
  constructor() {
    this.baseUrl = globalWeatherConfig.juhe.baseUrl
    this.defaultCity = '北京'
    this.apiKey = globalWeatherConfig.juhe.apiKey
    this.cache = new Map()
    this.cacheTimeout = globalWeatherConfig.cache.timeout
    this.requestTimeout = globalWeatherConfig.request.timeout
    
    // 检查API密钥是否有效
    this.isApiKeyValid = this.apiKey && 
                        this.apiKey !== 'YOUR_API_KEY' && 
                        this.apiKey !== '请在这里填入您的实际API密钥'
  }

  /**
   * 获取天气信息（优先使用真实API，失败时使用备用方案）
   * @param {string} city - 城市名称
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} 天气数据
   */
  async getWeather(city = this.defaultCity, options = {}) {
    try {
      // 检查缓存
      const cacheKey = `${city}_${JSON.stringify(options)}`
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('使用缓存的天气数据:', city)
        return cached.data
      }

      console.log(`🌤️ 获取天气数据: ${city}`)
      console.log(`API密钥状态: ${this.isApiKeyValid ? '有效' : '无效/未配置'}`)

      let result
      
      // 如果API密钥有效，尝试聚合数据API
      if (this.isApiKeyValid) {
        try {
          result = await this.getWeatherFromAPI(city, options)
          if (result.success) {
            // 缓存数据
            this.cache.set(cacheKey, {
              data: result,
              timestamp: Date.now()
            })
            return result
          }
        } catch (error) {
          console.log('❌ 聚合数据API失败，使用备用方案...', error.message)
        }
      } else {
        console.log('⚠️ API密钥无效，直接使用备用方案')
      }
      
      // 使用备用方案（模拟数据）
      result = await this.getWeatherFromBackup(city, options)
      
      // 缓存数据
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      })
      
      return result
      
    } catch (error) {
      console.error('获取天气信息失败:', error)
      
      return {
        success: false,
        error: error.message,
        data: this.generateMockWeatherData(city)
      }
    }
  }

  /**
   * 从聚合数据API获取天气
   */
  async getWeatherFromAPI(city, options = {}) {
    try {
      // 清理城市名称
      const cleanCity = city.toString().replace(/[省市县区县镇乡]/g, '').trim()
      
      // 构建POST请求参数
      const params = {
        city: cleanCity,
        key: this.apiKey,
        ...options
      }

      console.log('📡 聚合数据API请求参数:', params)

      // 判断运行环境
      let response
      if (typeof wx !== 'undefined' && wx.request) {
        // 微信小程序环境
        response = await new Promise((resolve, reject) => {
          wx.request({
            url: this.baseUrl,
            method: 'POST',
            header: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            data: params,
            timeout: this.requestTimeout,
            success: (res) => {
              resolve(res)
            },
            fail: (err) => {
              reject(err)
            }
          })
        })
      } else {
        // Node.js环境或其他环境
        const queryString = Object.keys(params)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
          .join('&')
        
        const url = `${this.baseUrl}?${queryString}`
        
        // 使用内置的https模块
        const https = require('https')
        const URL = require('url')
        
        const parsedUrl = new URL.URL(url)
        
        response = await new Promise((resolve, reject) => {
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: this.requestTimeout
          }
          
          const req = https.request(options, (res) => {
            let data = ''
            
            res.on('data', (chunk) => { data += chunk })
            res.on('end', () => {
              try {
                const jsonData = JSON.parse(data)
                resolve({
                  statusCode: res.statusCode,
                  data: jsonData
                })
              } catch (e) {
                reject(new Error('JSON解析失败: ' + e.message))
              }
            })
          })
          
          req.on('error', (err) => {
            reject(err)
          })
          req.on('timeout', () => {
            req.destroy()
            reject(new Error('请求超时'))
          })
          
          req.end()
        })
      }

      console.log('📊 聚合数据API响应状态码:', response.statusCode)
      console.log('📋 聚合数据API响应数据:', response.data)

      if (response.statusCode !== 200) {
        throw new Error(`天气API错误: ${response.statusCode}`)
      }

      // 解析响应数据
      const weatherData = this.parseWeatherData(response.data, city)
      
      if (!weatherData) {
        throw new Error('天气数据解析失败')
      }

      return {
        success: true,
        data: weatherData
      }
      
    } catch (error) {
      console.error('❌ 聚合数据API获取失败:', error)
      throw error
    }
  }

  /**
   * 从备用方案获取天气（模拟数据）
   */
  async getWeatherFromBackup(city, options = {}) {
    try {
      console.log('🔄 使用备用天气方案（模拟数据）...')
      
      // 生成模拟数据
      const weatherData = this.generateMockWeatherData(city)
      
      return {
        success: false,
        error: '使用模拟数据 - 请配置有效的API密钥',
        data: weatherData
      }
      
    } catch (error) {
      console.error('❌ 备用方案失败:', error)
      throw error
    }
  }

  /**
   * 解析天气数据
   * @param {Object} rawData - 原始API响应数据
   * @param {string} city - 城市名称
   * @returns {Object} 解析后的天气数据
   */
  parseWeatherData(rawData, city) {
    try {
      let data = rawData
      if (typeof rawData === 'string') {
        try {
          data = JSON.parse(rawData)
        } catch (e) {
          console.log('天气数据不是JSON格式，使用原始数据')
        }
      }

      // 聚合数据API返回格式
      if (data.error_code === 0 && data.result) {
        const realtime = data.result.realtime
        const future = data.result.future || []
        
        return {
          city: city,
          current: {
            temperature: `${realtime.temperature}°C`,
            weather: realtime.info,
            humidity: `${realtime.humidity}%`,
            wind: `${realtime.direct} ${realtime.power}`,
            pressure: `${realtime.aqi}hPa`,
            visibility: realtime.aqi ? `${realtime.aqi}km` : '10km',
            icon: this.getWeatherIcon(realtime.info),
            rawData: realtime
          },
          forecast: future.map(day => this.parseForecastDay(day)),
          updateTime: new Date().toISOString(),
          source: '聚合数据',
          realData: true
        }
      }

      // 错误处理
      if (data.error_code && data.reason) {
        throw new Error(`API错误: ${data.reason}`)
      }

      throw new Error('无法识别的API响应格式')

    } catch (error) {
      console.error('解析天气数据失败:', error)
      return null
    }
  }

  /**
   * 解析单日预报
   * @param {Object} dayData - 单日预报数据
   * @returns {Object} 解析后的单日预报
   */
  parseForecastDay(dayData) {
    return {
      date: dayData.date,
      high: `${dayData.temperature}°C`,
      low: `${dayData.low || dayData.temperature - 5}°C`,
      weather: dayData.weather || dayData.info,
      wind: `${dayData.direct || '东风'} ${dayData.power || '2级'}`,
      icon: this.getWeatherIcon(dayData.weather || dayData.info)
    }
  }

  /**
   * 获取天气图标
   * @param {string} weather - 天气描述
   * @returns {string} 天气图标
   */
  getWeatherIcon(weather) {
    const iconMap = {
      '晴': '☀️',
      '多云': '⛅',
      '阴': '☁️',
      '小雨': '🌦️',
      '中雨': '🌧️',
      '大雨': '⛈️',
      '暴雨': '🌩️',
      '雪': '❄️',
      '雾': '🌫️',
      '霾': '😷',
      '沙尘': '🌪️'
    }

    // 模糊匹配
    for (const [key, icon] of Object.entries(iconMap)) {
      if (weather && weather.includes(key)) {
        return icon
      }
    }

    return '🌤️' // 默认图标
  }

  /**
   * 生成模拟天气数据（备用方案）
   * @param {string} city - 城市名称
   * @returns {Object} 模拟天气数据
   */
  generateMockWeatherData(city) {
    const weathers = ['晴', '多云', '阴', '小雨']
    const currentWeather = weathers[Math.floor(Math.random() * weathers.length)]
    const currentTemp = Math.floor(Math.random() * 15) + 15 // 15-30度

    return {
      city: city,
      current: {
        temperature: `${currentTemp}°C`,
        weather: currentWeather,
        humidity: '65%',
        wind: '东风2级',
        pressure: '1013hPa',
        visibility: '10km',
        icon: this.getWeatherIcon(currentWeather)
      },
      forecast: this.generateMockForecast(),
      updateTime: new Date().toISOString(),
      source: '模拟数据',
      mock: true
    }
  }

  /**
   * 生成模拟天气预报
   * @returns {Array} 模拟预报数据
   */
  generateMockForecast() {
    const weathers = ['晴', '多云', '阴', '小雨']
    const forecast = []
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      
      const weather = weathers[Math.floor(Math.random() * weathers.length)]
      const high = Math.floor(Math.random() * 10) + 20 // 20-30度
      const low = high - Math.floor(Math.random() * 10) - 5 // 比高温低5-15度

      forecast.push({
        date: date.toISOString().split('T')[0],
        high: `${high}°C`,
        low: `${low}°C`,
        weather: weather,
        wind: '东风2级',
        icon: this.getWeatherIcon(weather)
      })
    }

    return forecast
  }

  /**
   * 获取穿衣建议
   * @param {Object} weatherData - 天气数据
   * @returns {string} 穿衣建议
   */
  getClothingAdvice(weatherData) {
    try {
      const current = weatherData.current
      const temp = parseInt(current.temperature)
      const weather = current.weather

      if (temp >= 25) {
        return '建议穿轻薄透气的夏装，如短袖、短裤、裙子等'
      } else if (temp >= 15) {
        return '建议穿春秋装，如长袖衬衫、薄外套、长裤等'
      } else if (temp >= 5) {
        return '建议穿秋冬装，如毛衣、夹克、外套等'
      } else {
        return '建议穿厚重冬装，如羽绒服、棉衣、围巾等'
      }
    } catch (error) {
      return '建议根据当地气温选择合适的衣物'
    }
  }

  /**
   * 获取出行建议
   * @param {Object} weatherData - 天气数据
   * @returns {string} 出行建议
   */
  getTravelAdvice(weatherData) {
    try {
      const current = weatherData.current
      const weather = current.weather

      if (weather.includes('雨')) {
        return '有雨，建议携带雨具，注意路面湿滑'
      } else if (weather.includes('雾')) {
        return '有雾，能见度较低，驾驶需谨慎'
      } else if (weather.includes('霾')) {
        return '有霾，建议佩戴口罩，减少户外活动'
      } else if (weather.includes('雪')) {
        return '有雪，路面湿滑，注意保暖和交通安全'
      } else {
        return '天气良好，适合出行'
      }
    } catch (error) {
      return '出行前请关注最新天气情况'
    }
  }

  /**
   * 根据坐标获取天气信息（用于地图集成）
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} 天气数据
   */
  async getWeatherByCoordinates(lat, lng, options = {}) {
    try {
      console.log(`尝试根据坐标获取天气: lat=${lat}, lng=${lng}`)
      
      // 使用逆地理编码获取城市名称
      const city = await this.getCityByCoordinates(lat, lng)
      
      if (city && city !== '北京' && city.trim() !== '') { // 如果成功获取到具体城市（不是默认的北京且不为空）
        console.log(`根据坐标判断城市为: ${city}`)
        return await this.getWeather(city, options)
      } else {
        // 如果逆地理编码失败，使用坐标附近的天气数据
        console.log('逆地理编码失败或城市名称为空，使用备用方案')
        return await this.getWeatherByCoordinatesDirect(lat, lng, options)
      }
    } catch (error) {
      console.error('根据坐标获取天气失败:', error)
      
      // 返回模拟数据作为备用方案
      return {
        success: false,
        error: error.message,
        data: this.generateMockWeatherData('当前位置')
      }
    }
  }

  /**
   * 直接使用坐标查询天气（备用方案）
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} 天气数据
   */
  async getWeatherByCoordinatesDirect(lat, lng, options = {}) {
    try {
      // 使用粗略的城市判断作为位置信息
      const approximateCity = this.getApproximateCityByCoordinates(lat, lng)
      
      // 获取该城市的天气数据
      const result = await this.getWeather(approximateCity, options)
      
      // 在返回的数据中标记这是基于坐标的查询
      if (result.success && result.data) {
        result.data.source = 'coordinate_based'
        result.data.coordinates = { lat, lng }
        result.data.approximateCity = approximateCity
      }
      
      return result
    } catch (error) {
      console.error('直接坐标天气查询失败:', error)
      
      return {
        success: false,
        error: error.message,
        data: this.generateMockWeatherData('当前位置')
      }
    }
  }

  /**
   * 根据坐标获取城市名称
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @returns {Promise<string>} 城市名称
   */
  async getCityByCoordinates(lat, lng) {
    try {
      // 使用高德地图逆地理编码API
      const url = `https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${this.getMapKey()}&poitype=&radius=1000&extensions=all&batch=false&roadlevel=0`
      
      let response
      if (typeof wx !== 'undefined' && wx.request) {
        // 微信小程序环境
        response = await new Promise((resolve, reject) => {
          wx.request({
            url: url,
            method: 'GET',
            header: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 5000,
            success: (res) => {
              resolve(res)
            },
            fail: (err) => {
              reject(err)
            }
          })
        })
      } else {
        // Node.js环境或其他环境
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 5000
        })
        response = {
          statusCode: response.status,
          data: await response.json()
        }
      }

      if (response.statusCode === 200 && response.data.status === '1') {
        const regeocode = response.data.regeocode
        const addressComponent = regeocode.addressComponent
        
        console.log('逆地理编码结果:', addressComponent)
        
        // 返回城市名称，确保不为空，处理数组和字符串格式
        let cityName = addressComponent.city || 
                      addressComponent.province || 
                      addressComponent.district || 
                      addressComponent.township ||
                      '北京'
        
        // 处理可能的数组格式（如北京市返回的city是[]）
        if (Array.isArray(cityName)) {
          if (cityName.length > 0 && cityName[0]) {
            cityName = cityName[0]
          } else {
            // 如果数组为空，尝试其他字段
            cityName = addressComponent.province || 
                      addressComponent.district || 
                      addressComponent.township ||
                      '北京'
          }
        }
        
        console.log('提取的城市名称:', cityName)
        
        // 如果提取的城市名称无效，使用备用方案
        if (!cityName || (typeof cityName === 'string' && cityName.trim() === '') || cityName === '[]') {
          console.log('提取的城市名称无效，使用备用方案')
          return this.getApproximateCityByCoordinates(lat, lng)
        }
        
        return cityName
      } else {
        // 处理域名授权等错误
        if (response.data && response.data.infocode === '110') {
          console.warn('地图API域名未被授权，使用备用方案')
          // 使用粗略的地理判断作为备用方案
          return this.getApproximateCityByCoordinates(lat, lng)
        }
        console.log('逆地理编码API返回错误，使用备用方案:', response.data)
        return this.getApproximateCityByCoordinates(lat, lng)
      }
    } catch (error) {
      console.error('根据坐标获取城市失败:', error)
      // 使用备用方案
      return this.getApproximateCityByCoordinates(lat, lng)
    }
  }

  /**
   * 根据坐标粗略判断城市（备用方案）
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @returns {string} 近似城市名称
   */
  getApproximateCityByCoordinates(lat, lng) {
    // 基于中国主要城市的坐标范围进行粗略判断
    const cityRegions = [
      { name: '北京', latRange: [39.4, 41.1], lngRange: [115.4, 117.5] },
      { name: '上海', latRange: [30.7, 31.9], lngRange: [120.8, 122.2] },
      { name: '广州', latRange: [22.4, 24.0], lngRange: [112.9, 114.8] },
      { name: '深圳', latRange: [22.4, 22.9], lngRange: [113.7, 114.8] },
      { name: '成都', latRange: [30.1, 31.4], lngRange: [103.9, 105.0] },
      { name: '杭州', latRange: [29.9, 30.5], lngRange: [119.8, 120.7] },
      { name: '西安', latRange: [33.9, 34.5], lngRange: [108.4, 109.5] },
      { name: '南京', latRange: [31.8, 32.4], lngRange: [118.3, 119.2] },
      { name: '武汉', latRange: [30.4, 31.2], lngRange: [113.7, 115.1] },
      { name: '重庆', latRange: [29.4, 30.1], lngRange: [106.3, 107.1] },
      { name: '天津', latRange: [38.9, 39.4], lngRange: [116.7, 118.0] },
      { name: '苏州', latRange: [31.1, 31.4], lngRange: [120.4, 121.1] },
      { name: '青岛', latRange: [35.9, 36.4], lngRange: [119.9, 121.1] },
      { name: '大连', latRange: [38.7, 39.1], lngRange: [121.2, 122.1] },
      { name: '厦门', latRange: [24.4, 24.6], lngRange: [117.9, 118.7] }
    ]

    // 查找匹配的城市
    for (const region of cityRegions) {
      if (lat >= region.latRange[0] && lat <= region.latRange[1] &&
          lng >= region.lngRange[0] && lng <= region.lngRange[1]) {
        console.log(`根据坐标判断位置为: ${region.name}`)
        return region.name
      }
    }

    // 如果没有精确匹配，返回默认城市
    console.log(`坐标(${lat}, ${lng})不在主要城市范围内，返回默认城市: 北京`)
    return '北京'
  }

  /**
   * 获取地图API密钥
   * @returns {string} API密钥
   */
  getMapKey() {
    // 尝试获取高德地图API密钥
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      // 微信小程序环境，尝试从配置获取
      const app = getApp()
      if (app && app.globalData && app.globalData.amapKey) {
        return app.globalData.amapKey
      }
    }
    
    // 默认密钥
    return '57fe7237013ec222d99303e390757ecc'
  }

  /**
   * 获取简化的天气信息（用于地图标记显示）
   * @param {Object} weatherData - 完整天气数据
   * @returns {Object} 简化天气信息
   */
  getSimplifiedWeather(weatherData) {
    try {
      const current = weatherData.current
      return {
        temperature: current.temperature,
        weather: current.weather,
        icon: current.icon,
        color: this.getWeatherColor(current.weather),
        advice: this.getBriefTravelAdvice(current.weather),
        realData: weatherData.realData || false
      }
    } catch (error) {
      return {
        temperature: '25°C',
        weather: '晴',
        icon: '☀️',
        color: '#FFD700',
        advice: '天气良好',
        realData: false
      }
    }
  }

  /**
   * 获取天气对应的颜色
   * @param {string} weather - 天气描述
   * @returns {string} 颜色代码
   */
  getWeatherColor(weather) {
    const colorMap = {
      '晴': '#FFD700',
      '多云': '#87CEEB',
      '阴': '#B0C4DE',
      '小雨': '#4682B4',
      '中雨': '#1E90FF',
      '大雨': '#0000CD',
      '暴雨': '#000080',
      '雪': '#FFFFFF',
      '雾': '#D3D3D3',
      '霾': '#A9A9A9'
    }

    for (const [key, color] of Object.entries(colorMap)) {
      if (weather.includes(key)) {
        return color
      }
    }

    return '#87CEEB' // 默认颜色
  }

  /**
   * 获取简要的出行建议
   * @param {string} weather - 天气描述
   * @returns {string} 简要建议
   */
  getBriefTravelAdvice(weather) {
    if (weather.includes('雨')) return '注意防雨'
    if (weather.includes('雾')) return '注意能见度'
    if (weather.includes('霾')) return '佩戴口罩'
    if (weather.includes('雪')) return '注意防滑'
    if (weather.includes('晴')) return '适合出行'
    return '天气良好'
  }

  /**
   * 批量获取多个位置的天气信息（用于地图显示）
   * @param {Array} locations - 位置数组 [{lat, lng, name}, ...]
   * @returns {Promise<Array>} 天气信息数组
   */
  async getBatchWeatherForLocations(locations) {
    try {
      const promises = locations.map(async (location) => {
        try {
          const weatherResult = await this.getWeatherByCoordinates(location.lat, location.lng)
          return {
            ...location,
            weather: weatherResult.success ? this.getSimplifiedWeather(weatherResult.data) : null,
            weatherError: weatherResult.error || null
          }
        } catch (error) {
          return {
            ...location,
            weather: null,
            weatherError: error.message
          }
        }
      })

      return await Promise.all(promises)
    } catch (error) {
      console.error('批量获取天气信息失败:', error)
      return locations.map(location => ({
        ...location,
        weather: null,
        weatherError: '批量查询失败'
      }))
    }
  }
}

// 创建单例实例
const weatherService = new WeatherService()

module.exports = {
  weatherService
}