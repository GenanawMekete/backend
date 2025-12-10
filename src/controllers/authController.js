const jwt = require('jsonwebtoken');
const telegramConfig = require('../config/telegram');
const User = require('../models/User');

class AuthController {
  async validateTelegramAuth(req, res) {
    try {
      const { initData } = req.body;
      
      if (!initData) {
        return res.status(400).json({
          success: false,
          error: 'Telegram initData is required',
        });
      }

      // Validate Telegram WebApp data
      const isValid = telegramConfig.validateInitData(initData);
      
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid Telegram authentication',
        });
      }

      // Extract user data
      const userData = telegramConfig.extractUserData(initData);
      
      if (!userData) {
        return res.status(400).json({
          success: false,
          error: 'Could not extract user data',
        });
      }

      // Find or create user
      let user = await User.findOne({
        where: { telegramId: userData.id },
      });

      if (!user) {
        user = await User.create({
          telegramId: userData.id,
          username: userData.username,
          firstName: userData.first_name,
          lastName: userData.last_name,
        });
      } else {
        // Update last active
        user.lastActive = new Date();
        await user.save();
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          telegramId: user.telegramId,
          username: user.username,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          balance: user.balance,
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
          totalWinnings: user.totalWinnings,
        },
      });
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async refreshToken(req, res) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token is required',
        });
      }

      // Verify existing token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user
      const user = await User.findByPk(decoded.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Generate new token
      const newToken = jwt.sign(
        {
          userId: user.id,
          telegramId: user.telegramId,
          username: user.username,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      return res.json({
        success: true,
        token: newToken,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          balance: user.balance,
        },
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
        });
      }
      
      console.error('Token refresh error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async logout(req, res) {
    try {
      // Invalidate token (client-side only in this implementation)
      // For server-side invalidation, you'd need a token blacklist
      
      return res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getProfile(req, res) {
    try {
      const userId = req.userId; // Set by middleware
      
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['createdAt', 'updatedAt'] },
      });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      return res.json({
        success: true,
        user,
      });
    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

module.exports = new AuthController();
