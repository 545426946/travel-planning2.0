// utils/supabase-proxy.js
// 临时代理配置，用于绕过微信小程序域名限制

// 不使用代理，直接请求（需要在微信公众平台配置域名白名单）
const PROXY_URL = ''
const supabaseUrl = 'https://hmnjuntvubqvbpeyqoxw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtbmp1bnR2dWJxdmJwZXlxb3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MjEwNDYsImV4cCI6MjA3ODk5NzA0Nn0.BCp0_8M3OhlIhLQ4fz54le-sWqZeUx9JDRXr1XRsX8g'

// 创建查询构建器类（带代理）
class QueryBuilder {
  constructor(table, useProxy = false) {
    this.table = table
    this.baseUrl = useProxy ? PROXY_URL + supabaseUrl : supabaseUrl
    this.supabaseAnonKey = supabaseAnonKey
    this.queryParams = []
    this.selectColumns = '*'
    this.method = 'GET'
    this.body = null
  }

  select(columns = '*') {
    this.selectColumns = columns
    return this
  }

  eq(column, value) {
    this.queryParams.push(`${column}=eq.${value}`)
    return this
  }

  order(column, options = {}) {
    const direction = options.ascending ? 'asc' : 'desc'
    this.queryParams.push(`order=${column}.${direction}`)
    return this
  }

  limit(count) {
    this.queryParams.push(`limit=${count}`)
    return this
  }

  or(conditions) {
    this.queryParams.push(`or=(${conditions})`)
    return this
  }

  single() {
    this.queryParams.push('limit=1')
    return this
  }

  insert(data) {
    this.method = 'POST'
    this.body = data
    return this
  }

  update(data) {
    this.method = 'PATCH'
    this.body = data
    return this
  }

  upsert(data) {
    this.method = 'POST'
    this.body = data
    return this
  }

  delete() {
    this.method = 'DELETE'
    return this
  }

  buildUrl() {
    let url = `${this.baseUrl}/rest/v1/${this.table}`
    if (this.method === 'GET' && this.queryParams.length > 0) {
      url += '?' + this.queryParams.join('&')
    } else if (this.method !== 'GET' && this.queryParams.length > 0) {
      url += '?' + this.queryParams.filter(param => !param.startsWith('order=') && !param.startsWith('limit=')).join('&')
    }
    return url
  }

  then(callback) {
    const url = this.buildUrl()
    const headers = {
      'apikey': this.supabaseAnonKey,
      'Authorization': `Bearer ${this.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    // 添加特殊头部
    if (this.method === 'POST') {
      headers['Prefer'] = 'return=representation'
      if (this.method === 'POST' && this.body) {
        headers['Prefer'] = 'return=representation,resolution=merge-duplicates'
      }
    } else if (this.method === 'PATCH') {
      headers['Prefer'] = 'return=representation'
    }

    const requestOptions = {
      url: url,
      method: this.method,
      header: headers,
      success: (res) => {
        console.log('请求成功:', { url, status: res.statusCode, data: res.data })
        
        // 检查HTTP状态码，409表示冲突
        if (res.statusCode === 409) {
          const errorObj = {
            statusCode: res.statusCode,
            status: '409',
            code: '23505',
            message: res.data?.message || 'duplicate key value violates unique constraint',
            details: res.data?.details || null
          }
          
          callback({ 
            data: null, 
            error: errorObj
          })
          return
        }
        
        callback({ 
          data: res.data, 
          error: null
        })
      },
      fail: (err) => {
        console.error('请求失败:', { url, error: err })
        
        const errorObj = {
          statusCode: err.statusCode || err.status,
          status: err.statusCode ? String(err.statusCode) : err.status,
          code: err.code,
          message: err.message || err.errMsg || '请求失败',
          details: err.details || null
        }
        
        callback({ data: null, error: errorObj })
      }
    }

    if (this.body && (this.method === 'POST' || this.method === 'PATCH')) {
      requestOptions.data = this.body
    }

    if (this.method === 'GET') {
      if (!url.includes('select=')) {
        requestOptions.url += (url.includes('?') ? '&' : '?') + `select=${this.selectColumns}`
      }
    }

    wx.request(requestOptions)
    return this
  }

  catch(callback) {
    return this.then((result) => {
      if (result.error) {
        callback(result.error)
      }
    })
  }
}

// 创建Supabase客户端
const supabase = {
  from: (table) => {
    // 默认使用代理，可以改为 false 来直接请求
    return new QueryBuilder(table, true)
  }
}

module.exports = { supabase }