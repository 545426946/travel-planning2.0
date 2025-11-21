# 🌍 AI Travel - 智能旅游规划小程序

一款基于微信小程序的智能旅游规划助手，集成 AI 技术，为用户提供个性化的旅行规划服务。

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![WeChat](https://img.shields.io/badge/WeChat-MiniProgram-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

## ✨ 功能特性

### 🎯 核心功能

- **🤖 AI 智能规划** - 基于用户需求智能生成旅行计划
- **💬 AI 旅行助手** - 24/7 在线智能客服，解答旅行疑问
- **📋 行程管理** - 创建、查看、编辑和分享旅行计划
- **📍 景点推荐** - 智能推荐热门景点和隐藏宝藏
- **🗺️ 路线规划** - 优化旅行路线，节省时间和成本

### 👤 用户功能

- **微信一键登录** - 支持微信授权登录
- **个人中心** - 管理个人信息和旅行记录
- **收藏功能** - 收藏喜欢的景点和行程
- **分享功能** - 分享旅行计划给好友

### 🎨 界面设计

- **现代化 UI** - 精美的界面设计
- **流畅动画** - 丰富的交互动画效果
- **响应式布局** - 适配各种屏幕尺寸
- **主题定制** - 渐变色主题，视觉体验佳

## 🛠️ 技术栈

### 前端技术

- **框架**: 微信小程序原生框架
- **样式**: WXSS (支持 CSS3)
- **脚本**: JavaScript (ES6+)
- **构建**: 微信开发者工具

### 后端服务

- **数据库**: Supabase (PostgreSQL)
- **认证**: 微信开放平台
- **存储**: 云存储服务

### 开发工具

- **IDE**: 微信开发者工具
- **版本控制**: Git
- **代码规范**: ESLint

## 📦 项目结构

```
travel-planning2.0/
├── pages/                      # 页面目录
│   ├── index/                 # 首页
│   ├── login/                 # 登录页
│   ├── register/              # 注册页
│   ├── ai-plan/              # AI 规划页
│   ├── ai-assistant/         # AI 助手页
│   ├── travel-plans/         # 行程列表页
│   ├── plan-detail/          # 行程详情页
│   └── create-plan/          # 创建行程页
├── components/                # 组件目录
├── utils/                     # 工具函数
│   ├── supabase.js          # Supabase 配置
│   ├── auth.js              # 认证工具
│   └── request.js           # 网络请求
├── images/                    # 图片资源
├── app.js                     # 小程序入口
├── app.json                   # 全局配置
├── app.wxss                   # 全局样式
├── project.config.json        # 项目配置
└── sitemap.json              # 站点地图
```

## 🚀 快速开始

### 环境要求

- **微信开发者工具** 最新版本
- **Node.js** >= 14.0.0
- **微信小程序账号**

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/你的用户名/travel-planning.git
cd travel-planning
```

2. **配置 AppID**

打开 `project.config.json`，修改为你的小程序 AppID：

```json
{
  "appid": "你的AppID"
}
```

3. **配置 Supabase**

打开 `utils/supabase.js`，配置你的 Supabase 项目信息：

```javascript
const SUPABASE_URL = '你的Supabase URL'
const SUPABASE_ANON_KEY = '你的Supabase Key'
```

4. **导入项目**

- 打开微信开发者工具
- 选择 "导入项目"
- 选择项目目录
- 点击 "确定"

5. **运行项目**

- 点击工具栏的 "编译" 按钮
- 在模拟器或真机上预览

## 📱 功能截图

### 主要页面

- 首页 - 展示核心功能入口
- AI 规划 - 智能生成旅行计划
- AI 助手 - 智能对话助手
- 行程管理 - 查看和管理行程

## 🔧 配置说明

### 数据库表结构

#### users 表
```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  openid TEXT UNIQUE,
  name TEXT,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password TEXT,
  avatar TEXT,
  gender INTEGER,
  city TEXT,
  province TEXT,
  country TEXT,
  login_type TEXT,
  last_login_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### travel_plans 表
```sql
CREATE TABLE travel_plans (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  title TEXT NOT NULL,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  description TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 微信登录配置

1. **真机调试**
   - 确保基础库版本 >= 2.10.4
   - 上传为体验版或正式版

2. **隐私保护指引**
   - 在微信公众平台配置用户隐私保护指引
   - 说明获取用户信息的用途

3. **权限声明**
   - app.json 中已配置 `requiredPrivateInfos`

详细配置请参考：[微信登录真机调试指南.md](./微信登录真机调试指南.md)

## 🐛 常见问题

### 1. 真机调试无法获取用户信息？

**解决方案：**
- 检查基础库版本
- 上传为体验版测试
- 配置隐私保护指引
- 详见 [快速排查.txt](./快速排查.txt)

### 2. Supabase 连接失败？

**解决方案：**
- 检查网络连接
- 确认 URL 和 Key 配置正确
- 检查 Supabase 项目状态

### 3. 页面加载慢？

**解决方案：**
- 开启懒加载
- 优化图片大小
- 使用 CDN 加速

## 📝 开发计划

### v1.0.0 (当前版本)
- [x] 基础框架搭建
- [x] 微信登录功能
- [x] AI 规划功能
- [x] 行程管理功能

### v1.1.0 (计划中)
- [ ] 社交分享功能
- [ ] 评论和评分系统
- [ ] 离线地图功能
- [ ] 多语言支持

### v2.0.0 (规划中)
- [ ] 实时协作功能
- [ ] 语音助手
- [ ] AR 导览
- [ ] 智能推荐算法优化

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 贡献步骤

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 代码规范

- 遵循 ESLint 规则
- 变量和函数命名语义化
- 添加必要的注释
- 提交前测试功能

## 📄 开源协议

本项目采用 MIT 协议，详见 [LICENSE](./LICENSE) 文件。

## 👥 作者

- **开发者** - 旅游管理系统开发团队

## 🙏 致谢

- 感谢微信小程序平台
- 感谢 Supabase 提供数据库服务
- 感谢所有贡献者

## 📞 联系方式

- **Issue**: [提交问题](https://github.com/你的用户名/travel-planning/issues)
- **Email**: your-email@example.com
- **微信**: 扫描小程序码

## 🌟 Star History

如果这个项目对你有帮助，请给一个 ⭐️ Star！

---

**Made with ❤️ by Travel Planning Team**
