const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const API_KEY = process.env.DEEPSEEK_API_KEY; // 自动从环境变量读取
  
  try {
    const res = await axios({
      method: 'post',
      url: 'https://api.deepseek.com/chat/completions',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      data: {
        model: "deepseek-chat",
        messages: [{
          role: "system",
          content: "你是一位融合了哲理与力量感的运动导师。生成一句激励打卡的金句，20字以内，拒绝鸡汤，要硬核、有质感。"
        }]
      },
      timeout: 10000
    });

    const sentence = res.data.choices[0].message.content;

    // 更新到数据库配置表
    await db.collection('system_config').doc('daily_gold').set({
      data: {
        content: sentence,
        updateTime: Date.now()
      }
    });

    return sentence;
  } catch (err) {
    console.error(err);
    return null;
  }
};