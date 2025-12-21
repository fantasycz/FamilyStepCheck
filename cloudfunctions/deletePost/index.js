const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { postId, fileId } = event
  const { OPENID } = cloud.getWXContext() // 这里的 OPENID 是系统自动获取的，无法伪造

  try {
    // 1. 先从数据库删除记录 (增加 _openid 条件，确保只能删自己的)
    const dbRes = await db.collection('check_ins').where({
      _id: postId,
      _openid: OPENID
    }).remove()

    // 如果数据库删除了 0 条记录，说明可能不是本人操作或记录已不存在
    if (dbRes.stats.removed === 0) {
      return { success: false, error: '无权删除或记录不存在' }
    }

    // 2. 如果记录有图片，则同步删除云存储文件
    if (fileId) {
      await cloud.deleteFile({
        fileList: [fileId]
      })
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err }
  }
}