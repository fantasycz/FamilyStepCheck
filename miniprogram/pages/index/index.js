// pages/index/index.js
const db = wx.cloud.database();

Page({
  /**
   * Page initial data
   */
  data: {
    userInfo: null,
    steps: '',
    mood: '',
    tempImgPath: '',
    loading: false,
    tempAvatar: '',
    inputNickname: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  async onLoad() {
    const cachedUser = wx.getStorageSync('userInfo');
    const cachedOpenid = wx.getStorageSync('openid');

    if (cachedUser) {
      this.setData({ userInfo: cachedUser });
      
      // Silently recover openid if missing
      if (!cachedOpenid) {
        try {
          const loginRes = await wx.cloud.callFunction({ name: 'login' });
          wx.setStorageSync('openid', loginRes.result.openid);
        } catch (err) {
          console.error("Failed to recover openid silently:", err);
        }
      }
    }
  },

  /**
   * Avatar and Nickname Setup
   */
  onChooseAvatar(e) {
    this.setData({ tempAvatar: e.detail.avatarUrl });
  },

  onInputNickname(e) {
    this.setData({ inputNickname: e.detail.value });
  },

  async confirmLogin() {
    const { tempAvatar, inputNickname } = this.data;
    if (!tempAvatar) return wx.showToast({ title: 'Please select avatar', icon: 'none' });
    if (!inputNickname) return wx.showToast({ title: 'Please enter nickname', icon: 'none' });

    wx.showLoading({ title: 'Syncing profile...', mask: true });

    try {
      // 1. Upload Avatar to Cloud Storage
      const suffix = /\.[^\.]+$/.exec(tempAvatar)[0]; 
      const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random()*1000)}${suffix}`;
      
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempAvatar
      });

      // 2. Fetch OpenID
      const loginRes = await wx.cloud.callFunction({ name: 'login' });
      const openid = loginRes.result.openid;
      wx.setStorageSync('openid', openid); 

      // 3. Save User Info locally
      const userInfo = {
        avatarUrl: uploadRes.fileID,
        nickName: inputNickname
      };
      this.setData({ userInfo });
      wx.setStorageSync('userInfo', userInfo);

      wx.showToast({ title: 'Login Success', icon: 'success' });
    } catch (err) {
      console.error("Login failed:", err);
      wx.showToast({ title: 'Setup Failed', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * Main Check-in Logic
   */
  async submitData() {
    const { steps, mood, tempImgPath, userInfo, loading } = this.data;
    
    // Safety checks
    if (loading) return;
    if (!userInfo) return wx.showToast({ title: 'Please login first', icon: 'none' });
    
    const cleanMood = mood.trim();
    const stepNum = parseInt(steps);

    if (!steps || !cleanMood) return wx.showToast({ title: 'Please fill all fields', icon: 'none' });
    if (isNaN(stepNum) || stepNum <= 0) return wx.showToast({ title: 'Invalid steps', icon: 'none' });

    this.setData({ loading: true });

    try {
      // 1. Image Upload (if selected)
      let finalFileID = '';
      if (tempImgPath) {
        const suffix = /\.[^\.]+$/.exec(tempImgPath)[0];
        const cloudPath = `checkin_pics/${Date.now()}-${Math.floor(Math.random()*1000)}${suffix}`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: tempImgPath
        });
        finalFileID = uploadRes.fileID;
      }

      // 2. Add post via Cloud Function
      await wx.cloud.callFunction({
        name: 'addPost',
        data: {
          steps: stepNum,
          mood: cleanMood,
          imgFileID: finalFileID,
          userInfo: userInfo
        }
      });

      // 3. Success Feedback
      wx.vibrateShort(); // Haptic feedback
      wx.showToast({ title: 'Check-in Success', icon: 'success' });
      
      // Clear inputs
      this.setData({ steps: '', mood: '', tempImgPath: '' });
      
      // Redirect to Wall
      setTimeout(() => {
        wx.switchTab({ url: '/pages/wall/wall' });
      }, 1500);

    } catch (err) {
      console.error("Submission failed:", err);
      wx.showToast({ title: 'Submit Failed', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * Helper functions
   */
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