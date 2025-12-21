const db = wx.cloud.database();

Page({
  data: {
    userInfo: null,
    myHistory: [],
    totalSteps: 0,
    totalDays: 0
  },

  onShow() {
    const user = wx.getStorageSync('userInfo');
    if (user) {
      this.setData({ userInfo: user });
    }
    this.fetchMyHistory();
  },

  // 获取打卡历史记录
  fetchMyHistory() {
    wx.showLoading({ title: 'Loading...' });
    
    wx.cloud.callFunction({
      name: 'getUserStats'
    }).then(res => {
      if (res.result && res.result.success) {
        const { totalSteps, totalDays, list } = res.result.data;
        
        this.setData({
          myHistory: list,
          totalSteps: totalSteps.toLocaleString(), // 仅做最后显示处理
          totalDays: totalDays
        });
      }
      wx.hideLoading();
    }).catch(err => {
      console.error("Cloud call failed:", err);
      wx.hideLoading();
    });
  },

  // 删除记录功能
  async deleteRecord(e) {
    const { id, fileid } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在删除...' });
          
          try {
            const cloudRes = await wx.cloud.callFunction({
              name: 'deletePost',
              data: { 
                postId: id, 
                fileId: fileid 
              }
            });

            if (cloudRes.result && cloudRes.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' });
              this.fetchMyHistory(); // 重新加载列表
            } else {
              throw new Error(cloudRes.result.error);
            }
          } catch (err) {
            console.error("删除失败", err);
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