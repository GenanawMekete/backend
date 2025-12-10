const crypto = require('crypto');

class TelegramConfig {
  constructor() {
    this.BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    this.SECRET_KEY = process.env.TELEGRAM_SECRET_KEY;
  }

  validateInitData(initData) {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');
      
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      const secretKey = crypto.createHmac('sha256', 'WebAppData')
        .update(this.BOT_TOKEN)
        .digest();
      
      const calculatedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      
      return calculatedHash === hash;
    } catch (error) {
      console.error('Telegram validation error:', error);
      return false;
    }
  }

  extractUserData(initData) {
    try {
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      if (!userStr) return null;
      
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Error extracting user data:', error);
      return null;
    }
  }
}

module.exports = new TelegramConfig();
