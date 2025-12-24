// pages/rank/rank.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    currentTab: 'seven',
    rankList: [], // 始终保持为数组，防止渲染层报错
    loading: false,
    page: 0,
    pageSize: 20,
    hasMore: true,
    // 初始值设为 [] 而非 null，根治 "object null is not iterable" 报错
    cache: {
      all: [],
      seven: []
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    const app = getApp();
    // 检查是否有来自打卡页面的强制刷新信号
    if (app.globalData && app.globalData.needRefreshRank) {
      console.log("Rank: 收到全局刷新信号，清空缓存并重载...");
      app.globalData.needRefreshRank = false; // 消耗信号
      
      // 清空本地缓存并执行强制刷新
      this.setData({
        'cache.all': [],
        'cache.seven': [],
        page: 0,
        hasMore: true,
        rankList: []
      }, () => {
        this.getRankData(true, true); 
      });
    } else {
      // 普通进入页面，尝试使用缓存或静默加载
      this.reload(false);
    }
  },

  /**
   * 下拉刷新监听
   */
  onPullDownRefresh() {
    console.log("Rank: 用户触发下拉刷新");
    // 调用 reload(true) 强制跳过云函数后端缓存
    this.reload(true);
  },

  /**
   * 重置并重新加载
   * @param {boolean} force - 是否强制跳过后端缓存
   */
  reload(force = false) {
    const currentCache = this.data.cache[this.data.currentTab] || [];
    
    this.setData({
      page: 0,
      hasMore: true,
      // 如果强制刷新，清空列表；否则尝试展示现有缓存提升秒开感
      rankList: force ? [] : currentCache
    }, () => {
      // 如果强制刷新或当前无数据，显示大 Loading
      const shouldShowLoading = force || currentCache.length === 0;
      this.getRankData(shouldShowLoading, force);
    });
  },

  /**
   * 获取排行数据
   * @param {boolean} showLoading - 是否显示全屏 Loading 框
   * @param {boolean} forceUpdate - 是否透传强制刷新指令给云函数
   */
  getRankData(showLoading = true, forceUpdate = false) {
    if (this.data.loading) return;
    
    if (showLoading) wx.showLoading({ title: '加载中...', mask: true });
    this.setData({ loading: true });

    const { currentTab, page, pageSize } = this.data;

    wx.cloud.callFunction({
      name: 'getRank',
      data: { 
        isSevenDays: currentTab === 'seven',
        page: page,
        pageSize: pageSize,
        forceUpdate: forceUpdate // 穿透云函数内存缓存的关键参数
      }
    }).then(res => {
      if (res && res.result && res.result.success) {
        const rawList = res.result.list || [];
        
        // 格式化数据，确保 userInfo 存在防崩溃
        const newList = rawList.map(item => ({
          ...item,
          userInfo: item.userInfo || { nickName: '路人', avatarUrl: '' },
          stepsDisplay: (Number(item.totalSteps) || 0).toLocaleString()
        }));

        // 合并数据，确保 rankList 始终是可迭代的数组
        const currentList = this.data.rankList || [];
        const updatedList = page === 0 ? newList : currentList.concat(newList);

        // 如果是第一页，同步更新对应的本地 Tab 缓存
        if (page === 0) {
          this.setData({ [`cache.${currentTab}`]: newList });
        }

        this.setData({ 
          rankList: updatedList,
          hasMore: res.result.hasMore || false
        });
      }
    }).catch(err => {
      console.error("Rank fetch failed:", err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideLoading();
      // 核心：无论成功失败，停止下拉刷新的三个点动画
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 切换 Tab
   */
  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (this.data.currentTab === type || this.data.loading) return;

    const targetCache = this.data.cache[type] || [];
    const hasNoCache = targetCache.length === 0;

    this.setData({ 
      currentTab: type,
      page: 0,
      hasMore: true,
      rankList: targetCache
    }, () => {
      // 如果切换到的 Tab 没数据，则强制请求
      if (hasNoCache) {
        this.getRankData(true, false);
      }
    });
  },

  /**
   * 触底加载更多
   */
  onReachBottom() {
    // 仅在有更多数据且不在加载中时触发
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.getRankData(false, false);
      });
    }
  }
});