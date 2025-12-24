// cloudfunctions/getPosts/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  // 1. 获取当前调用者的 OPENID，用于判断用户是否点过赞
  const { OPENID } = cloud.getWXContext()
  
  const page = event.page || 0
  const pageSize = event.pageSize || 20

  try {
    const res = await db.collection('check_ins')
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()

    // 2. 格式化逻辑：加入点赞数据处理
    const formattedPosts = res.data.map(item => {
      const date = item.createTime ? new Date(item.createTime) : null;
      let dateString = '刚刚';
      if (date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
        dateString = `${month}月${day}日 ${hours}:${minutes}`;
      }

      // --- 点赞逻辑处理 ---
      const likes = item.likes || []; // 确保 likes 字段存在
      
      return {
        ...item,
        dateStr: dateString,
        stepsDisplay: (Number(item.steps) || 0).toLocaleString(),
        // 返回总点赞数
        likeCount: likes.length,
        // 返回当前用户是否已点赞 (Boolean)
        isLiked: likes.includes(OPENID) 
      }
    })

    return {
      success: true,
      data: formattedPosts,
      hasMore: res.data.length === pageSize
    }
  } catch (err) {
    console.error("Get posts failed:", err)
    return { success: false, error: err }
  }
}