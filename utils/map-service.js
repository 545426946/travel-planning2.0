/**
 * 地图服务 - 简化版本
 * 提供地图相关的工具方法
 */

const attractionsDB = require('../config/attractions-database')
const mapConfig = require('../config/map-config')

class MapService {
  constructor() {
    this.amapKey = mapConfig.amap.key
    console.log('[MapService] 初始化完成')
  }

  /**
   * 从本地数据库查找景点
   */
  findInLocalDB(name) {
    if (!name) return null
    
    // 精确匹配
    if (attractionsDB[name]) {
      const data = attractionsDB[name]
      return {
        name: name,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address || '',
        source: 'local_db'
      }
    }
    
    // 模糊匹配 - 数据库名称包含输入
    for (const [dbName, data] of Object.entries(attractionsDB)) {
      if (dbName.includes(name) && name.length >= 2) {
        return {
          name: dbName,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address || '',
          source: 'local_db'
        }
      }
    }
    
    // 模糊匹配 - 输入包含数据库名称
    for (const [dbName, data] of Object.entries(attractionsDB)) {
      if (name.includes(dbName) && dbName.length >= 2) {
        return {
          name: dbName,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address || '',
          source: 'local_db'
        }
      }
    }
    
    return null
  }

  /**
   * 使用高德API搜索景点
   */
  async searchByAPI(keyword, city) {
    return new Promise((resolve) => {
      wx.request({
        url: mapConfig.amap.poiUrl,
        data: {
          key: this.amapKey,
          keywords: keyword,
          city: city || '',
          citylimit: city ? 'true' : 'false',
          types: '110000|110100|110200|140000|150000|160000|170000|180000|190000',
          offset: 10,
          output: 'json'
        },
        timeout: 8000,
        success: (res) => {
          if (res.data?.status === '1' && res.data?.pois?.length > 0) {
            const poi = this.findBestMatch(res.data.pois, keyword)
            if (poi && poi.location) {
              const parts = poi.location.split(',')
              if (parts.length === 2) {
                const lng = parseFloat(parts[0])
                const lat = parseFloat(parts[1])
                if (!isNaN(lat) && !isNaN(lng)) {
                  resolve({
                    name: poi.name,
                    latitude: lat,
                    longitude: lng,
                    address: poi.address || '',
                    source: 'api_search'
                  })
                  return
                }
              }
            }
          }
          resolve(null)
        },
        fail: (err) => {
          console.warn(`[MapService] API请求失败 ${keyword}:`, err)
          resolve(null)
        }
      })
    })
  }

  /**
   * 地理编码
   */
  async geocode(address, city) {
    const searchAddress = city ? `${city}${address}` : address
    
    return new Promise((resolve) => {
      wx.request({
        url: mapConfig.amap.geoUrl,
        data: {
          key: this.amapKey,
          address: searchAddress,
          city: city || '',
          output: 'json'
        },
        timeout: 6000,
        success: (res) => {
          if (res.data?.status === '1' && res.data?.geocodes?.length > 0) {
            const geo = res.data.geocodes[0]
            if (geo.location) {
              const parts = geo.location.split(',')
              if (parts.length === 2) {
                const lng = parseFloat(parts[0])
                const lat = parseFloat(parts[1])
                if (!isNaN(lat) && !isNaN(lng)) {
                  resolve({
                    name: address,
                    latitude: lat,
                    longitude: lng,
                    address: geo.formatted_address || address,
                    source: 'geocoding'
                  })
                  return
                }
              }
            }
          }
          resolve(null)
        },
        fail: () => resolve(null)
      })
    })
  }

  /**
   * 定位景点（优先本地数据库）
   */
  async locateAttraction(name, city) {
    console.log(`[MapService] 定位景点: ${name}, 城市: ${city}`)

    // 优先使用本地数据库
    const localResult = this.findInLocalDB(name)
    if (localResult) {
      console.log(`[MapService] 本地数据库命中: ${name}`)
      return localResult
    }

    // API搜索
    try {
      const apiResult = await this.searchByAPI(name, city)
      if (apiResult) {
        console.log(`[MapService] API搜索成功: ${name}`)
        return apiResult
      }
    } catch (e) {
      console.warn(`[MapService] API搜索异常: ${name}`, e)
    }

    // 地理编码作为备选
    try {
      const geoResult = await this.geocode(name, city)
      if (geoResult) {
        console.log(`[MapService] 地理编码成功: ${name}`)
        return geoResult
      }
    } catch (e) {
      console.warn(`[MapService] 地理编码异常: ${name}`, e)
    }

    console.log(`[MapService] 定位失败: ${name}`)
    return null
  }

  /**
   * 找最佳匹配
   */
  findBestMatch(poiList, targetName) {
    if (!poiList || poiList.length === 0) return null
    let match = poiList.find(p => p.name === targetName)
    if (match) return match
    match = poiList.find(p => p.name.includes(targetName))
    if (match) return match
    match = poiList.find(p => targetName.includes(p.name))
    if (match) return match
    return poiList[0]
  }

  /**
   * 获取城市坐标
   */
  getCityCoords(city) {
    const coords = mapConfig.cityCoordinates || {}
    if (!city) return { latitude: 39.904989, longitude: 116.405285, scale: 12 }
    if (coords[city]) return coords[city]
    
    for (const [name, data] of Object.entries(coords)) {
      if (city.includes(name) || name.includes(city)) return data
    }
    return { latitude: 39.904989, longitude: 116.405285, scale: 12 }
  }

  /**
   * 计算两点间距离（公里）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = this.toRad(lat2 - lat1)
    const dLng = this.toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  /**
   * 计算总距离
   */
  calculateTotalDistance(attractions) {
    if (!attractions || attractions.length < 2) return 0
    let total = 0
    for (let i = 0; i < attractions.length - 1; i++) {
      total += this.calculateDistance(
        attractions[i].latitude, attractions[i].longitude,
        attractions[i + 1].latitude, attractions[i + 1].longitude
      )
    }
    return Math.round(total * 10) / 10
  }

  /**
   * 优化路线（最近邻算法）
   */
  optimizeRoute(attractions) {
    if (!attractions || attractions.length < 3) return attractions
    
    const remaining = [...attractions]
    const optimized = [remaining.shift()]

    while (remaining.length > 0) {
      const current = optimized[optimized.length - 1]
      let nearestIdx = 0
      let nearestDist = Infinity

      remaining.forEach((item, idx) => {
        const dist = this.calculateDistance(
          current.latitude, current.longitude,
          item.latitude, item.longitude
        )
        if (dist < nearestDist) {
          nearestDist = dist
          nearestIdx = idx
        }
      })
      optimized.push(remaining.splice(nearestIdx, 1)[0])
    }
    
    return optimized.map((item, idx) => ({ ...item, id: idx + 1 }))
  }

  /**
   * 计算地图边界
   */
  calculateMapBounds(attractions) {
    if (!attractions || attractions.length === 0) {
      return { latitude: 39.904989, longitude: 116.405285, scale: 12 }
    }
    
    const valid = attractions.filter(a => {
      const lat = parseFloat(a.latitude)
      const lng = parseFloat(a.longitude)
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
    })
    
    if (valid.length === 0) {
      return { latitude: 39.904989, longitude: 116.405285, scale: 12 }
    }
    
    if (valid.length === 1) {
      return { 
        latitude: parseFloat(valid[0].latitude), 
        longitude: parseFloat(valid[0].longitude), 
        scale: 15 
      }
    }

    const lats = valid.map(a => parseFloat(a.latitude))
    const lngs = valid.map(a => parseFloat(a.longitude))
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2
    const maxDiff = Math.max(maxLat - minLat, maxLng - minLng)

    let scale = 15
    if (maxDiff > 0.5) scale = 8
    else if (maxDiff > 0.2) scale = 10
    else if (maxDiff > 0.1) scale = 11
    else if (maxDiff > 0.05) scale = 12
    else if (maxDiff > 0.02) scale = 13
    else if (maxDiff > 0.01) scale = 14

    return { latitude: centerLat, longitude: centerLng, scale }
  }

  /**
   * 估算旅行时间
   */
  estimateTravelTime(distance, mode = 'driving') {
    const speeds = { walking: 5, driving: 30, transit: 20 }
    const speed = speeds[mode] || speeds.driving
    return Math.round(distance / speed * 60)
  }

  /**
   * 格式化时间
   */
  formatTime(minutes) {
    if (minutes < 60) return `${minutes}分钟`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
  }

  /**
   * 生成路线摘要
   */
  generateRouteSummary(attractions) {
    if (!attractions || attractions.length === 0) {
      return { count: 0, distance: 0, time: 0, timeText: '0分钟' }
    }
    const distance = this.calculateTotalDistance(attractions)
    const time = this.estimateTravelTime(distance)
    return { count: attractions.length, distance, time, timeText: this.formatTime(time) }
  }

  toRad(deg) { return deg * Math.PI / 180 }
  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }
}

module.exports = new MapService()
