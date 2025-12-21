// cloudfunctions/addPost/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { steps, mood, imgFileID, userInfo } = event
  const { OPENID } = cloud.getWXContext()

  try {
    return await db.collection('check_ins').add({
      data: {
        _openid: OPENID,      // 由服务端强制写入，更安全
        steps: Number(steps),
        mood: mood,
        imgFileID: imgFileID,
        userInfo: userInfo,
        createTime: db.serverDate(), // 使用服务端时间
        likeList: []          // 提前为 [2025-12-18] 的点赞功能预留空数组
      }
    })
  } catch (err) {
    return err
  }
}