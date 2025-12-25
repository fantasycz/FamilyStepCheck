// pages/index/index.js
const db = wx.cloud.database();

Page({
  data: {
    // 基础状态
    userInfo: {}, 
    steps: '',
    mood: '',
    tempImgPath: '',
    loading: true, 
    tempAvatar: '',
    inputNickname: '',
    hasUserInfo: false,

    // AI 金句与专属点赞状态
    dailyGold: '正在获取今日动力...',
    goldLikeCount: 0,
    goldIsLiked: false
  },

  async onLoad() {
    const cachedUser = wx.getStorageSync('userInfo');
    const cachedOpenid = wx.getStorageSync('openid');

    // 优先展示缓存提升首屏速度
    if (cachedUser && cachedOpenid) {
      this.setData({ 
        userInfo: cachedUser, 
        hasUserInfo: true 
      });
    }

    // onLoad 时只处理用户状态
    try {
      await this.checkUserRemote();
    } catch (err) {
      console.error("Initialization User Error:", err);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 页面显示时触发
   * 每次回到首页都会执行，确保看到最新的点赞数
   */
  onShow() {
    this.loadDailyGold();
  },

  /**
   * 监听用户下拉动作
   * 提供手动刷新的能力
   */
  async onPullDownRefresh() {
    await this.loadDailyGold();
    wx.stopPullDownRefresh(); // 停止下拉动画
  },

  /**
   * 获取远程用户信息
   */
  async checkUserRemote() {
    try {
      const loginRes = await wx.cloud.callFunction({ name: 'login' });
      const openid = loginRes.result.openid;
      wx.setStorageSync('openid', openid);

      const userRes = await db.collection('users').where({ _openid: openid }).get();

      if (userRes.data && userRes.data.length > 0) {
        const remoteUser = userRes.data[0];
        const userInfo = {
          avatarUrl: remoteUser.avatarUrl || '',
          nickName: remoteUser.nickName || '阳光用户'
        };
        wx.setStorageSync('userInfo', userInfo);
        this.setData({ userInfo, hasUserInfo: true });
      }
    } catch (err) {
      console.error("Remote user check failed:", err);
    }
  },

  /**
   * 加载 AI 金句（含专属点赞数据同步）
   * 逻辑：强制从云端获取最新，失败才用缓存
   */
  async loadDailyGold() {
    const today = new Date().toDateString();
    const openid = wx.getStorageSync('openid') || '';
  
    try {
      // 强制向云端索取最新快照
      const res = await db.collection('system_config').doc('daily_gold').get();
      if (res.data) {
        const likedUsers = res.data.likedUsers || [];
        const dbLikeCount = res.data.likeCount || 0;
        const isLiked = openid ? likedUsers.includes(openid) : false;

        this.setData({ 
          dailyGold: res.data.content,
          goldLikeCount: dbLikeCount,
          goldIsLiked: isLiked
        });
        
        // 同步更新缓存
        wx.setStorageSync('daily_gold', { 
          content: res.data.content, 
          date: today,
          goldLikeCount: dbLikeCount
        });
      }
    } catch (e) {
      console.warn("Fetch gold failed, using cache:", e);
      const cache = wx.getStorageSync('daily_gold');
      if (cache && cache.date === today) {
        this.setData({ 
          dailyGold: cache.content, 
          goldLikeCount: cache.goldLikeCount 
        });
      } else {
        this.setData({ dailyGold: '每一步，都是在重新定义自己。' });
      }
    }
  },

  /**
   * 处理金句点赞 (支持严格身份校验与取消)
   */
  async handleLikeGold() {
    const isLiked = this.data.goldIsLiked;
    const currentCount = this.data.goldLikeCount;
    const openid = wx.getStorageSync('openid');

    if (!openid) {
      return wx.showToast({ title: '请先登录', icon: 'none' });
    }

    // 1. 乐观更新 UI
    this.setData({
      goldIsLiked: !isLiked,
      goldLikeCount: isLiked ? Math.max(0, currentCount - 1) : currentCount + 1
    });

    try {
      const _ = db.command;
      const goldRef = db.collection('system_config').doc('daily_gold');

      if (!isLiked) {
        await goldRef.update({
          data: {
            likeCount: _.inc(1),
            likedUsers: _.addToSet(openid)
          }
        });
        wx.vibrateShort({ type: 'light' }); // 震动反馈
      } else {
        await goldRef.update({
          data: {
            likeCount: _.inc(-1),
            likedUsers: _.pull(openid)
          }
        });
      }
    } catch (err) {
      console.error("Gold like toggle failed:", err);
      // 回滚
      this.setData({
        goldIsLiked: isLiked,
        goldLikeCount: currentCount
      });
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  /**
   * 图片上传与压缩逻辑
   */
  async processAndUploadImage(tempPath, folder) {
    if (!tempPath) return '';
    if (tempPath.startsWith('cloud://')) return tempPath;

    try {
      const fileInfo = await wx.getFileInfo({ filePath: tempPath });
      let finalPath = tempPath;

      if (fileInfo.size > 1024 * 1024) {
        const compressRes = await wx.compressImage({ src: tempPath, quality: 75 });
        finalPath = compressRes.tempFilePath;
      }

      const suffix = /\.[^\.]+$/.exec(finalPath)[0];
      const cloudPath = `${folder}/${Date.now()}-${Math.floor(Math.random() * 1000)}${suffix}`;
      
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: finalPath });
      return uploadRes.fileID;
    } catch (e) {
      console.error("Image process error:", e);
      return '';
    }
  },

  /**
   * 提交打卡数据
   */
  async submitData() {
    const { steps, mood, tempImgPath, userInfo, hasUserInfo, loading } = this.data;
    
    if (loading) return;
    if (!hasUserInfo) return wx.showToast({ title: '请先登录', icon: 'none' });
    
    const stepNum = parseInt(steps);
    if (!steps || isNaN(stepNum) || stepNum <= 0) {
      return wx.showToast({ title: '步数输入有误', icon: 'none' });
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const finalFileID = await this.processAndUploadImage(tempImgPath, 'checkin_pics');

      await wx.cloud.callFunction({
        name: 'addPost',
        data: {
          steps: stepNum,
          mood: (mood || '').trim(),
          imgFileID: finalFileID,
          userInfo: userInfo 
        }
      });

      wx.showToast({ title: '打卡成功', icon: 'success' });
      
      const app = getApp();
      if (app?.globalData) {
        app.globalData.needRefreshRank = true;
        app.globalData.needRefreshWall = true;
      }
      
      this.setData({ steps: '', mood: '', tempImgPath: '' });
      setTimeout(() => { wx.switchTab({ url: '/pages/wall/wall' }); }, 1500);
    } catch (err) {
      console.error("Submission failed:", err);
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  /**
   * 登录逻辑
   */
  async confirmLogin() {
    const { tempAvatar, inputNickname, loading } = this.data;
    if (loading || !tempAvatar || !inputNickname) {
      return wx.showToast({ title: '请完善头像和昵称', icon: 'none' });
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '同步资料...', mask: true });

    try {
      const avatarFileID = await this.processAndUploadImage(tempAvatar, 'avatars');
      const userInfo = { avatarUrl: avatarFileID, nickName: inputNickname };

      await wx.cloud.callFunction({ name: 'syncUserInfo', data: userInfo });

      this.setData({ userInfo, hasUserInfo: true });
      wx.setStorageSync('userInfo', userInfo);
      wx.showToast({ title: '登录成功', icon: 'success' });
    } catch (err) {
      console.error("Login failed:", err);
      wx.showToast({ title: '设置失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  // UI 事件处理
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => { this.setData({ tempImgPath: res.tempFiles[0].tempFilePath }); }
    });
  },

  onChooseAvatar(e) { this.setData({ tempAvatar: e.detail.avatarUrl }); },
  onInputNickname(e) { this.setData({ inputNickname: e.detail.value }); },
  onStepInput(e) { this.setData({ steps: e.detail.value }); },
  onMoodInput(e) { this.setData({ mood: e.detail.value }); }
})