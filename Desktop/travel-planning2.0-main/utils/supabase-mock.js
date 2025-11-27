// utils/supabase-mock.js
// 模拟 Supabase 数据，用于开发和测试

// 模拟用户数据
const mockUsers = [
  {
    id: 1,
    username: 'admin',
    password: '123456',
    name: '管理员',
    email: 'admin@example.com',
    phone: '13800138000',
    avatar: 'https://s1.aigei.com/src/img/png/40/401c73a8ae5043528a2ac0b2a41a1e13.png?imageMogr2/auto-orient/thumbnail/!282x282r/gravity/Center/crop/282x282/quality/85/%7CimageView2/2/w/282&e=2051020800&token=P7S2Xpzfz11vAkASLTkfHN7Fw-oOZBecqeJaxypL:lHzyX4Iuq2P-fNxU-t9ookog1Qo=',
    login_type: 'account',
    status: 'active',
    login_count: 0,
    last_login: null,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    username: 'user',
    password: '123456',
    name: '测试用户',
    email: 'user@example.com',
    phone: '13900139000',
    avatar: 'https://s1.aigei.com/src/img/png/40/401c73a8ae5043528a2ac0b2a41a1e13.png?imageMogr2/auto-orient/thumbnail/!282x282r/gravity/Center/crop/282x282/quality/85/%7CimageView2/2/w/282&e=2051020800&token=P7S2Xpzfz11vAkASLTkfHN7Fw-oOZBecqeJaxypL:lHzyX4Iuq2P-fNxU-t9ookog1Qo=',
    login_type: 'account',
    status: 'active',
    login_count: 0,
    last_login: null,
    created_at: new Date().toISOString()
  }
]

// 模拟行程数据
const mockTravelPlans = [
  {
    id: 1,
    user_id: 1,
    title: '北京三日游',
    destination: '北京',
    start_date: '2024-02-01',
    end_date: '2024-02-03',
    status: 'planned',
    budget: 3000,
    created_at: new Date('2024-01-15').toISOString(),
    description: '游览故宫、长城、天坛等著名景点'
  },
  {
    id: 2,
    user_id: 1,
    title: '上海周末游',
    destination: '上海',
    start_date: '2024-02-10',
    end_date: '2024-02-11',
    status: 'ongoing',
    budget: 2000,
    created_at: new Date('2024-01-20').toISOString(),
    description: '外滩、东方明珠、城隍庙'
  },
  {
    id: 3,
    user_id: 2,
    title: '西湖赏花游',
    destination: '杭州',
    start_date: '2024-03-15',
    end_date: '2024-03-17',
    status: 'completed',
    budget: 2500,
    created_at: new Date('2024-01-25').toISOString(),
    description: '西湖、灵隐寺、雷峰塔'
  }
]

// 模拟查询构建器类
class MockQueryBuilder {
  constructor(table) {
    this.table = table
    this.queryConditions = []
    this.method = 'GET'
    this.updateData = null
    this.insertData = null
  }

  select(columns = '*') {
    return this
  }

  eq(column, value) {
    this.queryConditions.push({ type: 'eq', column, value })
    return this
  }

  order(column, options = {}) {
    return this
  }

  limit(count) {
    this.queryConditions.push({ type: 'limit', value: count })
    return this
  }

  or(conditions) {
    this.queryConditions.push({ type: 'or', conditions })
    return this
  }

  single() {
    return this
  }

  insert(data) {
    this.method = 'INSERT'
    this.insertData = data
    return this
  }

  update(data) {
    this.method = 'UPDATE'
    this.updateData = data
    return this
  }

  upsert(data) {
    this.method = 'UPSERT'
    this.insertData = data
    return this
  }

  delete() {
    this.method = 'DELETE'
    return this
  }

  // 模拟异步查询执行
  then(callback) {
    setTimeout(() => {
      try {
        let result
        
        if (this.method === 'GET') {
          result = this.handleSelect()
        } else if (this.method === 'INSERT') {
          result = this.handleInsert()
        } else if (this.method === 'UPDATE') {
          result = this.handleUpdate()
        } else if (this.method === 'DELETE') {
          result = this.handleDelete()
        } else {
          result = { data: null, error: { message: 'Unknown method' } }
        }

        console.log(`模拟 ${this.method} 请求到 ${this.table}:`, result)
        callback(result)
      } catch (error) {
        callback({ data: null, error: { message: error.message } })
      }
    }, 300) // 模拟网络延迟
  }

  catch(callback) {
    return this.then((result) => {
      if (result.error) {
        callback(result.error)
      }
    })
  }

  handleSelect() {
    let filteredData = []

    // 根据表名选择数据源
    if (this.table === 'users') {
      filteredData = [...mockUsers]
      // 过滤活跃用户
      filteredData = filteredData.filter(user => user.status === 'active')
    } else if (this.table === 'travel_plans') {
      filteredData = [...mockTravelPlans]
    } else {
      // 其他表返回空数组
      filteredData = []
    }

    // 处理查询条件
    for (const condition of this.queryConditions) {
      if (condition.type === 'eq') {
        filteredData = filteredData.filter(item => 
          item[condition.column] === condition.value
        )
      } else if (condition.type === 'or') {
        // 处理 OR 条件，如 (username.eq.admin,email.eq.admin,phone.eq.admin)
        const orConditions = condition.conditions.split(',')
        filteredData = filteredData.filter(item => {
          return orConditions.some(orCond => {
            const [field, operator, value] = orCond.split('.')
            return item[field] === value
          })
        })
      } else if (condition.type === 'limit') {
        filteredData = filteredData.slice(0, condition.value)
      }
    }

    return { data: filteredData, error: null }
  }

  handleInsert() {
    let newRecord
    
    if (this.table === 'users') {
      newRecord = {
        ...this.insertData,
        id: mockUsers.length + 1,
        created_at: new Date().toISOString(),
        login_count: 0
      }
      mockUsers.push(newRecord)
    } else if (this.table === 'travel_plans') {
      newRecord = {
        ...this.insertData,
        id: mockTravelPlans.length + 1,
        created_at: new Date().toISOString()
      }
      mockTravelPlans.push(newRecord)
    } else {
      newRecord = { ...this.insertData, id: Date.now() }
    }
    
    return { data: newRecord, error: null }
  }

  handleUpdate() {
    // 先查询要更新的记录
    let targetRecord
    let targetArray
    
    if (this.table === 'users') {
      targetArray = mockUsers
      // 简化处理：更新第一个用户
      targetRecord = mockUsers[0]
    } else if (this.table === 'travel_plans') {
      targetArray = mockTravelPlans
      // 简化处理：更新第一个行程
      targetRecord = mockTravelPlans[0]
    } else {
      return { data: null, error: { message: 'Table not found' } }
    }
    
    if (!targetRecord) {
      return { data: null, error: { message: 'Record not found' } }
    }
    
    const updatedRecord = { ...targetRecord, ...this.updateData }
    if (this.table === 'users') {
      Object.assign(targetRecord, { ...updatedRecord, last_login: new Date().toISOString() })
    } else {
      Object.assign(targetRecord, updatedRecord)
    }
    
    return { data: updatedRecord, error: null }
  }

  handleDelete() {
    return { data: null, error: null }
  }
}

// 创建模拟 Supabase 客户端
const supabase = {
  from: (table) => {
    return new MockQueryBuilder(table)
  }
}

// 提供切换到真实数据的函数
supabase.switchToReal = () => {
  console.warn('请配置微信公众平台域名白名单后使用真实 Supabase')
  return require('./supabase').supabase
}

module.exports = { supabase }