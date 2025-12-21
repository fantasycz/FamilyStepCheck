// pages/wall/wall.js
Page({
  data: {
    posts: [],
    page: 0,
    hasMore: true,
    loading: false
  },

  onShow() {
    this.reload();
  },

  reload() {
    this.setData({ page: 0, hasMore: true, posts: [] }, () => {
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
   * 获取动态列表 - 增加分页与状态处理
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
      console.error("Load failed", err);
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideNavigationBarLoading();
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 核心功能：点赞/取消点赞 (2025-12-18 需求)
   * 采用“乐观更新”策略，提升交互流畅度
   */
  async onLike(e) {
    const postId = e.currentTarget.dataset.id;
    const posts = this.data.posts;
    const index = posts.findIndex(item => item._id === postId);
    
    if (index === -1) return;

    // 1. 乐观更新：先修改本地数据，让用户瞬间看到效果
    const item = posts[index];
    const isLiked = !item.isLiked;
    const likeCount = isLiked ? (item.likeCount + 1) : Math.max(0, item.likeCount - 1);

    // 瞬间更新 UI
    this.setData({
      [`posts[${index}].isLiked`]: isLiked,
      [`posts[${index}].likeCount`]: likeCount
    });

    // 触发震动反馈 (让点赞更有手感)
    wx.vibrateShort({ type: 'light' });

    try {
      // 2. 静默调用云函数
      const res = await wx.cloud.callFunction({
        name: 'toggleLike',
        data: { postId }
      });

      if (!res.result || !res.result.success) {
        throw new Error('Server Error');
      }
    } catch (err) {
      // 3. 错误回滚：如果后端失败，把状态改回去
      console.error("Like failed, rolling back...", err);
      this.setData({
        [`posts[${index}].isLiked`]: item.isLiked,
        [`posts[${index}].likeCount`]: item.likeCount
      });
      wx.showToast({ title: '点赞失败', icon: 'none' });
    }
  },

  /**
   * 图片预览优化：清洗 Image Pipeline 参数
   */
  previewImg(e) {
    let url = e.currentTarget.dataset.url;
    // 如果包含 CDN 处理参数（如 WebP、缩略图），预览时去掉它们以显示原图
    if (url.includes('?')) {
      url = url.split('?')[0];
    }
    wx.previewImage({
      urls: [url],
      current: url
    });
  }
});