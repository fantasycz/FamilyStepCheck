// cloudfunctions/getUserStats/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const $ = db.command.aggregate

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const page = event.page || 0
  const pageSize = event.pageSize || 10

  try {
    // --- 1. 计算总计数据 (仅在第一页请求时计算) ---
    let stats = { totalSteps: 0, totalDays: 0 }
    if (page === 0) {
      const statsRes = await db.collection('check_ins')
        .aggregate()
        .match({ _openid: OPENID }) // 确保 openid 匹配
        .group({
          _id: null,
          totalSteps: $.sum('$steps'),
          totalDays: $.sum(1)
        })
        .end()
      
      if (statsRes.list.length > 0) {
        stats = statsRes.list[0]
      }
    }

    // --- 2. 分页获取列表数据 ---
    const listRes = await db.collection('check_ins')
      .where({ _openid: OPENID }) // 这里的查询条件必须和 match 一致
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()

    // 格式化日期显示（因为 aggregate 之后原有的格式化可能丢失，最好在这里统一处理）
    const formattedList = listRes.data.map(item => {
      const date = item.createTime ? new Date(item.createTime) : null;
      let dateString = '刚刚';
      if (date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        dateString = `${month}月${day}日`;
      }
      return {
        ...item,
        dateStr: dateString,
        stepsDisplay: (Number(item.steps) || 0).toLocaleString()
      }
    })

    return {
      success: true,
      data: {
        totalSteps: stats.totalSteps,
        totalDays: stats.totalDays,
        list: formattedList,
        hasMore: listRes.data.length === pageSize
      }
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}