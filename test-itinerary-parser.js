// 测试行程解析功能

// 中文数字转换函数
function chineseToNumber(chinese) {
  const numbers = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
  }
  
  if (/^\d+$/.test(chinese)) {
    return parseInt(chinese)
  }
  
  return numbers[chinese] || 1
}

// 计算日期函数
function calculateDate(startDate, dayIndex) {
  if (!startDate) return ''
  const date = new Date(startDate)
  date.setDate(date.getDate() + dayIndex)
  return date.toISOString().split('T')[0]
}

// 提取活动函数
function extractActivities(content) {
  if (!content) return []
  
  const activities = []
  const timePatterns = [
    /(上午|下午|晚上|早晨|中午|傍晚|夜间)[：:]\s*([^\n]+)/g,
    /(\d{1,2}:\d{2})[：:]\s*([^\n]+)/g,
    /([\d一二三四五六七八九十]+)[.、]\s*([^\n]+)/g
  ]
  
  timePatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(content)) !== null) {
      activities.push({
        time: match[1] || '',
        title: match[2].trim(),
        location: '',
        price: ''
      })
    }
  })
  
  return activities
}

// 创建默认行程函数
function createDefaultItinerary(totalDays) {
  const dailyPlans = []
  
  for (let i = 0; i < totalDays; i++) {
    const dayNum = i + 1
    const date = calculateDate('2024-01-01', i)
    
    dailyPlans.push({
      day: dayNum,
      date: date,
      content: '暂无安排',
      activities: []
    })
  }
  
  return dailyPlans
}

// 解析行程函数（核心功能）
function parseItinerary(itinerary, totalDays) {
  if (!itinerary) {
    console.log('行程内容为空，创建默认行程')
    return createDefaultItinerary(totalDays)
  }

  const dailyPlans = []
  
  console.log('开始解析行程，总天数:', totalDays)
  console.log('行程内容前500字符:', itinerary.substring(0, 500))
  
  try {
    // 增强的解析：支持多种AI格式
    const dayContents = []
    
    // 首先尝试匹配详细格式（Day X - 日期）
    const detailDayPattern = /Day\s*(\d+)\s*[-—]\s*([\d]{4}-[\d]{2}-[\d]{2})\s*[:：]\s*([\s\S]*?)(?=Day\s*\d+[-—][\d]{4}-[\d]{2}-[\d]{2}|$)/gi
    let match
    const detailDays = []
    
    while ((match = detailDayPattern.exec(itinerary)) !== null) {
      const dayData = {
        dayNum: parseInt(match[1]),
        date: match[2].trim(),
        content: match[3].trim()
      }
      detailDays.push(dayData)
      console.log('解析到Day ' + dayData.dayNum + ':', dayData.date, '内容长度:', dayData.content.length)
    }
    
    console.log('详细格式解析结果:', detailDays.length, '天')
    
    if (detailDays.length > 0) {
      dayContents.push(...detailDays)
    } else {
      // 尝试简化的Day格式（没有日期）
      const simpleDayPattern = /Day\s*(\d+)\s*[:：]\s*([\s\S]*?)(?=Day\s*\d+[:：]|$)/gi
      
      while ((match = simpleDayPattern.exec(itinerary)) !== null) {
        const dayData = {
          dayNum: parseInt(match[1]),
          date: '',
          content: match[2].trim()
        }
        dayContents.push(dayData)
        console.log('简化格式解析到Day ' + dayData.dayNum + '，内容长度:', dayData.content.length)
      }
      
      // 如果还是没有，尝试中文格式（第X天）
      if (dayContents.length === 0) {
        const chineseDayPattern = /第([一二三四五六七八九十\d]+)天[\s:：]([\s\S]*?)(?=第[一二三四五六七八九十\d]+天|$)/gi
        
        while ((match = chineseDayPattern.exec(itinerary)) !== null) {
          const dayNum = chineseToNumber(match[1])
          const dayData = {
            dayNum: dayNum,
            date: '',
            content: match[2].trim()
          }
          dayContents.push(dayData)
          console.log('解析到第' + dayNum + '天，内容长度:', dayData.content.length)
        }
      }
      
      // 如果还是没有，尝试按每个"Day"分割
      if (dayContents.length === 0) {
        const daySections = itinerary.split(/Day\s*\d+/gi)
        const validSections = daySections.filter(function(section, index) {
          if (index === 0 && section.length > 0 && !section.includes('上午') && !section.includes('下午') && !section.includes('晚上')) {
            return false
          }
          return section.trim().length > 10
        })
        
        validSections.forEach(function(section, index) {
          const dayNum = index + 1
          const dayData = {
            dayNum: dayNum,
            date: '',
            content: section.trim()
          }
          dayContents.push(dayData)
          console.log('按分割解析到第' + dayNum + '天，内容长度:', section.length)
        })
      }
    }
    
    console.log('最终解析结果:', dayContents.length, '天数据')

    // 确保有足够的天数
    for (let i = 0; i < totalDays; i++) {
      const dayNum = i + 1
      const dayData = dayContents.find(d => d.dayNum === dayNum)
      let content = ''
      let date = ''
      
      if (dayData) {
        content = dayData.content
        date = dayData.date || calculateDate('2024-01-01', i)
      } else {
        if (dayContents[i]) {
          content = dayContents[i].content
          date = dayContents[i].date || calculateDate('2024-01-01', i)
        } else {
          content = '暂无安排'
          date = calculateDate('2024-01-01', i)
        }
      }

      // 提取活动项
      const activities = extractActivities(content)

      dailyPlans.push({
        day: dayNum,
        date: date,
        content: content,
        activities: activities
      })
      
      console.log('第' + dayNum + '天解析完成:', {
        hasContent: content.length > 0,
        hasActivities: activities.length > 0,
        activityCount: activities.length,
        contentLength: content.length
      })
    }

    console.log('parseItinerary完成，返回数据:', dailyPlans)
    return dailyPlans
    
  } catch (error) {
    console.error('解析行程失败:', error)
    return createDefaultItinerary(totalDays)
  }
}

// 测试用例
const testCases = [
  {
    name: 'JSON格式行程',
    itinerary: '{"day1": "上午：参观故宫\n下午：游览天安门广场\n晚上：品尝北京烤鸭", "day2": "上午：爬长城\n下午：参观鸟巢\n晚上：逛王府井"}',
    totalDays: 2
  },
  {
    name: '纯文本格式行程',
    itinerary: '第1天：上午参观故宫，下午游览天安门广场，晚上品尝北京烤鸭\n第2天：上午爬长城，下午参观鸟巢，晚上逛王府井',
    totalDays: 2
  },
  {
    name: 'Day格式行程',
    itinerary: 'Day 1: 上午参观故宫，下午游览天安门广场，晚上品尝北京烤鸭\nDay 2: 上午爬长城，下午参观鸟巢，晚上逛王府井',
    totalDays: 2
  },
  {
    name: '混合格式行程',
    itinerary: 'Day 1 - 2024-01-01: 上午参观故宫，下午游览天安门广场\nDay 2 - 2024-01-02: 上午爬长城，下午参观鸟巢',
    totalDays: 2
  },
  {
    name: '无格式纯文本',
    itinerary: '上午参观故宫，下午游览天安门广场，晚上品尝北京烤鸭。第二天上午爬长城，下午参观鸟巢，晚上逛王府井。',
    totalDays: 2
  },
  
  // 测试用例6：增强版纯文本格式
  {
    name: "增强版纯文本格式",
    itinerary: `第1天：
上午：参观天安门广场，位于北京市中心，门票免费。
下午：游览故宫博物院，世界文化遗产，门票60元。
晚上：前往王府井步行街，品尝北京小吃。

第2天：
早上：前往八达岭长城，位于延庆区，门票45元。
午后：参观明十三陵，了解明朝历史。

第3天：
第1个景点：颐和园，皇家园林，门票30元。
第2个景点：圆明园遗址，历史遗迹，免费参观。`,
    totalDays: 3
  },
  
  // 测试用例7：混合格式（带地点和价格信息）
  {
    name: "混合格式（带地点和价格）",
    itinerary: `第一天：
上午：参观天安门广场，位于北京市中心，门票免费
下午：游览故宫博物院，在景山前街4号，门票60元
晚上：前往王府井步行街，品尝各种北京小吃

第二天：
早上：前往八达岭长城，位于延庆区，门票45元
中午：在长城脚下用餐，价格80块
下午：参观明十三陵，位于昌平区，了解明朝历史`,
    totalDays: 2
  }
]

// 运行测试
console.log('开始测试行程解析功能...\n')

testCases.forEach((testCase, index) => {
  console.log(`\n=== 测试用例 ${index + 1}: ${testCase.name} ===`)
  console.log('输入行程:', testCase.itinerary)
  
  try {
    const result = parseItinerary(testCase.itinerary, testCase.totalDays)
    
    console.log('解析结果:')
    result.forEach(day => {
      console.log(`  第${day.day}天 (${day.date}):`)
      console.log(`    内容: ${day.content.substring(0, 100)}...`)
      console.log(`    活动数量: ${day.activities.length}`)
      if (day.activities.length > 0) {
        day.activities.forEach(activity => {
          console.log(`      - ${activity.time}: ${activity.title}`)
        })
      }
    })
    console.log('✅ 解析成功')
    
  } catch (error) {
    console.log('❌ 解析失败:', error.message)
    console.log('错误堆栈:', error.stack)
  }
})

console.log('\n=== 测试完成 ===')