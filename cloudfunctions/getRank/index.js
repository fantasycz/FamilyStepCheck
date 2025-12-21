// cloudfunctions/getRank/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command

exports.main = async (event, context) => {
  const { isSevenDays, page = 0, pageSize = 20 } = event // 接收分页参数
  let matchFilter = {}

  if (isSevenDays) {
    const now = new Date()
    // 过去 7 天的计算
    const ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) 
    matchFilter = { createTime: _.gte(ago) }
  }

  try {
    const res = await db.collection('check_ins')
      .aggregate()
      .match(matchFilter)
      .group({
        _id: '$_openid',
        totalSteps: $.sum('$steps'),
        userInfo: $.first('$userInfo')
      })
      .sort({ totalSteps: -1 })
      .skip(page * pageSize) // 跳过已加载的条数
      .limit(pageSize)       // 限制本次返回条数
      .end()

    return { 
      success: true, 
      list: res.list,
      // 如果返回的条数等于 pageSize，说明可能还有下一页
      hasMore: res.list.length === pageSize 
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}