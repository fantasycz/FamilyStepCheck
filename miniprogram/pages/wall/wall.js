Page({
  data: {
    posts: []
  },

  onShow: function () {
    this.fetchPosts();
  },

  onPullDownRefresh: function () {
    this.fetchPosts();
  },

  fetchPosts: function () {
    wx.showLoading({ title: '加载中...' });
    
    // 调用云函数代替原来的数据库直接查询
    wx.cloud.callFunction({
      name: 'getPosts'
    }).then(res => {
      if (res.result && res.result.success) {
        this.setData({
          posts: res.result.data
        });
      } else {
        wx.showToast({ title: '获取动态失败', icon: 'none' });
      }
      wx.hideLoading();
      wx.stopPullDownRefresh();
    }).catch(err => {
      console.error("Cloud call failed:", err);
      wx.hideLoading();
      wx.stopPullDownRefresh();
    })
  },

  previewImg: function(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return; 
    wx.previewImage({
      urls: [url],
      current: url
    });
  }
});