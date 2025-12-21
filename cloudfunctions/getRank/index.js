// cloudfunctions/getRank/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command

exports.main = async (event, context) => {
  const { isSevenDays } = event
  let matchFilter = {}

  if (isSevenDays) {
    // 处理 7 天时间
    const now = new Date()
    const ago = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
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
      .limit(50)
      .end()

    return { success: true, list: res.list }
  } catch (err) {
    return { success: false, error: err }
  }
}