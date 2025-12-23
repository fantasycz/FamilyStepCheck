// cloudfunctions/syncUserInfo/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { avatarUrl, nickName } = event

  // 使用 doc().set 实现：存在则更新，不存在则创建
  try {
    await db.collection('users').where({ _openid: OPENID }).update({
      data: { avatarUrl, nickName, updateTime: db.serverDate() }
    }).then(res => {
      if (res.stats.updated === 0) {
        return db.collection('users').add({
          data: { _openid: OPENID, avatarUrl, nickName, createTime: db.serverDate() }
        })
      }
    })
    return { success: true }
  } catch (e) { return { success: false, error: e } }
}