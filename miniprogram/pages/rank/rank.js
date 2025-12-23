// pages/rank/rank.js
Page({
  data: {
    currentTab: 'seven',
    rankList: [],
    loading: false,
    page: 0,
    pageSize: 20,
    hasMore: true,
    cache: {
      all: null,
      seven: null
    }
  },

  onShow() {
    const app = getApp();
    // 检查是否有来自打卡页面的强制刷新信号
    if (app.globalData && app.globalData.needRefreshRank) {
      console.log("Global refresh signal received. Clearing all caches.");
      app.globalData.needRefreshRank = false; // 消耗掉该信号
      // --- 同时清空本地两个 Tab 的缓存标记 ---
      this.setData({
        'cache.all': null,
        'cache.seven': null,
        page: 0,
        hasMore: true,
        rankList: []
      }, () => {
        // 这里的 true 会穿透到云函数，刷新当前 Tab 的后端缓存
        this.getRankData(true, true); 
      });
    } else {
      this.reload(false);
    }
  },

  /**
   * 重置并重新加载
   * @param {boolean} force - 是否强制跳过后端缓存
   */
  reload(force = false) {
    this.setData({
      page: 0,
      hasMore: true,
      // 如果是强制刷新，则清空当前列表展示，不使用旧缓存
      rankList: force ? [] : (this.data.cache[this.data.currentTab] || [])
    }, () => {
      // 如果是强制刷新，显示大 Loading 确保用户感知到更新
      this.getRankData(force || this.data.rankList.length === 0, force);
    });
  },

  /**
   * 获取排行数据
   * @param {boolean} showLoading - 是否显示 Loading 框
   * @param {boolean} forceUpdate - 是否透传强制刷新指令给云函数
   */
  getRankData(showLoading = true, forceUpdate = false) {
    if (this.data.loading) return;
    
    if (showLoading) wx.showLoading({ title: 'Loading...', mask: true });
    this.setData({ loading: true });

    const { currentTab, page, pageSize } = this.data;

    wx.cloud.callFunction({
      name: 'getRank',
      data: { 
        isSevenDays: currentTab === 'seven',
        page: page,
        pageSize: pageSize,
        forceUpdate: forceUpdate // 【关键】将指令传给云函数
      }
    }).then(res => {
      if (res && res.result && res.result.success) {
        const newList = (res.result.list || []).map(item => ({
          ...item,
          userInfo: item.userInfo || { nickName: 'Anonymous', avatarUrl: '' },
          stepsDisplay: (Number(item.totalSteps) || 0).toLocaleString()
        }));

        const updatedList = page === 0 ? newList : this.data.rankList.concat(newList);

        if (page === 0) {
          this.setData({ [`cache.${currentTab}`]: newList });
        }

        this.setData({ 
          rankList: updatedList,
          hasMore: res.result.hasMore
        });
      }
    }).catch(err => {
      console.error("Rank fetch failed:", err);
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideLoading();
      wx.stopPullDownRefresh();
    });
  },

  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (this.data.currentTab === type || this.data.loading) return;

    const hasCache = this.data.cache[type] && this.data.cache[type].length > 0;

    this.setData({ 
      currentTab: type,
      page: 0,
      hasMore: true,
      rankList: this.data.cache[type] || []
    }, () => {
      // 如果没有缓存（说明被刚才的 forceUpdate 流程清空了），则强制刷新
    this.getRankData(!hasCache, !hasCache);
    });
  },

  onReachBottom() {
    if (this.data.currentTab === 'seven' && this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.getRankData(false, false);
      });
    }
  },

  onPullDownRefresh() {
    this.reload(true); // 手动下拉刷新通常也需要 forceUpdate
  }
});