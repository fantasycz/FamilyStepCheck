// pages/index/index.js
const db = wx.cloud.database();

Page({
  data: {
    userInfo: null,
    steps: '',
    mood: '',
    tempImgPath: '',
    loading: false,
    tempAvatar: '',
    inputNickname: ''
  },

  async onLoad() {
    const cachedUser = wx.getStorageSync('userInfo');
    const cachedOpenid = wx.getStorageSync('openid');

    if (cachedUser) {
      this.setData({ userInfo: cachedUser });
      if (!cachedOpenid) {
        try {
          const loginRes = await wx.cloud.callFunction({ name: 'login' });
          wx.setStorageSync('openid', loginRes.result.openid);
        } catch (err) {
          console.error("OpenID recovery failed:", err);
        }
      }
    }
  },

  /**
   * 1. 核心优化：封装图片处理逻辑 (压缩 + 上传)
   * @param {string} tempPath - 临时文件路径
   * @param {string} folder - 云端存储文件夹名
   */
  async processAndUploadImage(tempPath, folder) {
    if (!tempPath) return '';

    // 第一步：获取文件信息，判断是否需要进一步压缩
    const fileInfo = await wx.getFileInfo({ filePath: tempPath });
    let finalPath = tempPath;

    // 如果图片大于 1MB，进行质量压缩
    if (fileInfo.size > 1024 * 1024) {
      const compressRes = await wx.compressImage({
        src: tempPath,
        quality: 75 // 建议 70-80 之间，肉眼几乎看不出区别但体积减小显著
      });
      finalPath = compressRes.tempFilePath;
    }

    // 第二步：上传
    const suffix = /\.[^\.]+$/.exec(finalPath)[0];
    const cloudPath = `${folder}/${Date.now()}-${Math.floor(Math.random() * 1000)}${suffix}`;
    
    const uploadRes = await wx.cloud.uploadFile({
      cloudPath,
      filePath: finalPath
    });
    return uploadRes.fileID;
  },

  /**
   * 登录设置逻辑优化
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
      // 使用封装好的上传函数 (头像也进行压缩，节省空间)
      const avatarFileID = await this.processAndUploadImage(tempAvatar, 'avatars');

      const loginRes = await wx.cloud.callFunction({ name: 'login' });
      const openid = loginRes.result.openid;
      wx.setStorageSync('openid', openid);

      const userInfo = { avatarUrl: avatarFileID, nickName: inputNickname };
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

    if (!steps || !cleanMood) return wx.showToast({ title: '请填写步数和心情', icon: 'none' });
    if (isNaN(stepNum) || stepNum <= 0) return wx.showToast({ title: '步数输入有误', icon: 'none' });

    this.setData({ loading: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      // 使用处理函数：如果是原图会在这里被自动二压
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
      sizeType: ['compressed'], // 系统初步压缩
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