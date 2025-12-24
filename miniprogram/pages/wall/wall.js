// pages/wall/wall.js
Page({
  data: {
    posts: [],
    page: 0,
    hasMore: true,
    loading: false,
    likeLoading: false // 点赞防抖标记
  },

  onShow() {
    const app = getApp();
    // 检查是否有来自“我的”页面（删除）或“首页”（新增）的刷新信号
    if (app.globalData && app.globalData.needRefreshWall) {
      console.log("Wall: 收到刷新信号，正在重载数据...");
      app.globalData.needRefreshWall = false; // 消耗信号
      this.reload(); // 执行你现有的 reload 函数
    } else {
      // 只有在页面栈刚建立且没有数据时才自动加载一次
      if (this.data.posts.length === 0) {
        this.reload();
      }
    }
  },

  /**
   * 刷新页面
   */
  reload() {
    this.setData({ 
      page: 0, 
      hasMore: true, 
      posts: [] 
    }, () => {
      this.fetchPosts();
    });
  },

  onPullDownRefresh() {
    this.reload();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.fetchPosts();
      });
    }
  },

  /**
   * 获取动态列表
   */
  fetchPosts() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    wx.showNavigationBarLoading();

    wx.cloud.callFunction({
      name: 'getPosts',
      data: {
        page: this.data.page,
        pageSize: 15
      }
    }).then(res => {
      if (res.result && res.result.success) {
        const newPosts = res.result.data;
        this.setData({
          posts: this.data.page === 0 ? newPosts : this.data.posts.concat(newPosts),
          hasMore: res.result.hasMore
        });
      }
    }).catch(err => {
      console.error("Load posts failed:", err);
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideNavigationBarLoading();
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 核心功能：点赞/取消点赞
   * 策略：乐观更新 + 异常回滚 (已移除震动)
   */
  async onLike(e) {
    const { id, index } = e.currentTarget.dataset;
    const posts = this.data.posts;
    const item = posts[index];
    
    // 1. 防抖处理
    if (this.data.likeLoading || !item) return;

    // 2. 暂存当前状态用于失败时回滚
    const originalIsLiked = item.isLiked;
    const originalLikeCount = item.likeCount;

    // 3. 计算新状态
    const newIsLiked = !originalIsLiked;
    const newLikeCount = newIsLiked ? (originalLikeCount + 1) : Math.max(0, originalLikeCount - 1);

    // 4. 【乐观更新】瞬间修改 UI
    this.setData({
      [`posts[${index}].isLiked`]: newIsLiked,
      [`posts[${index}].likeCount`]: newLikeCount
    });

    try {
      this.data.likeLoading = true;

      // 5. 后端静默同步
      const res = await wx.cloud.callFunction({
        name: 'toggleLike',
        data: { postId: id }
      });

      // 校验后端返回
      if (!res || !res.result || res.result.success !== true) {
        throw new Error('Server side process failed');
      }

    } catch (err) {
      console.error("Like synchronization failed:", err);
      
      // 6. 【异常回滚】恢复 UI 状态
      this.setData({
        [`posts[${index}].isLiked`]: originalIsLiked,
        [`posts[${index}].likeCount`]: originalLikeCount
      });

      wx.showToast({
        title: '网络连接不稳定',
        icon: 'none'
      });
    } finally {
      this.data.likeLoading = false;
    }
  },

  /**
   * 图片预览
   */
  previewImg(e) {
    let url = e.currentTarget.dataset.url;
    if (url && url.includes('?')) {
      url = url.split('?')[0];
    }
    wx.previewImage({
      urls: [url],
      current: url
    });
  }
});