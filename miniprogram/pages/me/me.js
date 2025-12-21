// pages/me/me.js
const db = wx.cloud.database();

Page({
  data: {
    userInfo: null,
    myHistory: [],
    totalSteps: '0', // 初始设为字符串，保持显示一致性
    totalDays: 0,
    isLoaded: false // 标记是否已完成首次加载，用于控制骨架屏或显示逻辑
  },

  onShow() {
    this.checkLoginStatus();
    this.fetchMyHistory();
  },

  // 检查登录状态
  checkLoginStatus() {
    const user = wx.getStorageSync('userInfo');
    if (user) {
      this.setData({ userInfo: user });
    } else {
      this.setData({ userInfo: null });
    }
  },

  /**
   * Fetch History via Cloud Function
   * @param {Function} callback - 用于下拉刷新完成后的回调
   */
  fetchMyHistory(callback = null) {
    // 如果没有获取到 openid 缓存，且未登录，不触发加载（节省资源）
    if (!wx.getStorageSync('userInfo')) {
      this.setData({ myHistory: [], totalSteps: '0', totalDays: 0, isLoaded: true });
      if (callback) callback();
      return;
    }

    if (!this.data.isLoaded) wx.showLoading({ title: 'Loading...', mask: true });
    
    wx.cloud.callFunction({
      name: 'getUserStats'
    }).then(res => {
      if (res.result && res.result.success) {
        const { totalSteps, totalDays, list } = res.result.data;
        
        this.setData({
          myHistory: list,
          totalSteps: (totalSteps || 0).toLocaleString(),
          totalDays: totalDays || 0,
          isLoaded: true
        });
      }
    }).catch(err => {
      console.error("Cloud call failed:", err);
      wx.showToast({ title: 'Load Failed', icon: 'none' });
    }).finally(() => {
      wx.hideLoading();
      if (callback) callback(); // 停止下拉刷新动画
    });
  },

  /**
   * Delete Record with confirmation and haptic feedback
   */
  async deleteRecord(e) {
    const { id, fileid } = e.currentTarget.dataset;

    wx.showModal({
      title: 'Delete Confirm',
      content: 'Are you sure you want to delete this record?',
      confirmColor: '#ff4d4f',
      confirmText: 'Delete',
      success: async (res) => {
        if (res.confirm) {
          wx.vibrateShort(); // Haptic feedback before action
          wx.showLoading({ title: 'Deleting...', mask: true });
          
          try {
            const cloudRes = await wx.cloud.callFunction({
              name: 'deletePost',
              data: { postId: id, fileId: fileid }
            });

            if (cloudRes.result && cloudRes.result.success) {
              wx.showToast({ title: 'Deleted', icon: 'success' });
              // 这里的优化：不再全文刷新，可以手动过滤 data 里的列表，提升速度
              const updatedList = this.data.myHistory.filter(item => item._id !== id);
              this.setData({ myHistory: updatedList });
              
              // 重新获取统计数据（或者在前端简单减去对应的步数）
              this.fetchMyHistory(); 
            } else {
              throw new Error(cloudRes.result.error);
            }
          } catch (err) {
            console.error("Delete failed:", err);
            wx.showToast({ title: 'Delete Failed', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  /**
   * Manual Pull Down Refresh
   */
  onPullDownRefresh() {
    this.fetchMyHistory(() => {
      wx.stopPullDownRefresh();
    });
  },

  goToIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});