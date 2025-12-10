const User = require('../models/User');
const BingoCard = require('../models/BingoCard');
const GameSession = require('../models/GameSession');

class UserController {
  async getUserStats(req, res) {
    try {
      const userId = req.userId;
      
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'balance', 'gamesPlayed', 'gamesWon', 'totalWinnings', 'lastActive'],
      });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get additional stats
      const activeCards = await BingoCard.countDocuments({
        userId,
        isActive: true,
      });
      
      const recentGames = await GameSession.find({
        'winners.userId': userId,
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('roomCode status prizePool winners createdAt');
      
      const stats = {
        ...user.toJSON(),
        activeCards,
        winRate: user.gamesPlayed > 0 ? (user.gamesWon / user.gamesPlayed * 100).toFixed(2) : 0,
        averageWin: user.gamesWon > 0 ? (user.totalWinnings / user.gamesWon).toFixed(2) : 0,
        recentGames,
      };

      return res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getBalance(req, res) {
    try {
      const userId = req.userId;
      
      const user = await User.findByPk(userId, {
        attributes: ['id', 'balance'],
      });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get transaction history (simplified)
      const transactions = []; // You'd implement this with a Transaction model
      
      return res.json({
        success: true,
        balance: user.balance,
        transactions,
      });
    } catch (error) {
      console.error('Get balance error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getGameHistory(req, res) {
    try {
      const userId = req.userId;
      const { page = 1, limit = 10 } = req.query;
      
      const skip = (page - 1) * limit;
      
      // Find games where user participated
      const games = await GameSession.find({
        'winners.userId': userId,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('roomCode status gameType prizePool winners startTime endTime createdAt');
      
      const total = await GameSession.countDocuments({
        'winners.userId': userId,
      });
      
      // Format response
      const history = games.map(game => {
        const userWin = game.winners.find(winner => winner.userId === userId);
        return {
          gameId: game._id,
          roomCode: game.roomCode,
          gameType: game.gameType,
          status: game.status,
          prize: userWin ? userWin.prize : 0,
          winType: userWin ? userWin.pattern : null,
          startTime: game.startTime,
          endTime: game.endTime,
          createdAt: game.createdAt,
        };
      });
      
      return res.json({
        success: true,
        history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Get game history error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.userId;
      const { username } = req.body; // Only allow updating username in this example
      
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }
      
      if (username) {
        // Check if username is available
        const existingUser = await User.findOne({
          where: { username },
        });
        
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({
            success: false,
            error: 'Username already taken',
          });
        }
        
        user.username = username;
        await user.save();
      }
      
      return res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getActiveCards(req, res) {
    try {
      const userId = req.userId;
      
      const cards = await BingoCard.find({
        userId,
        isActive: true,
      })
      .select('cardId sessionId cardNumbers markedNumbers createdAt')
      .sort({ createdAt: -1 });
      
      return res.json({
        success: true,
        cards,
        count: cards.length,
      });
    } catch (error) {
      console.error('Get active cards error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async addFunds(req, res) {
    try {
      const userId = req.userId;
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
      }
      
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }
      
      // In a real application, you would integrate with a payment gateway here
      // For now, we'll just simulate adding funds
      user.balance = parseFloat(user.balance) + parseFloat(amount);
      await user.save();
      
      // Log transaction
      // await Transaction.create({ ... });
      
      return res.json({
        success: true,
        message: 'Funds added successfully',
        newBalance: user.balance,
      });
    } catch (error) {
      console.error('Add funds error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async withdrawFunds(req, res) {
    try {
      const userId = req.userId;
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
      }
      
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }
      
      if (parseFloat(user.balance) < parseFloat(amount)) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance',
        });
      }
      
      user.balance = parseFloat(user.balance) - parseFloat(amount);
      await user.save();
      
      // Log transaction
      // await Transaction.create({ ... });
      
      return res.json({
        success: true,
        message: 'Withdrawal successful',
        newBalance: user.balance,
      });
    } catch (error) {
      console.error('Withdraw funds error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

module.exports = new UserController();
