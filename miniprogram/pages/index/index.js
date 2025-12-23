// pages/index/index.js
const db = wx.cloud.database();

Page({
  data: {
    userInfo: null,
    steps: '',
    mood: '',
    tempImgPath: '',
    loading: true, // 初始设为 true，等待检查登录状态
    tempAvatar: '',
    inputNickname: ''
  },

  async onLoad() {
    const cachedUser = wx.getStorageSync('userInfo');
    const cachedOpenid = wx.getStorageSync('openid');

    // 1. 如果本地有缓存，先直接展示
    if (cachedUser && cachedOpenid) {
      this.setData({ userInfo: cachedUser, loading: false });
      return;
    }

    // 2. 如果本地没缓存或信息不全，执行静默登录并检查远程数据库
    this.checkUserRemote();
  },

  /**
   * 检查远程数据库是否存在用户信息
   */
  async checkUserRemote() {
    wx.showLoading({ title: '检查状态...', mask: true });
    try {
      // 获取/恢复 OpenID
      const loginRes = await wx.cloud.callFunction({ name: 'login' });
      const openid = loginRes.result.openid;
      wx.setStorageSync('openid', openid);

      // 从云数据库查询用户信息 (假设集合名为 'users')
      const userRes = await db.collection('users').where({ _openid: openid }).get();

      if (userRes.data.length > 0) {
        const remoteUser = userRes.data[0];
        const userInfo = {
          avatarUrl: remoteUser.avatarUrl,
          nickName: remoteUser.nickName
        };
        // 自动填充缓存并更新 UI
        wx.setStorageSync('userInfo', userInfo);
        this.setData({ userInfo });
      }
    } catch (err) {
      console.error("Remote user check failed:", err);
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  /**
   * 核心优化：封装图片处理逻辑 (压缩 + 上传)
   */
  async processAndUploadImage(tempPath, folder) {
    if (!tempPath) return '';
    // 如果已经是云路径，直接返回
    if (tempPath.startsWith('cloud://')) return tempPath;

    const fileInfo = await wx.getFileInfo({ filePath: tempPath });
    let finalPath = tempPath;

    if (fileInfo.size > 1024 * 1024) {
      const compressRes = await wx.compressImage({
        src: tempPath,
        quality: 75 
      });
      finalPath = compressRes.tempFilePath;
    }

    const suffix = /\.[^\.]+$/.exec(finalPath)[0];
    const cloudPath = `${folder}/${Date.now()}-${Math.floor(Math.random() * 1000)}${suffix}`;
    
    const uploadRes = await wx.cloud.uploadFile({
      cloudPath,
      filePath: finalPath
    });
    return uploadRes.fileID;
  },

  /**
   * 登录设置逻辑优化：增加数据库存储
   */
  async confirmLogin() {
    const { tempAvatar, inputNickname, loading } = this.data;
    if (loading) return;
    if (!tempAvatar || !inputNickname) {
      return wx.showToast({ title: '请完善头像和昵称', icon: 'none' });
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '同步资料...', mask: true });

    try {
      const avatarFileID = await this.processAndUploadImage(tempAvatar, 'avatars');
      
      const loginRes = await wx.cloud.callFunction({ name: 'login' });
      const openid = loginRes.result.openid;
      wx.setStorageSync('openid', openid);

      const userInfo = { avatarUrl: avatarFileID, nickName: inputNickname };

      // 【关键】将用户信息保存到远程数据库，以便下次自动登录
      // 使用 _openid 作为唯一标识，采用云数据库的高级操作
      await wx.cloud.callFunction({
        name: 'syncUserInfo', // 建议创建一个简单的同步云函数
        data: userInfo
      });

      this.setData({ userInfo });
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

  /**
   * 打卡提交逻辑优化
   */
  async submitData() {
    const { steps, mood, tempImgPath, userInfo, loading } = this.data;
    
    if (loading) return;
    if (!userInfo) return wx.showToast({ title: '请先登录', icon: 'none' });
    
    const cleanMood = mood.trim(); 
    const stepNum = parseInt(steps);

    if (!steps) {
      return wx.showToast({ title: '请填写步数', icon: 'none' });
    }
    if (isNaN(stepNum) || stepNum <= 0) return wx.showToast({ title: '步数输入有误', icon: 'none' });

    this.setData({ loading: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const finalFileID = await this.processAndUploadImage(tempImgPath, 'checkin_pics');

      await wx.cloud.callFunction({
        name: 'addPost',
        data: {
          steps: stepNum,
          mood: cleanMood,
          imgFileID: finalFileID,
          userInfo: userInfo
        }
      });

      wx.showToast({ title: '打卡成功', icon: 'success' });
      const app = getApp(); // 获取实例
      if (app && app.globalData) {
        getApp().globalData.needRefreshRank = true;
      }
      this.setData({ steps: '', mood: '', tempImgPath: '' });
      
      setTimeout(() => {
        wx.switchTab({ url: '/pages/wall/wall' });
      }, 1500);

    } catch (err) {
      console.error("Submission failed:", err);
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  /**
   * UI 事件
   */
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        this.setData({ tempImgPath: res.tempFiles[0].tempFilePath });
      }
    });
  },

  onChooseAvatar(e) { this.setData({ tempAvatar: e.detail.avatarUrl }); },
  onInputNickname(e) { this.setData({ inputNickname: e.detail.value }); },
  onStepInput(e) { this.setData({ steps: e.detail.value }); },
  onMoodInput(e) { this.setData({ mood: e.detail.value }); }
})