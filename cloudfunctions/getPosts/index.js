const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 1. 从数据库获取所有打卡动态（按时间倒序）
    const res = await db.collection('check_ins')
      .orderBy('createTime', 'desc')
      .limit(100) // 可以根据需要设置分页限制
      .get()

    // 2. 在云端统一进行格式化处理
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
        stepsDisplay: (Number(item.steps) || 0).toLocaleString(),
        // 提前预留：如果之后有点赞列表，确保前端拿到的始终是数组
        likeList: item.likeList || [] 
      }
    })

    return {
      success: true,
      data: formattedPosts
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err
    }
  }
}