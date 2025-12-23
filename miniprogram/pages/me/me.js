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
    this.checkLoginStatus();
    
    if (this.data.userInfo) {
      // --- 优化点 1：首次显示时尝试从本地缓存加载 ---
      if (!this.data.isLoaded) {
        this.loadCache();
      }
      this.reload();
    } else {
      this.setData({ myHistory: [], totalSteps: '0', totalDays: 0, isLoaded: false });
    }
  },

  // --- 优化点 2：读取本地存储的方法 ---
  loadCache() {
    const cache = wx.getStorageSync('me_page_data');
    if (cache) {
      console.log("Loading from local cache...");
      this.setData({
        myHistory: cache.list || [],
        totalSteps: (cache.totalSteps || 0).toLocaleString(),
        totalDays: cache.totalDays || 0,
        isLoaded: true // 标记已加载，这样 fetch 时就不会显示全屏 Loading
      });
    }
  },

  checkLoginStatus() {
    const user = wx.getStorageSync('userInfo');
    if (user) {
      this.setData({ userInfo: user });
    } else {
      this.setData({ userInfo: null });
    }
  },

  reload() {
    // 重置页码，开始获取最新数据
    this.setData({ page: 0, hasMore: true }, () => {
      this.fetchMyHistory();
    });
  },

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
  fetchMyHistory() {
    if (this.data.loading) return;

    this.setData({ loading: true });
    
    // 如果已经有缓存数据（isLoaded为true），则不再显示干扰用户的全屏 Loading
    if (!this.data.isLoaded) {
      wx.showLoading({ title: 'Loading...', mask: true });
    }
    
    wx.cloud.callFunction({
      name: 'getUserStats',
      data: {
        page: this.data.page,
        pageSize: 10
      }
    }).then(res => {
      if (res.result && res.result.success) {
        const { totalSteps, totalDays, list, hasMore } = res.result.data;
        
        const updateData = {
          myHistory: this.data.page === 0 ? list : this.data.myHistory.concat(list),
          hasMore: hasMore,
          isLoaded: true
        };

        if (this.data.page === 0) {
          updateData.totalSteps = (totalSteps || 0).toLocaleString();
          updateData.totalDays = totalDays || 0;

          // --- 优化点 3：将第一页数据存入本地缓存 ---
          wx.setStorage({
            key: 'me_page_data',
            data: { list, totalSteps, totalDays }
          });
        }

        this.setData(updateData);
      }
    }).catch(err => {
      console.error("Fetch history failed:", err);
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideLoading();
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
          wx.showLoading({ title: '正在删除...' });
          
          try {
            const cloudRes = await wx.cloud.callFunction({
              name: 'deletePost',
              data: { postId: id, fileId: fileid }
            });

            if (cloudRes.result && cloudRes.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' });
              
              // --- 优化点 4：删除成功后同时清空本地缓存，强制下次刷新 ---
              wx.removeStorageSync('me_page_data');
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