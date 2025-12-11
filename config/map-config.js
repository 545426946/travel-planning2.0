/**
 * 地图配置文件 - 高德地图版本
 * 包含高德地图API配置、城市坐标、样式配置等
 */

module.exports = {
  // 高德地图API配置
  amap: {
    key: '26e18d3799a5a6bc8b2bf34e454777a5',
    // 逆地理编码
    regeoUrl: 'https://restapi.amap.com/v3/geocode/regeo',
    // 地理编码
    geoUrl: 'https://restapi.amap.com/v3/geocode/geo',
    // POI搜索
    poiUrl: 'https://restapi.amap.com/v3/place/text',
    // 周边搜索
    aroundUrl: 'https://restapi.amap.com/v3/place/around',
    // 路径规划
    directionUrl: 'https://restapi.amap.com/v3/direction/driving',
    timeout: 8000,
    retryCount: 2
  },

  // 默认地图设置
  defaultMap: {
    scale: 13,
    showLocation: true,
    enableOverlooking: false,
    enableZoom: true,
    enableScroll: true,
    enableRotate: false,
    showCompass: false,
    enable3D: false
  },

  // 标记样式
  markerStyles: {
    default: {
      width: 30,
      height: 36,
      iconPath: '/images/marker.png'
    },
    footprint: {
      width: 28,
      height: 28,
      iconPath: '/images/footprint-marker.png'
    },
    checkin: {
      width: 32,
      height: 32,
      iconPath: '/images/checkin-marker.png'
    }
  },

  // 路线样式
  polylineStyles: {
    default: {
      color: '#4facfe',
      width: 4,
      dottedLine: false,
      arrowLine: true,
      borderColor: '#fff',
      borderWidth: 2
    },
    footprint: {
      color: '#ff6b6b',
      width: 3,
      dottedLine: true,
      arrowLine: false
    }
  },

  // 省份数据（用于足迹点亮）
  provinces: [
    { name: '北京', code: '110000', center: [116.405285, 39.904989] },
    { name: '天津', code: '120000', center: [117.190182, 39.125596] },
    { name: '河北', code: '130000', center: [114.502461, 38.045474] },
    { name: '山西', code: '140000', center: [112.549248, 37.857014] },
    { name: '内蒙古', code: '150000', center: [111.670801, 40.818311] },
    { name: '辽宁', code: '210000', center: [123.429096, 41.796767] },
    { name: '吉林', code: '220000', center: [125.3245, 43.886841] },
    { name: '黑龙江', code: '230000', center: [126.642464, 45.756967] },
    { name: '上海', code: '310000', center: [121.472644, 31.231706] },
    { name: '江苏', code: '320000', center: [118.767413, 32.041544] },
    { name: '浙江', code: '330000', center: [120.153576, 30.287459] },
    { name: '安徽', code: '340000', center: [117.283042, 31.86119] },
    { name: '福建', code: '350000', center: [119.306239, 26.075302] },
    { name: '江西', code: '360000', center: [115.892151, 28.676493] },
    { name: '山东', code: '370000', center: [117.000923, 36.675807] },
    { name: '河南', code: '410000', center: [113.665412, 34.757975] },
    { name: '湖北', code: '420000', center: [114.298572, 30.584355] },
    { name: '湖南', code: '430000', center: [112.982279, 28.19409] },
    { name: '广东', code: '440000', center: [113.280637, 23.125178] },
    { name: '广西', code: '450000', center: [108.320004, 22.82402] },
    { name: '海南', code: '460000', center: [110.33119, 20.031971] },
    { name: '重庆', code: '500000', center: [106.504962, 29.533155] },
    { name: '四川', code: '510000', center: [104.065735, 30.659462] },
    { name: '贵州', code: '520000', center: [106.713478, 26.578343] },
    { name: '云南', code: '530000', center: [102.712251, 25.040609] },
    { name: '西藏', code: '540000', center: [91.132212, 29.660361] },
    { name: '陕西', code: '610000', center: [108.948024, 34.263161] },
    { name: '甘肃', code: '620000', center: [103.823557, 36.058039] },
    { name: '青海', code: '630000', center: [101.778916, 36.623178] },
    { name: '宁夏', code: '640000', center: [106.278179, 38.46637] },
    { name: '新疆', code: '650000', center: [87.617733, 43.792818] },
    { name: '台湾', code: '710000', center: [121.509062, 25.044332] },
    { name: '香港', code: '810000', center: [114.173355, 22.320048] },
    { name: '澳门', code: '820000', center: [113.54909, 22.198951] }
  ],

  // 城市坐标数据
  cityCoordinates: {
    '北京': { latitude: 39.904989, longitude: 116.405285, scale: 11 },
    '上海': { latitude: 31.231706, longitude: 121.472644, scale: 11 },
    '天津': { latitude: 39.125596, longitude: 117.190182, scale: 11 },
    '重庆': { latitude: 29.533155, longitude: 106.504962, scale: 11 },
    '广州': { latitude: 23.125178, longitude: 113.280637, scale: 11 },
    '深圳': { latitude: 22.543099, longitude: 114.057868, scale: 11 },
    '杭州': { latitude: 30.287459, longitude: 120.153576, scale: 12 },
    '南京': { latitude: 32.041544, longitude: 118.767413, scale: 12 },
    '成都': { latitude: 30.659462, longitude: 104.065735, scale: 11 },
    '西安': { latitude: 34.263161, longitude: 108.948024, scale: 11 },
    '武汉': { latitude: 30.584355, longitude: 114.298572, scale: 11 },
    '长沙': { latitude: 28.19409, longitude: 112.982279, scale: 11 },
    '郑州': { latitude: 34.757975, longitude: 113.665412, scale: 11 },
    '济南': { latitude: 36.675807, longitude: 117.000923, scale: 11 },
    '福州': { latitude: 26.075302, longitude: 119.306239, scale: 12 },
    '合肥': { latitude: 31.86119, longitude: 117.283042, scale: 11 },
    '南昌': { latitude: 28.676493, longitude: 115.892151, scale: 11 },
    '昆明': { latitude: 25.040609, longitude: 102.712251, scale: 11 },
    '贵阳': { latitude: 26.578343, longitude: 106.713478, scale: 11 },
    '兰州': { latitude: 36.058039, longitude: 103.823557, scale: 11 },
    '太原': { latitude: 37.857014, longitude: 112.549248, scale: 11 },
    '石家庄': { latitude: 38.045474, longitude: 114.502461, scale: 11 },
    '沈阳': { latitude: 41.796767, longitude: 123.429096, scale: 11 },
    '长春': { latitude: 43.886841, longitude: 125.3245, scale: 11 },
    '哈尔滨': { latitude: 45.756967, longitude: 126.642464, scale: 11 },
    '南宁': { latitude: 22.82402, longitude: 108.320004, scale: 11 },
    '海口': { latitude: 20.031971, longitude: 110.33119, scale: 12 },
    '银川': { latitude: 38.46637, longitude: 106.278179, scale: 11 },
    '西宁': { latitude: 36.623178, longitude: 101.778916, scale: 11 },
    '拉萨': { latitude: 29.660361, longitude: 91.132212, scale: 12 },
    '乌鲁木齐': { latitude: 43.792818, longitude: 87.617733, scale: 11 },
    '呼和浩特': { latitude: 40.818311, longitude: 111.670801, scale: 11 },
    '苏州': { latitude: 31.299379, longitude: 120.619585, scale: 12 },
    '青岛': { latitude: 36.067082, longitude: 120.382639, scale: 11 },
    '大连': { latitude: 38.914003, longitude: 121.618622, scale: 11 },
    '厦门': { latitude: 24.479834, longitude: 118.089425, scale: 12 },
    '三亚': { latitude: 18.247872, longitude: 109.508268, scale: 12 },
    '桂林': { latitude: 25.273566, longitude: 110.290194, scale: 12 },
    '丽江': { latitude: 26.855047, longitude: 100.227750, scale: 12 },
    '大理': { latitude: 25.606486, longitude: 100.267638, scale: 12 },
    '黄山': { latitude: 29.714655, longitude: 118.337481, scale: 12 },
    '张家界': { latitude: 29.117096, longitude: 110.479191, scale: 12 },
    '九寨沟': { latitude: 33.260318, longitude: 103.916869, scale: 12 },
    '洛阳': { latitude: 34.619682, longitude: 112.453895, scale: 12 },
    '无锡': { latitude: 31.491169, longitude: 120.311910, scale: 12 },
    '宁波': { latitude: 29.868336, longitude: 121.549792, scale: 12 },
    '珠海': { latitude: 22.270715, longitude: 113.576726, scale: 12 },
    '敦煌': { latitude: 40.142128, longitude: 94.661941, scale: 12 },
    '香格里拉': { latitude: 27.825827, longitude: 99.702234, scale: 12 }
  }
}
