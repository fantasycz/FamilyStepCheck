// pages/me/me.js
Page({
  data: {
    userInfo: null,
    myHistory: [],
    totalSteps: '0',
    totalDays: 0,
    page: 0,
    hasMore: true,
    loading: false,
    isLoaded: false
  },

  onShow() {
    // 1. 必须先定义这个方法（见下方），这里才能调用
    this.checkLoginStatus();
    
    // 只有登录了才去加载数据
    if (this.data.userInfo) {
      this.reload();
    } else {
      // 未登录时清空数据状态
      this.setData({ myHistory: [], totalSteps: '0', totalDays: 0 });
    }
  },

  // --- 关键修复：定义这个被调用的函数 ---
  checkLoginStatus() {
    const user = wx.getStorageSync('userInfo');
    if (user) {
      this.setData({ userInfo: user });
    } else {
      this.setData({ userInfo: null });
    }
  },

  reload() {
    this.setData({ page: 0, hasMore: true, myHistory: [] }, () => {
      this.fetchMyHistory();
    });
  },

  /**
   * 触底加载
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.fetchMyHistory();
      });
    }
  },

  /**
   * 获取历史数据
   */
  fetchMyHistory(callback = null) {
    if (this.data.loading) return;

    this.setData({ loading: true });
    // 仅在第一次打开页面且没数据时显示全屏 Loading
    if (!this.data.isLoaded) wx.showLoading({ title: 'Loading...', mask: true });
    
    wx.cloud.callFunction({
      name: 'getUserStats',
      data: {
        page: this.data.page,
        pageSize: 10
      }
    }).then(res => {
      if (res.result && res.result.success) {
        const { totalSteps, totalDays, list, hasMore } = res.result.data;
        
        const newData = {
          myHistory: this.data.page === 0 ? list : this.data.myHistory.concat(list),
          hasMore: hasMore,
          isLoaded: true
        };

        // 仅在第一页更新统计总数
        if (this.data.page === 0) {
          newData.totalSteps = (totalSteps || 0).toLocaleString();
          newData.totalDays = totalDays || 0;
        }

        this.setData(newData);
      }
    }).catch(err => {
      console.error("Fetch history failed:", err);
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideLoading();
      if (callback && typeof callback === 'function') callback();
    });
  },

  /**
   * 删除记录
   */
  async deleteRecord(e) {
    const { id, fileid } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条足迹吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          // wx.vibrateShort();
          wx.showLoading({ title: '正在删除...' });
          
          try {
            const cloudRes = await wx.cloud.callFunction({
              name: 'deletePost',
              data: { postId: id, fileId: fileid }
            });

            if (cloudRes.result && cloudRes.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' });
              // 删除后简单重置并刷新
              this.reload();
            }
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  onPullDownRefresh() {
    this.reload();
    wx.stopPullDownRefresh();
  },

  goToIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});