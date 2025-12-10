const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { telegramAuth, authLimiter, apiLimiter } = require('../middleware/telegramAuth');

// Public routes
router.post('/auth/telegram', authLimiter, authController.validateTelegramAuth);
router.post('/auth/refresh', authController.refreshToken);
router.post('/auth/logout', authController.logout);

// Protected routes (require authentication)
router.use(apiLimiter);
router.use(telegramAuth);

// User routes
router.get('/user/stats', userController.getUserStats);
router.get('/user/balance', userController.getBalance);
router.get('/user/history', userController.getGameHistory);
router.get('/user/cards', userController.getActiveCards);
router.put('/user/profile', userController.updateProfile);
router.post('/user/add-funds', userController.addFunds);
router.post('/user/withdraw', userController.withdrawFunds);

// Game management routes
router.get('/games/active', async (req, res) => {
  try {
    const GameSession = require('../models/GameSession');
    
    const activeGames = await GameSession.find({
      status: { $in: ['waiting', 'active'] },
      gameType: 'public',
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('roomCode gameType currentPlayers maxPlayers entryFee prizePool settings createdAt');
    
    return res.json({
      success: true,
      games: activeGames,
    });
  } catch (error) {
    console.error('Get active games error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/games/create', async (req, res) => {
  try {
    const { gameType, maxPlayers, entryFee, settings } = req.body;
    
    const GameSession = require('../models/GameSession');
    
    // Generate unique room code
    const roomCode = this.generateRoomCode();
    
    const gameSession = new GameSession({
      sessionId: `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomCode,
      hostId: req.userId,
      gameType: gameType || 'public',
      maxPlayers: maxPlayers || 50,
      entryFee: entryFee || 0,
      prizePool: 0, // Will be calculated based on entry fees
      settings: {
        patterns: ['line1', 'line2', 'line3', 'line4', 'line5', 'corners', 'full_house'],
        autoDraw: true,
        allowMultipleWins: true,
        chatEnabled: true,
        ...settings,
      },
    });
    
    await gameSession.save();
    
    return res.json({
      success: true,
      roomCode,
      sessionId: gameSession.sessionId,
      game: gameSession,
    });
  } catch (error) {
    console.error('Create game error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Helper function to generate room code
function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return code;
}

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

module.exports = router;
