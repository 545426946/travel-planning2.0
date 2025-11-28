// utils/database.js
const supabase = require('./supabase').supabase
const Auth = require('./auth').Auth

// 数据库操作封装（带权限验证）
const db = {
  // 用户相关操作
  users: {
    // 根据openid获取用户
    getByOpenid(openid) {
      return supabase
        .from('users')
        .select('*')
        .eq('openid', openid)
        .single()
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    },

    // 创建或更新用户
    upsert(userData) {
      return supabase
        .from('users')
        .upsert(userData)
        .select()
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    }
  },

  // 行程相关操作
  travelPlans: {
    // 获取用户的行程（自动验证权限）
    getByUserId(userId, status = 'planned', limit = null) {
      // 权限验证：只能查询当前登录用户的数据
      const currentUserId = Auth.getCurrentUserId()
      if (!currentUserId || String(currentUserId) !== String(userId)) {
        console.warn('权限验证失败：无法访问其他用户的行程数据')
        return Promise.resolve({ data: [], error: { message: '无权访问' } })
      }

      let query = supabase
        .from('travel_plans')
        .select('*')
        .eq('user_id', userId)
      
      if (status) {
        query = query.eq('status', status)
      }
      
      query = query.order('created_at', { ascending: false })
      
      if (limit) {
        query = query.limit(limit)
      }
      
      return query
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    },

    // 根据ID获取行程（自动验证权限）
    getById(id) {
      return supabase
        .from('travel_plans')
        .select('*')
        .eq('id', id)
        .single()
        .then((result) => {
          // 权限验证
          if (result.data && !Auth.canAccess(result.data.user_id)) {
            console.warn('权限验证失败：无法访问其他用户的行程')
            return { data: null, error: { message: '无权访问' } }
          }
          return { data: result.data, error: result.error }
        })
        .catch(error => ({ data: null, error }))
    },

    // 创建新行程（自动添加用户ID并处理重复）
    async create(planData) {
      const userId = Auth.getCurrentUserId()
      if (!userId) {
        console.warn('创建行程失败：用户未登录')
        return { data: null, error: { message: '用户未登录' } }
      }

      const safePlanData = { ...planData, user_id: userId }

      // 尝试插入
      const { data, error } = await supabase
        .from('travel_plans')
        .insert(safePlanData)
        .select()
        .single()

      // 如果是重复键错误
      if (error && (error.code === '23505' || error.status === 409)) {
        console.log('捕获到重复键错误，正在查询已存在的行程...')
        const existing = await supabase
          .from('travel_plans')
          .select('*')
          .eq('user_id', userId)
          .eq('title', safePlanData.title)
          .eq('destination', safePlanData.destination)
          .eq('start_date', safePlanData.start_date)
          .eq('end_date', safePlanData.end_date)
          .eq('travelers_count', safePlanData.travelers_count)
          .single()

        if (existing.data) {
          console.log('找到已存在的行程:', existing.data.id)
          return { data: existing.data, error: null, isExisting: true }
        } else {
          console.error('查询重复行程失败:', existing.error)
          return { data: null, error: existing.error || error, isExisting: true }
        }
      }

      // 其他错误
      if (error) {
        console.error('数据库创建失败:', error)
        return { data: null, error }
      }

      // 成功
      return { data, error: null }
    },

    // 更新行程（自动验证权限）
    update(id, updateData) {
      return this.getById(id).then((result) => {
        if (result.error || !result.data) {
          return { data: null, error: result.error || { message: '行程不存在' } }
        }

        // 已通过getById的权限验证，可以继续更新
        // 确保不能修改user_id
        const safeUpdateData = { ...updateData }
        delete safeUpdateData.user_id

        return supabase
          .from('travel_plans')
          .update(safeUpdateData)
          .eq('id', id)
          .select()
          .then((updateResult) => ({ data: updateResult.data?.[0], error: updateResult.error }))
          .catch(error => ({ data: null, error }))
      })
    },

    // 删除行程（自动验证权限）
    delete(id) {
      return this.getById(id).then((result) => {
        if (result.error || !result.data) {
          return { data: null, error: result.error || { message: '行程不存在' } }
        }

        // 已通过getById的权限验证，可以继续删除
        return supabase
          .from('travel_plans')
          .delete()
          .eq('id', id)
          .then((deleteResult) => ({ data: deleteResult.data, error: deleteResult.error }))
          .catch(error => ({ data: null, error }))
      })
    }
  },

  // 用户偏好设置
  userPreferences: {
    // 根据用户ID获取偏好（自动验证权限）
    getByUserId(userId) {
      // 权限验证
      const currentUserId = Auth.getCurrentUserId()
      if (!currentUserId || String(currentUserId) !== String(userId)) {
        console.warn('权限验证失败：无法访问其他用户的偏好设置')
        return Promise.resolve({ data: null, error: { message: '无权访问' } })
      }

      return supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    },

    // 创建或更新用户偏好（自动添加用户ID）
    upsert(preferencesData) {
      const userId = Auth.getCurrentUserId()
      if (!userId) {
        return Promise.resolve({ data: null, error: { message: '用户未登录' } })
      }

      // 强制设置为当前用户ID
      const safePreferencesData = {
        ...preferencesData,
        user_id: userId
      }

      return supabase
        .from('user_preferences')
        .upsert(safePreferencesData)
        .select()
        .then((result) => ({ data: result.data?.[0], error: result.error }))
        .catch(error => ({ data: null, error }))
    }
  },

  // 收藏相关操作
  favorites: {
    // 获取用户收藏（自动验证权限）
    getUserFavorites(userId, type = null) {
      // 权限验证
      const currentUserId = Auth.getCurrentUserId()
      if (!currentUserId || String(currentUserId) !== String(userId)) {
        console.warn('权限验证失败：无法访问其他用户的收藏')
        return Promise.resolve({ data: [], error: { message: '无权访问' } })
      }

      let query = supabase
        .from('favorites')
        .select('*')
        .eq('user_id', userId)
      
      if (type) {
        query = query.eq('item_type', type)
      }
      
      return query
        .order('created_at', { ascending: false })
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    },

    // 添加收藏（自动添加用户ID）
    add(favoriteData) {
      const userId = Auth.getCurrentUserId()
      if (!userId) {
        return Promise.resolve({ data: null, error: { message: '用户未登录' } })
      }

      // 强制设置为当前用户ID
      const safeFavoriteData = {
        ...favoriteData,
        user_id: userId
      }

      return supabase
        .from('favorites')
        .insert(safeFavoriteData)
        .select()
        .then((result) => ({ data: result.data?.[0], error: result.error }))
        .catch(error => ({ data: null, error }))
    },

    // 删除收藏（自动验证权限）
    remove(userId, itemId, itemType) {
      // 权限验证
      const currentUserId = Auth.getCurrentUserId()
      if (!currentUserId || String(currentUserId) !== String(userId)) {
        console.warn('权限验证失败：无法删除其他用户的收藏')
        return Promise.resolve({ data: null, error: { message: '无权访问' } })
      }

      return supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .eq('item_type', itemType)
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    }
  },

  // 问答对相关操作
  qaPairs: {
    // 创建问答记录（自动添加用户ID）
    create(qaData) {
      const userId = Auth.getCurrentUserId()
      if (!userId) {
        return Promise.resolve({ data: null, error: { message: '用户未登录' } })
      }

      // 强制设置为当前用户ID
      const safeQaData = {
        ...qaData,
        user_id: userId
      }

      return supabase
        .from('qa_pairs')
        .insert(safeQaData)
        .select()
        .then((result) => ({ data: result.data?.[0], error: result.error }))
        .catch(error => ({ data: null, error }))
    },

    // 获取用户的问答历史（自动验证权限）
    getUserHistory(userId, limit = 20) {
      // 权限验证
      const currentUserId = Auth.getCurrentUserId()
      if (!currentUserId || String(currentUserId) !== String(userId)) {
        console.warn('权限验证失败：无法访问其他用户的问答历史')
        return Promise.resolve({ data: [], error: { message: '无权访问' } })
      }

      return supabase
        .from('qa_pairs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    }
  },

  // 景点相关操作
  destinations: {
    // 获取热门景点
    getFeatured(limit = 10) {
      return supabase
        .from('destinations')
        .select('*')
        .eq('is_featured', true)
        .order('rating', { ascending: false })
        .limit(limit)
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    },

    // 搜索景点
    search(keyword, category = null) {
      let query = supabase
        .from('destinations')
        .select('*')
        .or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
      
      if (category) {
        query = query.eq('category', category)
      }
      
      return query.order('rating', { ascending: false })
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    },

    // 根据分类获取景点
    getByCategory(category, limit = 20) {
      return supabase
        .from('destinations')
        .select('*')
        .eq('category', category)
        .order('rating', { ascending: false })
        .limit(limit)
        .then((result) => ({ data: result.data, error: result.error }))
        .catch(error => ({ data: null, error }))
    }
  }
}

module.exports = { db }