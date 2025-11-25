import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 从环境变量获取配置
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const wechatAppId = Deno.env.get('WECHAT_APP_ID')
    const wechatAppSecret = Deno.env.get('WECHAT_APP_SECRET')

    // 检查必需的环境变量
    if (!supabaseUrl || !supabaseServiceKey || !wechatAppId || !wechatAppSecret) {
      console.error('缺少必需的环境变量')
      return new Response(
        JSON.stringify({
          success: false,
          error: '服务器配置错误'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log('环境变量检查: ✅ 所有必需变量已设置')

    // 创建 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 解析请求体
    const { code, userInfo } = await req.json()
    
    if (!code) {
      throw new Error('缺少微信登录凭证 code')
    }

    console.log('收到微信登录 code:', code.substring(0, 10) + '...')

    // 调用微信接口获取 session_key 和 openid
    const wxApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${wechatAppId}&secret=${wechatAppSecret}&js_code=${code}&grant_type=authorization_code`
    
    console.log('调用微信 API...')
    
    const wxResponse = await fetch(wxApiUrl)
    const wxData = await wxResponse.json()

    console.log('微信 API 响应:', {
      openid: wxData.openid ? '✅' : '❌',
      session_key: wxData.session_key ? '✅' : '❌',
      errcode: wxData.errcode || '无',
      errmsg: wxData.errmsg || '无'
    })

    if (wxData.errcode) {
      console.error('微信认证失败:', {
        errcode: wxData.errcode,
        errmsg: wxData.errmsg,
        appid: wechatAppId
      })
      throw new Error(`微信认证失败: ${wxData.errmsg} (${wxData.errcode})`)
    }

    const { openid, session_key } = wxData

    if (!openid) {
      throw new Error('微信认证失败：无法获取用户标识')
    }

    // 生成自定义 token
    const timestamp = Date.now()
    const randomPart = Math.random().toString(36).substring(2, 9)
    const token = `wt_${timestamp}_${openid.substring(0, 8)}_${randomPart}`

    // 查询或创建用户
    const { data: existingUser, error: fetchError } = await supabase
      .from('app_users')
      .select('*')
      .eq('openid', openid)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('查询用户失败:', fetchError)
    }

    let userInfo
    
    if (existingUser) {
      // 更新最后登录时间
      const { error: updateError } = await supabase
        .from('app_users')
        .update({
          last_login_time: new Date().toISOString(),
          session_key: session_key
        })
        .eq('openid', openid)

      if (updateError) {
        console.error('更新用户登录时间失败:', updateError)
      }

      userInfo = {
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
      const newUser = {
        openid: openid,
        name: (userInfo && userInfo.nickName) ? userInfo.nickName : `微信用户_${Math.floor(Math.random() * 10000)}`,
        avatar: (userInfo && userInfo.avatarUrl) ? userInfo.avatarUrl : 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUl24cLiaEwdBbCHnElQzBf0x9Yc2icJ0Y9nSKhEXQnGHVicHjaNQ6GoAhjibcPA/132',
        gender: (userInfo && userInfo.gender) ? userInfo.gender : 0,
        city: (userInfo && userInfo.city) ? userInfo.city : '',
        province: (userInfo && userInfo.province) ? userInfo.province : '',
        country: (userInfo && userInfo.country) ? userInfo.country : '',
        login_type: 'wechat',
        has_real_info: !!(userInfo && userInfo.nickName && userInfo.nickName !== '微信用户'),
        session_key: session_key,
        created_at: new Date().toISOString(),
        last_login_time: new Date().toISOString()
      }

      const { data: createdUser, error: createError } = await supabase
        .from('app_users')
        .insert(newUser)
        .select()
        .single()

      if (createError) {
        console.error('创建用户失败:', createError)
        throw new Error('用户创建失败，请稍后重试')
      }

      userInfo = {
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

    console.log('用户处理完成:', {
      id: userInfo.id,
      openid: userInfo.openid,
      name: userInfo.name
    })

    return new Response(
      JSON.stringify({
        success: true,
        token: token,
        userInfo: userInfo,
        message: '登录成功'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Edge Function 错误:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '服务器内部错误'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})