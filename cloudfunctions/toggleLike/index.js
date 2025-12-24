// cloudfunctions/toggleLike/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { postId } = event

  try {
    // 1. 先查询该用户是否在点赞名单里
    const post = await db.collection('check_ins').doc(postId).get()
    const likes = post.data.likes || []
    const hasLiked = likes.includes(OPENID)

    // 2. 根据状态进行原子更新
    if (hasLiked) {
      await db.collection('check_ins').doc(postId).update({
        data: { likes: _.pull(OPENID) }
      })
      return { success: true, action: 'unliked' }
    } else {
      await db.collection('check_ins').doc(postId).update({
        data: { likes: _.addToSet(OPENID) }
      })
      return { success: true, action: 'liked' }
    }
  } catch (err) {
    // 3. 这里的报错会被前端 catch 到，从而触发回滚
    console.error("Cloud function error:", err)
    return { 
      success: false, 
      error: err.message || err,
      errMsg: "数据库操作失败，请检查文档ID和权限" 
    }
  }
}