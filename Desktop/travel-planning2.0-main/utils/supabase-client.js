// 微信小程序专用的 Supabase 客户端配置
// 由于微信小程序环境限制，需要特殊处理

// 从环境变量或配置文件读取 Supabase 配置
const SUPABASE_URL = 'https://hmnjuntvubqvbpeyqoxw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtbmp1bnR2dWJxdmJwZXlxb3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MjEwNDYsImV4cCI6MjA3ODk5NzA0Nn0.BCp0_8M3OhlIhLQ4fz54le-sWqZeUx9JDRXr1XRsX8g'

/**
 * 微信小程序适配的 Supabase 客户端
 * 使用 wx.request 替代标准的 fetch API
 */
class WechatSupabaseClient {
  constructor(url, key) {
    this.url = url
    this.key = key
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  }

  /**
   * 通用的请求方法
   */
  request(options) {
    return new Promise((resolve, reject) => {
      const { method = 'GET', path = '', data = null, customHeaders = {} } = options
      
      const requestOptions = {
        url: `${this.url}${path}`,
        method: method.toUpperCase(),
        header: {
          ...this.headers,
          ...customHeaders
        },
        data: data,
        dataType: 'json',
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`))
          }
        },
        fail: (error) => {
          reject(new Error(`请求失败: ${error.errMsg}`))
        }
      }

      wx.request(requestOptions)
    })
  }

  /**
   * 调用 Edge Function
   */
  async invokeFunction(functionName, data = {}, options = {}) {
    try {
      console.log(`🚀 调用 Edge Function: ${functionName}`, data)
      
      const response = await this.request({
        method: 'POST',
        path: `/functions/v1/${functionName}`,
        data: data,
        customHeaders: options.headers || {}
      })

      console.log(`✅ Edge Function 响应:`, response)
      return { data: response, error: null }
    } catch (error) {
      console.error(`❌ Edge Function 调用失败:`, error.message)
      return { data: null, error: error }
    }
  }

  /**
   * 数据库查询 - 从表获取数据
   */
  from(table) {
    return new WechatSupabaseQueryBuilder(this, table)
  }

  /**
   * 直接执行数据库操作
   */
  async rpc(functionName, params = {}) {
    return this.request({
      method: 'POST',
      path: `/rpc/${functionName}`,
      data: params
    })
  }
}

/**
 * 查询构建器
 */
class WechatSupabaseQueryBuilder {
  constructor(client, table) {
    this.client = client
    this.table = table
    this.query = {
      select: '*',
      filters: [],
      orderBy: null,
      limit: null
    }
  }

  select(columns = '*') {
    this.query.select = columns
    return this
  }

  eq(column, value) {
    this.query.filters.push(`${column}=eq.${value}`)
    return this
  }

  neq(column, value) {
    this.query.filters.push(`${column}=neq.${value}`)
    return this
  }

  gt(column, value) {
    this.query.filters.push(`${column}=gt.${value}`)
    return this
  }

  gte(column, value) {
    this.query.filters.push(`${column}=gte.${value}`)
    return this
  }

  lt(column, value) {
    this.query.filters.push(`${column}=lt.${value}`)
    return this
  }

  lte(column, value) {
    this.query.filters.push(`${column}=lte.${value}`)
    return this
  }

  like(column, value) {
    this.query.filters.push(`${column}=like.${value}`)
    return this
  }

  ilike(column, value) {
    this.query.filters.push(`${column}=ilike.${value}`)
    return this
  }

  in(column, values) {
    this.query.filters.push(`${column}=in.(${values.join(',')})`)
    return this
  }

  order(column, options = {}) {
    const ascending = options.ascending !== false
    this.query.orderBy = `${column}.${ascending ? 'asc' : 'desc'}`
    return this
  }

  limit(count) {
    this.query.limit = count
    return this
  }

  single() {
    this.query.single = true
    return this.execute()
  }

  async execute() {
    try {
      let path = `/rest/v1/${this.table}?select=${this.query.select}`
      
      if (this.query.filters.length > 0) {
        path += '&' + this.query.filters.join('&')
      }
      
      if (this.query.orderBy) {
        path += `&order=${this.query.orderBy}`
      }
      
      if (this.query.limit) {
        path += `&limit=${this.query.limit}`
      }

      const response = await this.client.request({
        method: 'GET',
        path: path
      })

      if (this.query.single) {
        if (Array.isArray(response) && response.length > 0) {
          return { data: response[0], error: null }
        } else if (Array.isArray(response) && response.length === 0) {
          return { data: null, error: null }
        }
      }

      return { data: response, error: null }
    } catch (error) {
      return { data: null, error: error }
    }
  }

  async insert(data, options = {}) {
    try {
      const response = await this.client.request({
        method: 'POST',
        path: `/rest/v1/${this.table}?select=${options.select || '*'}`,
        data: Array.isArray(data) ? data : [data]
      })

      return { data: response, error: null }
    } catch (error) {
      return { data: null, error: error }
    }
  }

  async update(data, options = {}) {
    try {
      let path = `/rest/v1/${this.table}?select=${options.select || '*'}`
      
      if (this.query.filters.length > 0) {
        path += '&' + this.query.filters.join('&')
      }

      const response = await this.client.request({
        method: 'PATCH',
        path: path,
        data: data
      })

      return { data: response, error: null }
    } catch (error) {
      return { data: null, error: error }
    }
  }

  async delete() {
    try {
      let path = `/rest/v1/${this.table}`
      
      if (this.query.filters.length > 0) {
        path += '?' + this.query.filters.join('&')
      }

      await this.client.request({
        method: 'DELETE',
        path: path
      })

      return { data: null, error: null }
    } catch (error) {
      return { data: null, error: error }
    }
  }
}

/**
 * 创建 Supabase 客户端实例
 */
function createClient(url = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
  return new WechatSupabaseClient(url, key)
}

/**
 * 微信登录专用的简化接口
 */
const WechatSupabase = {
  client: createClient(),
  
  // 调用微信登录 Edge Function
  async wechatLogin(loginData) {
    return await this.client.invokeFunction('wechat-login', loginData)
  },

  // 查询用户信息
  async getUserByOpenid(openid) {
    const result = await this.client
      .from('app_users')
      .select('*')
      .eq('openid', openid)
      .single()
    
    return result
  },

  // 创建用户会话记录
  async createUserSession(sessionData) {
    const result = await this.client
      .from('user_sessions')
      .insert(sessionData)
    
    return result
  },

  // 更新用户信息
  async updateUser(openid, updateData) {
    const result = await this.client
      .from('app_users')
      .update(updateData)
      .eq('openid', openid)
    
    return result
  },

  // 获取用户会话
  async getUserSession(sessionId) {
    const result = await this.client
      .from('user_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .single()
    
    return result
  },

  // 通用方法访问底层客户端
  getClient() {
    return this.client
  }
}

module.exports = {
  createClient,
  WechatSupabase,
  WechatSupabaseClient,
  WechatSupabaseQueryBuilder
}