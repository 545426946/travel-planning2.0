# 微信登录功能说明 📱

## 📖 功能概述

本项目实现了完整的微信小程序登录功能，支持获取用户真实的微信信息（昵称、头像、性别、地区等），并自动创建或更新用户账号。

---

## ✨ 主要特性

### 1. 真实用户信息获取
- ✅ 微信昵称
- ✅ 微信头像
- ✅ 性别
- ✅ 城市、省份、国家

### 2. 智能账号管理
- ✅ 首次登录自动创建账号
- ✅ 再次登录自动识别用户
- ✅ 每次登录更新用户信息

### 3. 数据持久化
- ✅ 本地存储用户登录状态
- ✅ Supabase 云端数据库存储
- ✅ 支持 30 天免登录

### 4. 容错机制
- ✅ 即使数据库失败也能登录
- ✅ 详细的错误提示
- ✅ 完善的日志记录

---

## 🚀 快速开始

### 1. 在登录页面点击"微信登录"
```
pages/login/login
```

### 2. 点击"微信一键登录"按钮

### 3. 在弹出窗口中点击"允许"

### 4. 登录成功，自动跳转到首页

---

## 🔧 技术实现

### 登录流程

```
用户点击按钮
    ↓
调用 wx.login() 获取 code
    ↓
调用 wx.getUserProfile() 获取用户信息
    ↓
构建用户数据
    ↓
保存到数据库（可选）
    ↓
保存登录状态到本地
    ↓
跳转到首页
```

### 核心代码

```javascript
// 1. 获取微信登录 code
const loginRes = await wx.login()

// 2. 获取用户信息
const userInfoRes = await wx.getUserProfile({
  desc: '用于完善用户资料，提供更好的旅行规划服务'
})

// 3. 构建用户数据
const userData = {
  name: userInfoRes.userInfo.nickName,
  avatar: userInfoRes.userInfo.avatarUrl,
  gender: userInfoRes.userInfo.gender,
  city: userInfoRes.userInfo.city,
  province: userInfoRes.userInfo.province,
  country: userInfoRes.userInfo.country
}

// 4. 保存登录状态
Auth.saveUserLogin(userData, true)
```

---

## 📊 数据库结构

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| name | VARCHAR(255) | 用户昵称 |
| avatar | TEXT | 头像 URL |
| gender | INTEGER | 性别 (0-未知, 1-男, 2-女) |
| city | VARCHAR(100) | 城市 |
| province | VARCHAR(100) | 省份 |
| country | VARCHAR(100) | 国家 |
| login_type | VARCHAR(50) | 登录类型 (wechat) |
| created_at | TIMESTAMP | 创建时间 |
| last_login | TIMESTAMP | 最后登录时间 |

---

## 🎯 使用场景

### 场景1: 新用户首次登录
1. 用户打开小程序
2. 点击"微信一键登录"
3. 授权获取信息
4. 系统自动创建账号
5. 跳转到首页

### 场景2: 老用户再次登录
1. 用户打开小程序
2. 点击"微信一键登录"
3. 授权获取信息
4. 系统识别用户并更新信息
5. 跳转到首页

### 场景3: 用户拒绝授权
1. 用户点击"拒绝"
2. 显示友好提示
3. 用户可以重新授权

---

## ⚠️ 注意事项

### 1. 基础库版本要求
- **最低版本**: 2.10.4
- **推荐版本**: 2.19.4 或更高

### 2. getUserProfile 限制
- ✅ 必须通过 `<button>` 组件触发
- ✅ 必须在用户点击后调用
- ❌ 不能在页面加载时自动调用
- ❌ 不能在定时器中调用

### 3. openid 说明
- 当前使用模拟 openid（演示版）
- 生产环境需要后端服务获取真实 openid
- 参考: [微信登录使用说明.md](./微信登录使用说明.md)

---

## 🔍 调试指南

### 开启调试日志
登录过程中会输出详细日志：

```
=== 开始微信登录流程 ===
✅ wx.login 成功, code: 071xxxxx
✅ 获取用户信息成功: {nickName: "张三"}
✅ 用户数据构建完成: {...}
📝 尝试保存用户信息到数据库...
✅ 新用户创建成功, ID: 123
✅ 登录用户信息: {...}
✅ 登录状态已保存
🏠 跳转到首页
```

### 常见错误

#### 错误1: getUserProfile:fail auth deny
**原因**: 用户点击了"拒绝"  
**解决**: 引导用户重新授权

#### 错误2: login:fail
**原因**: 网络问题或 AppID 配置错误  
**解决**: 检查网络和配置

#### 错误3: 数据库保存失败
**原因**: Supabase 配置问题  
**影响**: 不影响登录，但数据不会保存  
**解决**: 检查 Supabase 配置

详细排查指南请查看: [微信登录故障排查指南.md](./微信登录故障排查指南.md)

---

## 📚 相关文档

- [微信登录使用说明.md](./微信登录使用说明.md) - 详细的功能说明和技术文档
- [微信登录故障排查指南.md](./微信登录故障排查指南.md) - 常见问题和解决方案
- [微信登录测试手册.md](./微信登录测试手册.md) - 完整的测试流程和验收标准

---

## 🛠️ 配置文件

### project.config.json
```json
{
  "appid": "wxb9ca37c30f43d5b8",
  "libVersion": "2.19.4"
}
```

### utils/config.js
```javascript
export const SUPABASE_URL = 'https://hmnjuntvubqvbpeyqoxw.supabase.co'
export const SUPABASE_ANON_KEY = 'your-anon-key'
```

---

## 🎨 界面展示

### 登录页面
- 简洁的登录界面
- 微信登录按钮
- 账号密码登录选项

### 首页
- 顶部显示用户头像和昵称
- 点击头像可以查看个人信息

### 个人页
- 完整的用户信息展示
- 统计数据
- 退出登录按钮

---

## 📈 未来优化

### 1. 后端服务
- [ ] 搭建后端 API
- [ ] 获取真实 openid
- [ ] 会话管理
- [ ] 安全性增强

### 2. 功能增强
- [ ] 手机号授权
- [ ] 实名认证
- [ ] 第三方登录
- [ ] 多设备同步

### 3. 用户体验
- [ ] 授权说明优化
- [ ] 登录动画
- [ ] 错误提示优化
- [ ] 离线模式

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交 Issue
1. 描述问题
2. 提供复现步骤
3. 附上错误日志
4. 截图（如有）

### 提交 PR
1. Fork 项目
2. 创建分支
3. 提交代码
4. 发起 PR

---

## 📞 联系我们

- GitHub: https://github.com/545426946/travel-planning2.0
- Issues: https://github.com/545426946/travel-planning2.0/issues

---

## 📄 许可证

MIT License

---

## 🎉 更新日志

### v2.1.0 (2024-11-21)
- ✅ 实现真实微信用户信息获取
- ✅ 优化登录流程
- ✅ 改进错误处理
- ✅ 增强容错机制
- ✅ 添加详细日志

### v2.0.0 (2024-11-20)
- ✅ 基础微信登录功能
- ✅ 数据库集成
- ✅ 用户状态管理

---

**感谢使用！如有问题，请查看故障排查指南或提交 Issue。** 🙏
