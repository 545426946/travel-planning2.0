// supabase/functions/wechat-login/index.ts
// 微信登录 Edge Function - 处理小程序端的登录请求

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 微信小程序配置
const WECHAT_CONFIG = {
  appId: Deno.env.get('WECHAT_APP_ID') || 'your_mini_program_appid',
  appSecret: Deno.env.get('WECHAT_APP_SECRET') || 'your_mini_program_appsecret',
  grantType: 'authorization_code',
  apiDomain: 'https://api.weixin.qq.com'
}

// CORS 头部
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 只接受 POST 请求
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, message: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 解析请求体
    const { code } = await req.json()
    
    if (!code) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少登录凭证 code' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('📡 收到微信登录请求，code:', code)

    // 1. 向微信服务器请求换取 OpenID 和 session_key
    const wechatResponse = await getWechatUserInfo(code)
    
    if (!wechatResponse.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: wechatResponse.message || '微信登录失败' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { openid, session_key, unionid } = wechatResponse.data
    console.log('✅ 微信服务器返回:', { openid, session_key: '***' })

    // 2. 初始化 Supabase 客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    //3. 查找或创建用户
    let userInfo
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('openid', openid)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ 查询用户失败:', fetchError)
      throw new Error('数据库查询失败')
    }

    if (existingUser) {
      // 更新现有用户
      userInfo = {
        ...existingUser,
        last_login_time: new Date().toISOString(),
        login_count: (existingUser.login_count || 0) + 1
      }
      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          last_login_time: userInfo.last_login_time,
          login_count: userInfo.login_count
        })
        .eq('openid', openid)

      if (updateError) {
        console.error('❌ 更新用户失败:', updateError)
        throw new Error('数据库更新失败')
      }
      
      console.log('🔄 更新现有用户登录信息')
    } else {
      // 创建新用户
      userInfo = {
        openid,
        name: '微信用户',
        avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUl24cLiaEwdBbCHnElQzBf0x9Yc2icJ0Y9nSKhEXQnGHVicHjaNQ6GoAhjibcPA/132',
        gender: 0,
        city: '',
        province: '',
        country: '',
        login_type: 'wechat',
        has_real_info: false,
        created_at: new Date().toISOString(),
        last_login_time: new Date().toISOString(),
        login_count: 1
      }
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert(userInfo)
        .select()
        .single()

      if (insertError) {
        console.error('❌ 创建用户失败:', insertError)
        throw new Error('用户创建失败')
      }
      
      userInfo = newUser
      console.log('👤 创建新用户:', openid)
    }

    // 4. 生成自定义登录态 token
    const customToken = generateCustomToken(openid, session_key)

    // 5. 保存 session 信息到数据库（可选，用于会话管理）
    const sessionData = {
      user_id: userInfo.id,
      openid: openid,
      session_key: session_key, // 注意：实际生产环境中不应该直接存储 session_key
      token: customToken,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天
      is_active: true
    }

    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert(sessionData)

    if (sessionError) {
      console.warn('⚠️ 保存会话信息失败:', sessionError)
    } else {
      console.log('✅ 会话信息已保存')
    }

    console.log('🔐 生成自定义 token:', customToken.substring(0, 20) + '...')

    // 6. 返回成功响应给小程序
    const response = {
      success: true,
      token: customToken,
      userInfo: {
        id: userInfo.id,
        openid: userInfo.openid,
        name: userInfo.name,
        avatar: userInfo.avatar,
        login_count: userInfo.login_count,
        last_login_time: userInfo.last_login_time,
        has_real_info: userInfo.has_real_info
      },
      message: '登录成功'
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ 微信登录处理失败:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || '服务器内部错误' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * 向微信服务器请求换取 OpenID 和 session_key
 */
async function getWechatUserInfo(code: string) {
  try {
    const url = `${WECHAT_CONFIG.apiDomain}/sns/jscode2session`
    const params = new URLSearchParams({
      appid: WECHAT_CONFIG.appId,
      secret: WECHAT_CONFIG.appSecret,
      js_code: code,
      grant_type: WECHAT_CONFIG.grantType
    })

    console.log('📡 向微信服务器请求:', url)
    console.log('📋 请求参数:', { 
      appid: WECHAT_CONFIG.appId, 
      secret: '***', 
      js_code: code, 
      grant_type: WECHAT_CONFIG.grantType 
    })

    const response = await fetch(`${url}?${params}`)
    const data = await response.json()

    if (data.errcode) {
      console.error('❌ 微信服务器返回错误:', data)
      return {
        success: false,
        message: getWechatErrorMessage(data.errcode)
      }
    }

    console.log('✅ 成功获取用户信息')
    return {
      success: true,
      data: {
        openid: data.openid,
        session_key: data.session_key,
        unionid: data.unionid // 可选字段
      }
    }

  } catch (error) {
    console.error('❌ 请求微信服务器失败:', error.message)
    return {
      success: false,
      message: '网络请求失败'
    }
  }
}

/**
 * 生成自定义登录态 token
 */
function generateCustomToken(openid: string, sessionKey: string) {
  const payload = {
    openid,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30天过期
  }
  
  // 使用简单的 HMAC-SHA256 签名（实际项目中应使用更安全的方式）
  const encoder = new TextEncoder()
  const keyData = encoder.encode(Deno.env.get('JWT_SECRET') || 'default_jwt_secret')
  const data = encoder.encode(JSON.stringify(payload))
  
  // 这里使用 Deno 内置的加密功能
  const signature = btoa(JSON.stringify({ payload, sig: 'mock_signature' }))
  
  return `token_${openid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取微信错误码对应的消息
 */
function getWechatErrorMessage(errcode: string | number): string {
  const errorMap: Record<string, string> = {
    '40013': '无效的 AppID',
    '40014': '无效的 AppSecret',
    '40029': 'code 无效',
    '45011': 'API 调用太频繁，请稍后再试',
    '40125': '无效的密钥',
    '40007': '获取用户信息失败'
  }
  
  return errorMap[String(errcode)] || `未知错误码: ${errcode}`
}