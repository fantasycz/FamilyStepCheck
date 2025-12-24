// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // 建议使用 DYNAMIC_CURRENT_ENV 增强兼容性
        env: 'cloud1-2gvncjxsd6c56ec9',
        traceUser: true,
      });
    }

    // --- 初始化 globalData ---
    this.globalData = {
      needRefreshRank: false,
      needRefreshWall: false,
      // 关键修复：初始值设为空对象，且增加一个 loaded 标记
      userInfo: {}, 
      userLoaded: false
    };
  },

  // 提供一个全局方法更新用户信息，确保格式统一
  setGlobalUserInfo: function(user) {
    this.globalData.userInfo = user || {};
    this.globalData.userLoaded = !!user;
  }
});