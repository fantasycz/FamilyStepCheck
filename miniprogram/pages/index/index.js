const db = wx.cloud.database();

Page({
  data: {
    userInfo: null,
    steps: '',
    mood: '',
    tempImgPath: '',
    loading: false,
    tempAvatar: '',
    inputNickname: '',
    someList: [],
    // posts: [],
    // rankList: [],
    myHistory: []
  },

  // 修改 onLoad：确保老用户也能补全 openid 缓存
  async onLoad() {
    const cachedUser = wx.getStorageSync('userInfo');
    const cachedOpenid = wx.getStorageSync('openid');

    if (cachedUser) {
      this.setData({ userInfo: cachedUser });
      
      // 关键修复：如果缓存里有用户但没有 openid (刚更新代码的情况)
      if (!cachedOpenid) {
        console.log("检测到缺少 openid，正在静默补全...");
        try {
          const loginRes = await wx.cloud.callFunction({ name: 'login' });
          wx.setStorageSync('openid', loginRes.result.openid);
          console.log("openid 补全成功");
        } catch (err) {
          console.error("静默获取 openid 失败", err);
        }
      }
    }
  },

  onChooseAvatar(e) {
    this.setData({ tempAvatar: e.detail.avatarUrl });
  },

  onInputNickname(e) {
    this.setData({ inputNickname: e.detail.value });
  },

  async confirmLogin() {
    const { tempAvatar, inputNickname } = this.data;
    if (!tempAvatar) return wx.showToast({ title: '请选择头像', icon: 'none' });
    if (!inputNickname) return wx.showToast({ title: '请输入昵称', icon: 'none' });

    wx.showLoading({ title: '资料同步中...' });

    try {
      // 1. 上传头像
      const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random()*1000)}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempAvatar
      });

      // 2. 获取并存储 OpenID
      const loginRes = await wx.cloud.callFunction({ name: 'login' });
      const openid = loginRes.result.openid;
      wx.setStorageSync('openid', openid); 

      // 3. 存储用户信息
      const userInfo = {
        avatarUrl: uploadRes.fileID,
        nickName: inputNickname
      };
      this.setData({ userInfo });
      wx.setStorageSync('userInfo', userInfo);

      wx.showToast({ title: '设置成功', icon: 'success' });
    } catch (err) {
      console.error("设置个人信息失败：", err);
      wx.showToast({ title: '设置失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async submitData() {
    const { steps, mood, tempImgPath, userInfo } = this.data;
    if (!userInfo) return wx.showToast({ title: '请先完成登录设置', icon: 'none' });
    if (!steps || !mood) return wx.showToast({ title: '请填写步数和感想', icon: 'none' });

    this.setData({ loading: true });

    try {
      let finalFileID = '';
      if (tempImgPath) {
        const cloudPath = `checkin_pics/${Date.now()}-${Math.floor(Math.random()*1000)}.jpg`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempImgPath
        });
        finalFileID = uploadRes.fileID;
      }

      await db.collection('check_ins').add({
        data: {
          steps: Number(steps),
          mood: mood,
          imgFileID: finalFileID,
          userInfo: userInfo,
          createTime: db.serverDate()
        }
      });

      wx.showToast({ title: '打卡成功', icon: 'success' });
      this.setData({ steps: '', mood: '', tempImgPath: '' });
      setTimeout(() => { wx.switchTab({ url: '/pages/wall/wall' }); }, 1500);
    } catch (err) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => { this.setData({ tempImgPath: res.tempFilePaths[0] }); }
    });
  },
  
  onStepInput(e) { this.setData({ steps: e.detail.value }); },
  onMoodInput(e) { this.setData({ mood: e.detail.value }); }
})