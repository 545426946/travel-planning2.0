# 旅行规划微信小程序

## 项目简介

这是一个基于微信小程序的智能旅行规划应用，集成AI服务为用户提供个性化的旅行建议和行程规划。

## 项目结构

```
旅行规划轻量化项目/
├── app.js                 # 小程序主入口文件
├── app.json              # 小程序全局配置
├── app.wxss              # 全局样式
├── project.config.json   # 项目配置文件
├── package.json          # 项目依赖配置
├── LICENSE               # 开源协议
├── .gitignore           # Git忽略文件配置
├── sitemap.json         # 站点地图配置
│
├── index/               # 首页目录
│   ├── index.js         # 首页逻辑
│   ├── index.json       # 首页配置
│   ├── index.wxml       # 首页结构
│   └── index.wxss       # 首页样式
│
├── pages/               # 页面目录
│   ├── ai-assistant/    # AI助手页面
│   ├── ai-plan/         # AI规划页面
│   ├── create-plan/     # 创建计划页面
│   ├── login/           # 登录页面
│   ├── plan-detail/     # 计划详情页面
│   ├── register/        # 注册页面
│   └── travel-plans/    # 旅行计划列表页面
│
├── utils/               # 工具函数目录
│   ├── ai-integration.js    # AI集成服务
│   ├── ai-service.js        # AI服务模块
│   ├── auth.js              # 认证工具
│   ├── config.js            # 配置工具
│   ├── database.js          # 数据库操作
│   ├── supabase-client.js   # Supabase客户端
│   ├── supabase.js          # Supabase工具
│   └── wechat-login.js      # 微信登录服务
│
├── supabase/            # Supabase配置
│   ├── functions/        # Edge Functions
│   ├── migrations/       # 数据库迁移
│   ├── .env             # 环境变量
│   └── package.json     # 依赖配置
│
├── database/            # 数据库相关
│   └── complete_travel_plans.sql
│
├── api/                 # API相关
│   └── api-examples/    # API示例
│
├── config/              # 配置文件
│   └── .env             # 环境变量
│
├── docs/                # 文档目录
│   ├── 部署完成总结.md
│   ├── 部署修复说明.txt
│   ├── 行程规划功能说明.md
│   └── SUPABASE-SDK-使用说明.md
│
├── scripts/             # 脚本目录（预留）
│
└── web-app/             # Web应用相关（预留）
```

## 核心功能

- **用户认证**: 微信登录、用户注册
- **AI旅行规划**: 智能行程生成、个性化推荐
- **计划管理**: 创建、查看、编辑旅行计划
- **数据存储**: 基于Supabase的云端数据同步

## 技术栈

- **前端**: 微信小程序原生开发
- **后端**: Supabase (数据库 + Edge Functions)
- **AI服务**: Mistral AI API
- **认证**: 微信小程序登录

## 开发说明

1. 配置环境变量：
   - `config/.env` - 本地环境变量
   - `supabase/.env` - Supabase环境变量

2. 安装依赖：
   ```bash
   npm install
   ```

3. 微信开发者工具配置：
   - AppID: wx31db19e0efdc4d9d
   - 项目根目录: 当前目录

## 部署说明

详细部署步骤请参考 `docs/` 目录下的相关文档。

## 许可证

本项目采用 MIT 许可证，详见 LICENSE 文件。