const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// --- 模拟 Redis 的内存存储 ---
let cache = {
  seven: { data: null, updateTime: 0 },
  all: { data: null, updateTime: 0 }
};
const CACHE_EXPIRE = 5 * 60 * 1000; // 缓存 5 分钟 (300,000ms)

exports.main = async (event, context) => {
  const { isSevenDays, page = 0, pageSize = 20 } = event;
  const typeKey = isSevenDays ? 'seven' : 'all';
  const now = Date.now();

  // 1. 检查内存缓存是否有效 (仅针对第一页 page === 0 进行缓存)
  if (page === 0 && cache[typeKey].data && (now - cache[typeKey].updateTime < CACHE_EXPIRE)) {
    console.log(`Using Memory Cache for: ${typeKey}`);
    return { 
      success: true, 
      list: cache[typeKey].data, 
      hasMore: cache[typeKey].data.length === pageSize,
      fromCache: true 
    };
  }

  // 2. 如果缓存失效或请求非第一页，执行数据库聚合查询
  try {
    let matchFilter = {};
    // 根据是否是 7 天来决定限制数量
    // 如果是总榜 (isSevenDays 为 false)，只取前 3 名
    const limitCount = isSevenDays ? pageSize : 3;

    if (isSevenDays) {
      const ago = new Date(now - 7 * 24 * 60 * 60 * 1000);
      matchFilter = { createTime: db.command.gte(ago) };
    }

    const res = await db.collection('check_ins').aggregate()
      .match(matchFilter)
      .group({
        _id: '$_openid',
        totalSteps: db.command.aggregate.sum('$steps'),
        userInfo: db.command.aggregate.first('$userInfo')
      })
      .sort({ totalSteps: -1 })
      .skip(page * pageSize)
      .limit(limitCount)
      .end();

    // 3. 更新第一页的内存缓存
    if (page === 0 && res.list.length > 0) {
      cache[typeKey] = {
        data: res.list,
        updateTime: now
      };
    }

    return { 
      success: true, 
      list: res.list, 
      hasMore: isSevenDays ? res.list.length === pageSize : false 
    };
  } catch (err) {
    return { success: false, error: err };
  }
};