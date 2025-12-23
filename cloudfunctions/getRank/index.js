const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// --- 模拟 Redis 的内存存储 ---
let cache = {
  seven: { data: null, updateTime: 0 },
  all: { data: null, updateTime: 0 }
};
const CACHE_EXPIRE = 5 * 60 * 1000; // 5 分钟

exports.main = async (event, context) => {
  // --- 关键修复 1：接收 forceUpdate 参数 ---
  const { isSevenDays, page = 0, pageSize = 20, forceUpdate = false } = event;
  const typeKey = isSevenDays ? 'seven' : 'all';
  const now = Date.now();

  // --- 关键修复 2：只有在 NOT forceUpdate 时才使用缓存 ---
  if (!forceUpdate && page === 0 && cache[typeKey].data && (now - cache[typeKey].updateTime < CACHE_EXPIRE)) {
    console.log(`Using Memory Cache for: ${typeKey}`);
    return { 
      success: true, 
      list: cache[typeKey].data, 
      hasMore: isSevenDays ? cache[typeKey].data.length === pageSize : false,
      fromCache: true 
    };
  }

  // 2. 执行数据库聚合查询
  try {
    let matchFilter = {};
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
    if (page === 0) {
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
    console.error(err);
    return { success: false, error: err };
  }
};