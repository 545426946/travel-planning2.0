/**
 * 足迹服务 - 管理用户旅行足迹
 * 包含打卡、足迹统计、省份点亮等功能
 */

const supabase = require('./supabase').supabase
const mapConfig = require('../config/map-config')

class FootprintService {
  constructor() {
    this.amapKey = mapConfig.amap.key
  }

  /**
   * 添加足迹/打卡
   */
  async addFootprint(userId, data) {
    try {
      const footprint = {
        user_id: userId,
        type: data.type || 'attraction',
        name: data.name,
        province: data.province || '',
        city: data.city || '',
        district: data.district || '',
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address || '',
        photos: data.photos || [],
        note: data.note || '',
        plan_id: data.planId || null,
        checkin_time: data.checkinTime || new Date().toISOString()
      }

      const { data: result, error } = await supabase
        .from('footprints')
        .insert(footprint)
        .select()
        .single()

      if (error) throw error

      // 更新统计数据
      await this.updateStats(userId)

      return { success: true, data: result }
    } catch (error) {
      console.error('[FootprintService] 添加足迹失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取用户足迹列表
   */
  async getFootprints(userId, options = {}) {
    try {
      let query = supabase
        .from('footprints')
        .select('*')
        .eq('user_id', userId)
        .order('checkin_time', { ascending: false })

      if (options.limit) {
        query = query.limit(options.limit)
      }

      if (options.province) {
        query = query.eq('province', options.province)
      }

      if (options.city) {
        query = query.eq('city', options.city)
      }

      const { data, error } = await query

      if (error) throw error

      return { success: true, data: data || [] }
    } catch (error) {
      console.error('[FootprintService] 获取足迹失败:', error)
      return { success: false, error: error.message, data: [] }
    }
  }

  /**
   * 获取用户统计数据
   */
  async getStats(userId) {
    try {
      const { data, error } = await supabase
        .from('travel_stats')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      // 如果没有统计数据，返回默认值
      if (!data) {
        return {
          success: true,
          data: {
            total_provinces: 0,
            total_cities: 0,
            total_attractions: 0,
            total_distance: 0,
            total_trips: 0,
            visited_provinces: [],
            visited_cities: []
          }
        }
      }

      return { success: true, data }
    } catch (error) {
      console.error('[FootprintService] 获取统计失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 更新用户统计数据
   */
  async updateStats(userId) {
    try {
      // 获取所有足迹
      const { data: footprints } = await supabase
        .from('footprints')
        .select('province, city, latitude, longitude')
        .eq('user_id', userId)

      if (!footprints || footprints.length === 0) return

      // 统计省份和城市
      const provinces = new Set()
      const cities = new Set()

      footprints.forEach(f => {
        if (f.province) provinces.add(f.province)
        if (f.city) cities.add(f.city)
      })

      // 计算总距离（简化版：相邻足迹距离之和）
      let totalDistance = 0
      for (let i = 1; i < footprints.length; i++) {
        const prev = footprints[i - 1]
        const curr = footprints[i]
        if (prev.latitude && curr.latitude) {
          totalDistance += this.calculateDistance(
            prev.latitude, prev.longitude,
            curr.latitude, curr.longitude
          )
        }
      }

      const stats = {
        user_id: userId,
        total_provinces: provinces.size,
        total_cities: cities.size,
        total_attractions: footprints.length,
        total_distance: Math.round(totalDistance),
        visited_provinces: Array.from(provinces),
        visited_cities: Array.from(cities),
        updated_at: new Date().toISOString()
      }

      // upsert 统计数据
      const { error } = await supabase
        .from('travel_stats')
        .upsert(stats, { onConflict: 'user_id' })

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('[FootprintService] 更新统计失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取已点亮的省份
   */
  async getVisitedProvinces(userId) {
    try {
      const { data, error } = await supabase
        .from('footprints')
        .select('province')
        .eq('user_id', userId)

      if (error) throw error

      const provinces = new Set()
      data?.forEach(f => {
        if (f.province) provinces.add(f.province)
      })

      return { success: true, data: Array.from(provinces) }
    } catch (error) {
      console.error('[FootprintService] 获取省份失败:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * 删除足迹
   */
  async deleteFootprint(userId, footprintId) {
    try {
      const { error } = await supabase
        .from('footprints')
        .delete()
        .eq('id', footprintId)
        .eq('user_id', userId)

      if (error) throw error

      // 更新统计
      await this.updateStats(userId)

      return { success: true }
    } catch (error) {
      console.error('[FootprintService] 删除足迹失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 逆地理编码 - 根据坐标获取地址信息
   */
  async reverseGeocode(latitude, longitude) {
    return new Promise((resolve) => {
      const location = `${longitude},${latitude}`
      
      wx.request({
        url: mapConfig.amap.regeoUrl,
        data: {
          key: this.amapKey,
          location: location,
          extensions: 'base',
          output: 'json'
        },
        timeout: mapConfig.amap.timeout,
        success: (res) => {
          if (res.data?.status === '1' && res.data?.regeocode) {
            const regeo = res.data.regeocode
            const addr = regeo.addressComponent || {}
            
            resolve({
              success: true,
              data: {
                province: addr.province || '',
                city: addr.city || addr.province || '',
                district: addr.district || '',
                address: regeo.formatted_address || '',
                township: addr.township || '',
                neighborhood: addr.neighborhood?.name || ''
              }
            })
          } else {
            resolve({ success: false, error: '逆地理编码失败' })
          }
        },
        fail: (err) => {
          console.error('[FootprintService] 逆地理编码失败:', err)
          resolve({ success: false, error: err.errMsg })
        }
      })
    })
  }

  /**
   * POI搜索 - 搜索附近景点
   */
  async searchNearby(latitude, longitude, keyword = '景点', radius = 3000) {
    return new Promise((resolve) => {
      const location = `${longitude},${latitude}`
      
      wx.request({
        url: mapConfig.amap.aroundUrl,
        data: {
          key: this.amapKey,
          location: location,
          keywords: keyword,
          types: '110000|110100|110200|110201|110202|110203|110204|110205|110206|110207|110208|110209|110210',
          radius: radius,
          offset: 20,
          output: 'json'
        },
        timeout: mapConfig.amap.timeout,
        success: (res) => {
          if (res.data?.status === '1' && res.data?.pois) {
            const pois = res.data.pois.map(poi => {
              const [lng, lat] = poi.location.split(',')
              return {
                id: poi.id,
                name: poi.name,
                address: poi.address || '',
                type: poi.type || '',
                latitude: parseFloat(lat),
                longitude: parseFloat(lng),
                distance: parseInt(poi.distance) || 0,
                tel: poi.tel || ''
              }
            })
            resolve({ success: true, data: pois })
          } else {
            resolve({ success: false, data: [] })
          }
        },
        fail: (err) => {
          console.error('[FootprintService] POI搜索失败:', err)
          resolve({ success: false, data: [], error: err.errMsg })
        }
      })
    })
  }

  /**
   * 地理编码 - 根据地址获取坐标
   */
  async geocode(address, city = '') {
    return new Promise((resolve) => {
      wx.request({
        url: mapConfig.amap.geoUrl,
        data: {
          key: this.amapKey,
          address: address,
          city: city,
          output: 'json'
        },
        timeout: mapConfig.amap.timeout,
        success: (res) => {
          if (res.data?.status === '1' && res.data?.geocodes?.length > 0) {
            const geo = res.data.geocodes[0]
            const [lng, lat] = geo.location.split(',')
            
            resolve({
              success: true,
              data: {
                name: address,
                latitude: parseFloat(lat),
                longitude: parseFloat(lng),
                province: geo.province || '',
                city: geo.city || geo.province || '',
                district: geo.district || '',
                address: geo.formatted_address || address
              }
            })
          } else {
            resolve({ success: false, error: '地理编码失败' })
          }
        },
        fail: (err) => {
          console.error('[FootprintService] 地理编码失败:', err)
          resolve({ success: false, error: err.errMsg })
        }
      })
    })
  }

  /**
   * 计算两点距离（公里）
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

  toRad(deg) {
    return deg * Math.PI / 180
  }
}

module.exports = new FootprintService()
