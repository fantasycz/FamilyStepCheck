// pages/rank/rank.js
Page({
  /**
   * Page initial data
   */
  data: {
    currentTab: 'all', // 'all' or 'seven'
    rankList: [],
    loading: false,
    // 内部缓存，减少重复请求
    cache: {
      all: null,
      seven: null
    }
  },

  onShow() {
    // 每次显示页面时刷新当前选中的 Tab
    this.getRankData(true); 
  },

  /**
   * Tab switching logic with cache support
   */
  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (this.data.currentTab === type || this.data.loading) return;

    this.setData({ currentTab: type });

    // 如果缓存有数据，先显示缓存，再静默刷新
    if (this.data.cache[type]) {
      this.setData({ rankList: this.data.cache[type] });
      this.getRankData(false); // 静默更新，不显示 Loading
    } else {
      this.setData({ rankList: [] });
      this.getRankData(true); // 显示 Loading
    }
  },

  /**
   * Fetch ranking from Cloud Function
   * @param {boolean} showLoading - Whether to show the loading toast
   */
  getRankData(showLoading = true) {
    if (this.data.loading) return;
    
    if (showLoading) wx.showLoading({ title: 'Ranking...', mask: true });
    this.setData({ loading: true });

    const isSevenDays = this.data.currentTab === 'seven';
    const activeTab = this.data.currentTab;

    wx.cloud.callFunction({
      name: 'getRank',
      data: { isSevenDays }
    }).then(res => {
      if (res && res.result && res.result.success) {
        const list = res.result.list || [];
        
        // Data Formatting
        const formattedData = list.map(item => ({
          ...item,
          // Ensure userInfo exists to avoid WXML errors
          userInfo: item.userInfo || { nickName: 'Anonymous', avatarUrl: '' },
          stepsDisplay: (Number(item.totalSteps) || 0).toLocaleString()
        }));

        // Only update if the user hasn't switched tabs while waiting
        if (this.data.currentTab === activeTab) {
          this.setData({ 
            rankList: formattedData,
            [`cache.${activeTab}`]: formattedData // Update specific cache key
          });
        }
      } else {
        throw new Error(res.result?.error || 'Unknown Error');
      }
    }).catch(err => {
      console.error("Rank fetch failed:", err);
      // Only clear list if there's no cache to fall back on
      if (!this.data.cache[activeTab]) {
        this.setData({ rankList: [] });
      }
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideLoading();
      wx.stopPullDownRefresh();
    });
  },

  /**
   * Manual Refresh
   */
  onPullDownRefresh() {
    this.getRankData(false);
  }
});