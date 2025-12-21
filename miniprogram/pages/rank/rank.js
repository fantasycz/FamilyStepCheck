// pages/rank/rank.js
Page({
  data: {
    currentTab: 'all', // 'all' or 'seven'
    rankList: [],
    loading: false,
    page: 0,           // 当前页码
    pageSize: 20,      // 每页数量
    hasMore: true,     // 是否还有更多数据
    // 缓存依然保留，但只缓存第一页数据以提升切换速度
    cache: {
      all: null,
      seven: null
    }
  },

  onShow() {
    this.reload(); 
  },

  /**
   * 重置当前 Tab 的分页并重新加载
   */
  reload() {
    this.setData({
      page: 0,
      hasMore: true,
      // 如果有缓存，先展示缓存的第一页，避免白屏
      rankList: this.data.cache[this.data.currentTab] || []
    }, () => {
      this.getRankData(this.data.rankList.length === 0); // 只有没缓存时才显示大 Loading
    });
  },

  /**
   * Tab 切换逻辑
   */
  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (this.data.currentTab === type || this.data.loading) return;

    this.setData({ 
      currentTab: type,
      page: 0,
      hasMore: true,
      // 切换瞬间立即展示缓存
      rankList: this.data.cache[type] || []
    }, () => {
      // 切换后自动刷新第一页
      this.getRankData(this.data.rankList.length === 0);
    });
  },

  /**
   * 触底加载更多
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.getRankData(false); // 加载更多不需要全局 Loading
      });
    }
  },

  /**
   * 获取排行数据
   */
  getRankData(showLoading = true) {
    if (this.data.loading) return;
    
    if (showLoading) wx.showLoading({ title: 'Loading...', mask: true });
    this.setData({ loading: true });

    const { currentTab, page, pageSize } = this.data;

    wx.cloud.callFunction({
      name: 'getRank',
      data: { 
        isSevenDays: currentTab === 'seven',
        page: page,
        pageSize: pageSize
      }
    }).then(res => {
      if (res && res.result && res.result.success) {
        const newList = (res.result.list || []).map(item => ({
          ...item,
          userInfo: item.userInfo || { nickName: 'Anonymous', avatarUrl: '' },
          stepsDisplay: (Number(item.totalSteps) || 0).toLocaleString()
        }));

        // 处理分页合并逻辑
        const updatedList = page === 0 ? newList : this.data.rankList.concat(newList);

        // 如果是第一页，更新缓存
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

  onPullDownRefresh() {
    this.reload();
  }
});