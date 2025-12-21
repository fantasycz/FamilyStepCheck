// cloudfunctions/getPosts/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  // 接收前端传来的页码，默认为第 0 页，每页 20 条
  const page = event.page || 0
  const pageSize = event.pageSize || 20

  try {
    const res = await db.collection('check_ins')
      .orderBy('createTime', 'desc')
      .skip(page * pageSize) // 跳过之前的条数
      .limit(pageSize)       // 只取当前的条数
      .get()

    // 格式化逻辑保持不变...
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
      return {
        ...item,
        dateStr: dateString,
        stepsDisplay: (Number(item.steps) || 0).toLocaleString()
      }
    })

    return {
      success: true,
      data: formattedPosts,
      hasMore: res.data.length === pageSize // 如果拿到的条数等于 pageSize，说明可能还有下一页
    }
  } catch (err) {
    return { success: false, error: err }
  }
}