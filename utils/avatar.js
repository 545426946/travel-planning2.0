// utils/avatar.js - 头像处理工具函数

const { supabase } = require('./supabase')
const { SUPABASE_CONFIG } = require('./config')

/**
 * 头像处理工具类
 */
class AvatarManager {
  /**
   * 生成默认头像URL
   * @param {string} name 用户名或昵称
   * @param {Object} options 头像选项
   * @returns {string} 默认头像URL
   */
  static generateDefaultAvatar(name = '用户', options = {}) {
    const {
      size = 128,
      background = '667eea',
      color = 'fff',
      bold = true,
      rounded = true
    } = options

    // 微信小程序不支持URLSearchParams，手动构建参数字符串
    const paramsArray = [
      `name=${encodeURIComponent(name || '用户')}`,
      `background=${encodeURIComponent(background)}`,
      `color=${encodeURIComponent(color)}`,
      `size=${encodeURIComponent(size.toString())}`,
      `bold=${encodeURIComponent(bold.toString())}`,
      `rounded=${encodeURIComponent(rounded.toString())}`
    ]

    return `https://ui-avatars.com/api/?${paramsArray.join('&')}`
  }

  /**
   * 上传头像到 Supabase Storage
   * @param {string} userId 用户ID
   * @param {string} filePath 本地文件路径或临时文件路径
   * @param {string} fileName 文件名
   * @returns {Promise<Object>} 上传结果
   */
  static async uploadAvatar(userId, filePath, fileName) {
    try {
      // 验证用户ID
      if (!userId) {
        throw new Error('用户ID不能为空')
      }

      // 生成唯一文件名
      const fileExt = fileName.split('.').pop()
      const uniqueFileName = `${userId}_${Date.now()}.${fileExt}`
      const storagePath = `${userId}/${uniqueFileName}`

      // 读取文件（微信小程序环境）
      let fileData
      if (typeof wx !== 'undefined') {
        // 微信小程序环境
        const fileInfo = wx.getFileSystemManager().readFileSync(filePath)
        fileData = fileInfo
      } else {
        // 其他环境，这里需要适配
        throw new Error('当前环境不支持文件上传')
      }

      // 通过 REST API 上传到 Supabase Storage
      const uploadUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/avatars/${storagePath}`
      const contentType = this.getMimeType(fileExt)
      const uploadResult = await new Promise((resolve) => {
        wx.request({
          url: uploadUrl,
          method: 'PUT',
          header: {
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
            'apikey': SUPABASE_CONFIG.anonKey,
            'Content-Type': contentType,
            'x-upsert': 'true'
          },
          data: fileData,
          responseType: 'arraybuffer',
          success: (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true })
            } else {
              resolve({ success: false, error: res.data })
            }
          },
          fail: (err) => resolve({ success: false, error: err })
        })
      })

      if (!uploadResult.success) {
        throw new Error('上传头像失败')
      }

      // 构建公共URL
      const publicUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/avatars/${storagePath}`

      // 更新用户头像信息
      const updateResult = await supabase
        .from('users')
        .update({
          avatar: storagePath,
          avatar_type: 'upload',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateResult.error) {
        throw new Error('更新用户头像信息失败：' + updateResult.error.message)
      }

      return {
        success: true,
        url: publicUrl,
        path: storagePath,
        message: '头像上传成功'
      }

    } catch (error) {
      console.error('头像上传失败:', error)
      return {
        success: false,
        error: error.message,
        message: '头像上传失败'
      }
    }
  }

  /**
   * 从相册选择并上传头像
   * @param {string} userId 用户ID
   * @returns {Promise<Object>} 上传结果
   */
  static async chooseAndUploadAvatar(userId) {
    return new Promise((resolve) => {
      if (typeof wx === 'undefined') {
        resolve({
          success: false,
          error: '当前环境不支持选择图片'
        })
        return
      }

      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'], // 压缩图片
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const tempFilePath = res.tempFilePaths[0]
          const fileName = tempFilePath.split('/').pop()

          try {
            const uploadResult = await this.uploadAvatar(userId, tempFilePath, fileName)
            resolve(uploadResult)
          } catch (error) {
            resolve({
              success: false,
              error: error.message
            })
          }
        },
        fail: (error) => {
          resolve({
            success: false,
            error: '选择图片失败：' + (error.errMsg || error.message)
          })
        }
      })
    })
  }

  /**
   * 设置微信头像
   * @param {string} userId 用户ID
   * @param {string} wechatAvatarUrl 微信头像URL
   * @returns {Promise<Object>} 设置结果
   */
  static async setWechatAvatar(userId, wechatAvatarUrl) {
    try {
      if (!userId) {
        throw new Error('用户ID不能为空')
      }

      if (!wechatAvatarUrl || wechatAvatarUrl.trim() === '') {
        throw new Error('微信头像URL不能为空')
      }

      // 验证微信头像URL
      if (!wechatAvatarUrl.startsWith('https://thirdwx.qlogo.cn/')) {
        console.warn('非标准微信头像URL:', wechatAvatarUrl)
      }

      const { data, error } = await supabase
        .from('users')
        .update({
          avatar: wechatAvatarUrl,
          avatar_type: 'wechat',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        throw new Error('设置微信头像失败：' + error.message)
      }

      return {
        success: true,
        data,
        message: '微信头像设置成功'
      }

    } catch (error) {
      console.error('设置微信头像失败:', error)
      return {
        success: false,
        error: error.message,
        message: '设置微信头像失败'
      }
    }
  }

  /**
   * 设置默认头像
   * @param {string} userId 用户ID
   * @param {string} name 用户名称
   * @returns {Promise<Object>} 设置结果
   */
  static async setDefaultAvatar(userId, name = '用户') {
    try {
      if (!userId) {
        throw new Error('用户ID不能为空')
      }

      const defaultAvatarUrl = this.generateDefaultAvatar(name)

      const { data, error } = await supabase
        .from('users')
        .update({
          avatar: defaultAvatarUrl,
          avatar_type: 'default',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        throw new Error('设置默认头像失败：' + error.message)
      }

      return {
        success: true,
        data,
        url: defaultAvatarUrl,
        message: '默认头像设置成功'
      }

    } catch (error) {
      console.error('设置默认头像失败:', error)
      return {
        success: false,
        error: error.message,
        message: '设置默认头像失败'
      }
    }
  }

  /**
   * 获取用户头像显示URL
   * @param {string|number} userId 用户ID
   * @param {Object} user 用户信息（可选，用于避免额外查询）
   * @returns {Promise<string>} 头像显示URL
   */
  static async getAvatarDisplayUrl(userId, user = null) {
    try {
      // 如果提供了用户信息，直接处理
      if (user) {
        return this.processAvatarUrl(user.avatar, user.avatar_type, user.name)
      }

      // 从数据库获取用户信息
      const { data, error } = await supabase
        .from('users')
        .select('avatar, avatar_type, name')
        .eq('id', userId)
        .single()

      if (error || !data) {
        console.warn('获取用户信息失败:', error)
        return this.generateDefaultAvatar()
      }

      return this.processAvatarUrl(data.avatar, data.avatar_type, data.name)

    } catch (error) {
      console.error('获取头像URL失败:', error)
      return this.generateDefaultAvatar()
    }
  }

  /**
   * 处理头像URL，确保返回可用的显示URL
   * @param {string} avatarUrl 原始头像URL
   * @param {string} avatarType 头像类型
   * @param {string} userName 用户名
   * @returns {string} 处理后的头像URL
   */
  static processAvatarUrl(avatarUrl, avatarType, userName = '用户') {
    // 如果没有头像URL或为空，返回默认头像
    if (!avatarUrl || avatarUrl.trim() === '') {
      return this.generateDefaultAvatar(userName)
    }

    // 微信头像特殊处理
    if (avatarType === 'wechat') {
      // 如果微信头像URL格式异常，返回默认头像
      if (!avatarUrl.startsWith('https://thirdwx.qlogo.cn/')) {
        console.warn('异常的微信头像URL:', avatarUrl)
        return this.generateDefaultAvatar(userName)
      }
      return avatarUrl
    }

    // 上传的头像，确保使用完整的Supabase Storage URL
    if (avatarType === 'upload') {
      if (avatarUrl.startsWith('https://')) {
        return avatarUrl
      } else {
        // 假设是相对路径，构建完整的URL
        const supabaseUrl = SUPABASE_CONFIG.url
        return `${supabaseUrl}/storage/v1/object/public/avatars/${avatarUrl}`
      }
    }

    // 默认头像
    if (avatarType === 'default') {
      return avatarUrl
    }

    // 其他情况，返回默认头像
    return this.generateDefaultAvatar(userName)
  }

  /**
   * 删除用户头像
   * @param {string|number} userId 用户ID
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteAvatar(userId) {
    try {
      if (!userId) {
        throw new Error('用户ID不能为空')
      }

      // 获取用户当前头像信息
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('avatar, avatar_type')
        .eq('id', userId)
        .single()

      if (userError || !user) {
        throw new Error('获取用户信息失败：' + (userError?.message || '用户不存在'))
      }

      // 如果是上传的头像，从存储中删除
      if (user.avatar_type === 'upload' && user.avatar) {
        const { error: deleteError } = await supabase.storage
          .from('avatars')
          .remove([user.avatar])

        if (deleteError) {
          console.warn('删除存储中的头像失败:', deleteError)
          // 继续执行，不阻断流程
        }
      }

      // 更新用户头像信息为默认头像
      const { error: updateError } = await supabase
        .from('users')
        .update({
          avatar: this.generateDefaultAvatar(user.name),
          avatar_type: 'default',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        throw new Error('更新用户头像信息失败：' + updateError.message)
      }

      return {
        success: true,
        message: '头像删除成功'
      }

    } catch (error) {
      console.error('删除头像失败:', error)
      return {
        success: false,
        error: error.message,
        message: '删除头像失败'
      }
    }
  }

  /**
   * 根据文件扩展名获取MIME类型
   * @param {string} ext 文件扩展名
   * @returns {string} MIME类型
   */
  static getMimeType(ext) {
    const extMap = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    }
    return extMap[ext.toLowerCase()] || 'image/jpeg'
  }

  /**
   * 压缩图片（简单实现，主要用于微信小程序）
   * @param {string} imagePath 图片路径
   * @param {Object} options 压缩选项
   * @returns {Promise<string>} 压缩后的图片路径
   */
  static async compressImage(imagePath, options = {}) {
    return new Promise((resolve, reject) => {
      if (typeof wx === 'undefined') {
        reject(new Error('当前环境不支持图片压缩'))
        return
      }

      const {
        quality = 80,
        width = 300,
        height = 300
      } = options

      wx.compressImage({
        src: imagePath,
        quality,
        success: (res) => {
          resolve(res.tempFilePath)
        },
        fail: (error) => {
          reject(new Error('图片压缩失败：' + (error.errMsg || error.message)))
        }
      })
    })
  }
}

module.exports = { AvatarManager }
