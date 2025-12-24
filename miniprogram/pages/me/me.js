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
      // 首次显示时尝试从本地缓存加载
      if (!this.data.isLoaded) {
        this.loadCache();
      }
      this.reload();
    } else {
      this.setData({ myHistory: [], totalSteps: '0', totalDays: 0, isLoaded: false });
    }
  },

  /**
   * 核心修改：下拉刷新监听
   */
  onPullDownRefresh() {
    console.log("Me: 用户触发下拉刷新");
    
    // 1. 强制清空本地存储，确保拿到最实时的数据
    wx.removeStorageSync('me_page_data');
    
    // 2. 重置加载状态，让 fetchMyHistory 显示 Loading 提示
    this.setData({ 
      isLoaded: false,
      page: 0,
      hasMore: true 
    }, () => {
      // 3. 执行加载，并在完成后停止下拉动画
      this.fetchMyHistory(true);
    });
  },

  // 读取本地存储的方法
  loadCache() {
    const cache = wx.getStorageSync('me_page_data');
    if (cache) {
      console.log("Loading from local cache...");
      this.setData({
        myHistory: cache.list || [],
        totalSteps: (cache.totalSteps || 0).toLocaleString(),
        totalDays: cache.totalDays || 0,
        isLoaded: true 
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
    this.setData({ page: 0, hasMore: true }, () => {
      this.fetchMyHistory(false);
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.fetchMyHistory(false);
      });
    }
  },

  /**
   * 获取历史数据
   * @param {boolean} isPullRefresh - 是否来自下拉刷新
   */
  fetchMyHistory(isPullRefresh = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });
    
    // 如果没有缓存或正在下拉刷新，显示 Loading 提示
    if (!this.data.isLoaded || isPullRefresh) {
      wx.showLoading({ title: '更新中...', mask: true });
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
          myHistory: this.data.page === 0 ? list : this.data.myHistory.concat(list || []),
          hasMore: hasMore,
          isLoaded: true
        };

        if (this.data.page === 0) {
          updateData.totalSteps = (totalSteps || 0).toLocaleString();
          updateData.totalDays = totalDays || 0;

          // 将第一页数据存入本地缓存
          wx.setStorage({
            key: 'me_page_data',
            data: { list, totalSteps, totalDays }
          });
        }

        this.setData(updateData);
      }
    }).catch(err => {
      console.error("Fetch history failed:", err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideLoading();
      // 停止下拉刷新的三个点动画
      wx.stopPullDownRefresh();
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

              const app = getApp();
              if (app.globalData) {
                app.globalData.needRefreshWall = true; 
                app.globalData.needRefreshRank = true; 
              }
              
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

  goToIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});