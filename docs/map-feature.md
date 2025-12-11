# 地图功能说明 - 高德地图版本

## 概述

本项目使用高德地图API实现地图功能，包括：
- 足迹地图（打卡记录、省份点亮）
- 行程地图（景点定位、路线规划）

## API配置

高德地图 Web服务 API Key: `26e18d3799a5a6bc8b2bf34e454777a5`

配置文件: `config/map-config.js`

```javascript
amap: {
  key: '26e18d3799a5a6bc8b2bf34e454777a5',
  regeoUrl: 'https://restapi.amap.com/v3/geocode/regeo',  // 逆地理编码
  geoUrl: 'https://restapi.amap.com/v3/geocode/geo',      // 地理编码
  poiUrl: 'https://restapi.amap.com/v3/place/text',       // POI搜索
  aroundUrl: 'https://restapi.amap.com/v3/place/around',  // 周边搜索
}
```

## 页面结构

```
pages/
├── map/map           # 足迹地图主页
├── checkin/checkin   # 打卡页面
└── plan-map/plan-map # 行程地图
```

## 服务文件

- `utils/map-service.js` - 地图服务（景点定位、路线计算）
- `utils/footprint-service.js` - 足迹服务（打卡、统计）

## 数据库表

需要在 Supabase 执行 `database/footprint_tables.sql`:
- `footprints` - 足迹记录
- `travel_stats` - 旅行统计

## 功能入口

1. 首页 - 足迹入口卡片
2. 行程详情 - 查看地图按钮
3. 行程地图 - 打卡按钮

## 注意事项

1. 高德地图API需要在微信小程序后台配置request合法域名：
   - `https://restapi.amap.com`

2. 地图组件使用微信原生map组件，坐标系为gcj02

3. 首次使用需要用户授权位置权限
