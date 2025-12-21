// rank/rank.js
Page({
  data: {
    currentTab: 'all', 
    rankList: []
  },

  onShow() {
    this.getRankData();
  },

  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (this.data.currentTab === type) return;
    this.setData({ currentTab: type, rankList: [] });
    this.getRankData();
  },

  getRankData() {
    wx.showLoading({ title: '加载中...' });
    const isSevenDays = this.data.currentTab === 'seven';

    // 调用云函数，把计算工作交给服务器
    wx.cloud.callFunction({
      name: 'getRank',
      data: { isSevenDays }
    }).then(res => {
      if (res && res.result && res.result.success) {
        const list = res.result.list || [];
        const formattedData = list.map(item => ({
          ...item,
          stepsDisplay: (Number(item.totalSteps) || 0).toLocaleString()
        }));

        this.setData({ rankList: formattedData });
      } else {
        this.setData({ rankList: [] });
        console.error("计算失败", res.result.error);
      }
      wx.hideLoading();
    }).catch(err => {
      this.setData({ rankList: [] });
      console.error("云函数调用失败", err);
      wx.hideLoading();
    });
  }
});