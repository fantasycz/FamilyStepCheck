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
    // 关键点：获取当前用户的 openid
    const openid = wx.getStorageSync('openid');
    
    if (!openid) {
      console.warn("未发现 openid，可能未登录");
      this.setData({ myHistory: [], totalSteps: 0, totalDays: 0 });
      return;
    }

    wx.showLoading({ title: '加载中...' });
    
    // 增加 .where({ _openid: openid }) 过滤条件
    db.collection('check_ins')
      .where({
        _openid: openid // 只查询属于自己的记录
      })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          let total = 0;
          const formatted = res.data.map(item => {
            const stepNum = parseInt(item.steps) || 0;
            total += stepNum;

            return {
              ...item,
              stepsDisplay: stepNum.toLocaleString(),
              // 容错处理：如果服务器时间还没同步，显示“刚刚”
              dateStr: item.createTime ? item.createTime.toLocaleDateString() : '刚刚'
            }
          });
  
          this.setData({
            myHistory: formatted,
            totalSteps: total.toLocaleString(),
            totalDays: res.data.length
          });
        } else {
          this.setData({ myHistory: [], totalSteps: 0, totalDays: 0 });
        }
        wx.hideLoading();
      })
      .catch(err => {
        console.error("查询失败：", err);
        wx.hideLoading();
      });
  },

  // 删除记录功能（保持原样，增加逻辑严谨性）
  async deleteRecord(e) {
    const { id, fileid } = e.currentTarget.dataset;
    const openid = wx.getStorageSync('openid');

    wx.showModal({
      title: '删除确认',
      content: '确定要删除这条打卡记录吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在删除...', mask: true });
          try {
            // 明确指定 _openid 确保只能删自己的
            await db.collection('check_ins').where({
              _id: id,
              _openid: openid 
            }).remove();

            if (fileid) {
              await wx.cloud.deleteFile({ fileList: [fileid] });
            }

            wx.showToast({ title: '删除成功', icon: 'success' });
            this.fetchMyHistory();
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