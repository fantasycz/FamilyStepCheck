const db = wx.cloud.database();

Page({
  data: {
    posts: []
  },

  onShow: function () {
    // 尝试获取缓存里的用户信息用于头像显示
    const user = wx.getStorageSync('userInfo');
    if (user) {
      this.setData({ userInfo: user });
    }
    // 每次进入页面都刷新数据
    this.fetchPosts();
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.fetchPosts();
  },

  fetchPosts: function () {
    wx.showLoading({ title: '加载中...' });
    
    db.collection('check_ins')
      .orderBy('createTime', 'desc') // 按时间倒序
      .get()
      .then(res => {
        // 格式化日期和步数显示
        const formattedData = res.data.map(item => {
          const date = item.createTime;
          
          // 1. 日期格式化优化（增加分钟补零）
          let dateString = '刚刚';
          if (date) {
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const hours = date.getHours();
            const minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes(); // 补零逻辑
            dateString = `${month}月${day}日 ${hours}:${minutes}`;
          }

          return {
            ...item,
            dateStr: dateString,
            // 2. 核心修改：增加千分位展示字段
            // 先强制转为数字 Number()，再转为千分位字符串 toLocaleString()
            stepsDisplay: (Number(item.steps) || 0).toLocaleString()
          }
        });
        
        this.setData({
          posts: formattedData
        });
        wx.hideLoading();
        wx.stopPullDownRefresh(); // 停止下拉刷新动画
      })
      .catch(err => {
        console.error("读取失败", err);
        wx.hideLoading();
      })
  },

  // 点击图片预览大图
  previewImg: function(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return; 

    wx.showLoading({ title: '加载图片...', mask: true });

    wx.previewImage({
      urls: [url], // 预览图列表
      current: url, // 当前显示的图片url
      success: () => {
        wx.hideLoading();
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '预览失败', icon: 'none' });
      }
    });
  }
});