// pages/index/index.js
const db = wx.cloud.database();

Page({
  data: {
    // 关键修复：初始值设为空对象 {} 而非 null
    userInfo: {}, 
    steps: '',
    mood: '',
    tempImgPath: '',
    loading: true, 
    tempAvatar: '',
    inputNickname: '',
    hasUserInfo: false // 增加一个布尔值用于 WXML 的判断，更安全
  },

  async onLoad() {
    const cachedUser = wx.getStorageSync('userInfo');
    const cachedOpenid = wx.getStorageSync('openid');

    if (cachedUser && cachedOpenid) {
      this.setData({ 
        userInfo: cachedUser, 
        hasUserInfo: true,
        loading: false 
      });
      return;
    }

    this.checkUserRemote();
  },

  async checkUserRemote() {
    wx.showLoading({ title: '检查状态...', mask: true });
    try {
      const loginRes = await wx.cloud.callFunction({ name: 'login' });
      const openid = loginRes.result.openid;
      wx.setStorageSync('openid', openid);

      const userRes = await db.collection('users').where({ _openid: openid }).get();

      const userData = userRes.data || [];
      if (userData && userRes.data.length > 0) {
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
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  async processAndUploadImage(tempPath, folder) {
    if (!tempPath) return '';
    if (tempPath.startsWith('cloud://')) return tempPath;

    try {
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
    } catch (e) {
      console.error("Image process error:", e);
      return '';
    }
  },

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
      const userInfo = { avatarUrl: avatarFileID, nickName: inputNickname };

      await wx.cloud.callFunction({
        name: 'syncUserInfo',
        data: userInfo
      });

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

  async submitData() {
    const { steps, mood, tempImgPath, userInfo, hasUserInfo, loading } = this.data;
    
    if (loading) return;
    if (!hasUserInfo) return wx.showToast({ title: '请先登录', icon: 'none' });
    
    const cleanMood = (mood || '').trim(); 
    const stepNum = parseInt(steps);

    if (!steps) return wx.showToast({ title: '请填写步数', icon: 'none' });
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
          userInfo: userInfo // 此时 userInfo 是个对象，安全
        }
      });

      wx.showToast({ title: '打卡成功', icon: 'success' });
      
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.needRefreshRank = true;
        app.globalData.needRefreshWall = true;
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

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
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