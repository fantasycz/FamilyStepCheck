const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const $ = db.command.aggregate

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID // 直接从上下文中获取，更安全

  try {
    // 使用聚合查询一次性搞定：总步数、总天数、历史列表
    const res = await db.collection('check_ins')
      .aggregate()
      .match({
        _openid: openid
      })
      .sort({
        createTime: -1
      })
      .group({
        _id: null,
        totalSteps: $.sum('$steps'),
        totalDays: $.sum(1),
        list: $.push('$$ROOT') // 把原始记录存入列表
      })
      .end()

    if (res.list.length === 0) {
      return { success: true, data: { totalSteps: 0, totalDays: 0, list: [] } }
    }

    const stats = res.list[0]
    return {
      success: true,
      data: {
        totalSteps: stats.totalSteps,
        totalDays: stats.totalDays,
        // 在后端完成基础格式化，减轻前端负担
        list: stats.list.map(item => ({
          ...item,
          stepsDisplay: (item.steps || 0).toLocaleString(),
          dateStr: item.createTime ? new Date(item.createTime).toLocaleDateString() : 'Just now'
        }))
      }
    }
  } catch (err) {
    return { success: false, error: err }
  }
}