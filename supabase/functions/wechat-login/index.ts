import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 开发模式标识
const DEV_MODE = Deno.env.get('DEV_MODE') === 'true';

serve(async (req) => {
  console.log('===========================================')
  console.log('🚀 Edge Function 收到请求')
  console.log('请求方法:', req.method)
  console.log('请求时间:', new Date().toISOString())
  console.log('===========================================')

  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    console.log('✅ 处理 OPTIONS 请求')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 从环境变量获取配置
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const wechatAppId = Deno.env.get('WECHAT_APP_ID')
    const wechatAppSecret = Deno.env.get('WECHAT_APP_SECRET')

    console.log('环境变量检查:')
    console.log('- SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌')
    console.log('- WECHAT_APP_ID:', wechatAppId ? '✅' : '❌')
    console.log('- WECHAT_APP_SECRET:', wechatAppSecret ? '✅' : '❌')

    // 检查必需的环境变量
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ 缺少必需的 Supabase 环境变量')
      return new Response(
        JSON.stringify({
          success: false,
          error: '服务器配置错误',
          details: {
            hasSupabaseUrl: !!supabaseUrl,
            hasServiceKey: !!supabaseServiceKey,
            hasWechatAppId: !!wechatAppId,
            hasWechatSecret: !!wechatAppSecret
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // 开发环境下允许缺少微信配置
    if (!DEV_MODE && (!wechatAppId || !wechatAppSecret)) {
      console.error('❌ 缺少必需的微信环境变量')
      return new Response(
        JSON.stringify({
          success: false,
          error: '服务器配置错误',
          details: {
            hasSupabaseUrl: !!supabaseUrl,
            hasServiceKey: !!supabaseServiceKey,
            hasWechatAppId: !!wechatAppId,
            hasWechatSecret: !!wechatAppSecret
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log('✅ 所有必需环境变量已设置')

    // 创建 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('✅ Supabase 客户端创建成功')

    // 解析请求体
    console.log('📝 解析请求体...')
    const requestBody = await req.json().catch(err => {
      console.error('❌ 解析请求体失败:', err)
      throw new Error('请求格式错误，无法解析 JSON 数据')
    })
    
    console.log('✅ 请求体解析成功')
    console.log('请求体内容:', {
      hasCode: !!requestBody.code,
      hasUserInfo: !!requestBody.userInfo,
      userInfoKeys: requestBody.userInfo ? Object.keys(requestBody.userInfo) : []
    })

    const { code, userInfo: requestUserInfo } = requestBody
    
    if (!code) {
      console.error('❌ 缺少微信登录凭证 code')
      throw new Error('缺少微信登录凭证 code')
    }

    console.log('📲 收到微信登录 code:', code.substring(0, 10) + '...')

    // 调用微信接口获取 session_key 和 openid
    let wxData
    
    // 开发环境下使用模拟数据
    if (DEV_MODE) {
      console.log('🔧 开发模式: 使用模拟微信登录数据')
      wxData = {
        openid: `mock_openid_${Math.random().toString(36).substr(2, 9)}`,
        session_key: `mock_session_key_${Math.random().toString(36).substr(2, 9)}`,
        unionid: `mock_unionid_${Math.random().toString(36).substr(2, 9)}`
      }
      console.log('📨 模拟微信 API 响应:', wxData)
    } else {
      const wxApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${wechatAppId}&secret=${wechatAppSecret}&js_code=${code}&grant_type=authorization_code`
      
      console.log('🌐 调用微信 API 获取 session_key 和 openid...')
      console.log('微信 API URL:', wxApiUrl.substring(0, 50) + '...')
      
      let wxResponse
      try {
        // 使用 AbortController 实现超时
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时
        
        wxResponse = await fetch(wxApiUrl, {
          method: 'GET',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId) // 清除超时定时器
        console.log('✅ 微信 API 请求成功，状态码:', wxResponse.status)
        
        wxData = await wxResponse.json()
        console.log('📨 微信 API 响应:', wxData)
      } catch (wxError) {
        console.error('❌ 微信 API 调用失败:', wxError)
        if (wxError.name === 'AbortError') {
          throw new Error('微信服务器连接超时，请稍后重试')
        } else {
          throw new Error(`微信服务器连接失败: ${wxError.message}`)
        }
      }

      if (wxData.errcode) {
        console.error('❌ 微信认证失败:', {
          errcode: wxData.errcode,
          errmsg: wxData.errmsg,
          appid: wechatAppId
        })
        throw new Error(`微信认证失败: ${wxData.errmsg} (${wxData.errcode})`)
      }
    }

    const { openid, session_key } = wxData

    if (!openid) {
      console.error('❌ 无法获取用户 openid:', wxData)
      throw new Error('微信认证失败：无法获取用户标识')
    }

    console.log('✅ 微信认证成功，获取到 openid:', openid.substring(0, 8) + '...')
    console.log('✅ 获取到 session_key:', session_key ? '✅' : '❌')

    // 生成自定义 token
    const timestamp = Date.now()
    const randomPart = Math.random().toString(36).substring(2, 9)
    const token = `wt_${timestamp}_${openid.substring(0, 8)}_${randomPart}`
    console.log('🔑 生成自定义 token:', token.substring(0, 20) + '...')

    // 查询或创建用户
    console.log('🔍 查询或创建用户记录...')
    const { data: existingUser, error: fetchError } = await supabase
      .from('app_users')
      .select('*')
      .eq('openid', openid)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        console.log('📝 用户不存在，需要创建新用户')
      } else {
        console.error('❌ 查询用户失败:', fetchError)
        throw new Error(`查询用户信息失败: ${fetchError.message}`)
      }
    } else {
      console.log('✅ 找到现有用户，ID:', existingUser.id)
    }

    let finalUserInfo
    
    if (existingUser) {
      // 更新最后登录时间
      console.log('🔄 更新用户登录信息...')
      const { error: updateError } = await supabase
        .from('app_users')
        .update({
          last_login_time: new Date().toISOString()
        })
        .eq('openid', openid)

      if (updateError) {
        console.error('❌ 更新用户登录时间失败:', updateError)
        // 不中断流程，继续返回用户信息
      } else {
        console.log('✅ 用户登录信息更新成功')
      }

      finalUserInfo = {
        id: existingUser.id,
        openid: existingUser.openid,
        name: existingUser.name,
        avatar: existingUser.avatar,
        gender: existingUser.gender,
        city: existingUser.city,
        province: existingUser.province,
        country: existingUser.country,
        loginType: 'wechat',
        hasRealInfo: existingUser.has_real_info
      }
    } else {
      // 创建新用户记录 - 使用传入的用户信息
      console.log('👤 创建新用户记录...')
      
      // 准备用户信息
      const nickname = (requestUserInfo && requestUserInfo.nickName) 
        ? requestUserInfo.nickName 
        : `微信用户_${Math.floor(Math.random() * 10000)}`
      const avatar = (requestUserInfo && requestUserInfo.avatarUrl) 
        ? requestUserInfo.avatarUrl 
        : 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUl24cLiaEwdBbCHnElQzBf0x9Yc2icJ0Y9nSKhEXQnGHVicHjaNQ6GoAhjibcPA/132'
      
      console.log('新用户信息:')
      console.log('- 昵称:', nickname)
      console.log('- 头像:', avatar.substring(0, 30) + '...')
      console.log('- 性别:', (requestUserInfo && requestUserInfo.gender) || 0)
      console.log('- 城市:', (requestUserInfo && requestUserInfo.city) || '')
      
      const newUser = {
        openid: openid,
        name: nickname,
        avatar: avatar,
        gender: (requestUserInfo && requestUserInfo.gender) ? requestUserInfo.gender : 0,
        city: (requestUserInfo && requestUserInfo.city) ? requestUserInfo.city : '',
        province: (requestUserInfo && requestUserInfo.province) ? requestUserInfo.province : '',
        country: (requestUserInfo && requestUserInfo.country) ? requestUserInfo.country : '',
        login_type: 'wechat',
        has_real_info: !!(requestUserInfo && requestUserInfo.nickName && requestUserInfo.nickName !== '微信用户'),
        created_at: new Date().toISOString(),
        last_login_time: new Date().toISOString()
      }

      const { data: createdUser, error: createError } = await supabase
        .from('app_users')
        .insert(newUser)
        .select()
        .single()

      if (createError) {
        console.error('❌ 创建用户失败:', createError)
        throw new Error(`用户创建失败: ${createError.message}`)
      }

      console.log('✅ 新用户创建成功，ID:', createdUser.id)

      finalUserInfo = {
        id: createdUser.id,
        openid: createdUser.openid,
        name: createdUser.name,
        avatar: createdUser.avatar,
        gender: createdUser.gender,
        city: createdUser.city,
        province: createdUser.province,
        country: createdUser.country,
        loginType: 'wechat',
        hasRealInfo: createdUser.has_real_info
      }
    }

    console.log('✅ 用户处理完成')
    console.log('最终用户信息:', {
      id: finalUserInfo.id,
      openid: finalUserInfo.openid,
      name: finalUserInfo.name
    })

    // 创建或更新用户会话记录
    console.log('🔄 创建用户会话记录...')
    const sessionData = {
      user_id: finalUserInfo.id,
      openid: openid,
      session_key: session_key,
      token: token,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天过期
      created_at: new Date().toISOString(),
      is_active: true
    }

    // 先禁用该用户的所有旧会话
    const { error: deactivateOldSessionsError } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('openid', openid)

    if (deactivateOldSessionsError) {
      console.error('❌ 禁用旧会话失败:', deactivateOldSessionsError)
      // 不中断流程，继续创建新会话
    } else {
      console.log('✅ 旧会话已禁用')
    }

    // 创建新会话
    const { data: sessionRecord, error: sessionError } = await supabase
      .from('user_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) {
      console.error('❌ 创建会话失败:', sessionError)
      throw new Error(`创建用户会话失败: ${sessionError.message}`)
    }

    console.log('✅ 用户会话创建成功，ID:', sessionRecord.id)

    // 返回成功响应
    const successResponse = {
      success: true,
      token: token,
      userInfo: finalUserInfo,
      message: '登录成功',
      timestamp: new Date().toISOString()
    }
    
    console.log('📤 返回成功响应')
    console.log('===========================================')

    return new Response(
      JSON.stringify(successResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Edge Function 错误:')
    console.error('- 错误类型:', error.name)
    console.error('- 错误信息:', error.message)
    console.error('- 堆栈跟踪:', error.stack)
    console.log('===========================================')
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '服务器内部错误',
        timestamp: new Date().toISOString(),
        requestId: Math.random().toString(36).substring(2, 10)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // 使用500表示服务器错误，400表示客户端错误
      }
    )
  }
})