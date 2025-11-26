// Helper functions for the Bingo backend

/**
 * Generate a unique player ID
 */
export function generateUniqueId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Sanitize string input
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '').slice(0, 100); // Limit to 100 characters and remove some HTML tags
}

/**
 * Format game duration from milliseconds to readable string
 */
export function formatGameDuration(ms) {
  if (!ms || ms < 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Get game statistics for monitoring
 */
export function getGameStatistics(gameRoom) {
  if (!gameRoom) return null;
  
  return {
    gameId: gameRoom.id,
    playerCount: gameRoom.players.size,
    isActive: gameRoom.isGameActive,
    numbersCalled: gameRoom.calledNumbers.length,
    duration: gameRoom.startedAt ? Date.now() - gameRoom.startedAt : 0,
    createdAt: new Date(gameRoom.createdAt).toISOString(),
    host: gameRoom.host
  };
}

/**
 * Clean up inactive players from a game room
 */
export function cleanupInactivePlayers(gameRoom, maxInactiveTime = 5 * 60 * 1000) { // 5 minutes default
  if (!gameRoom) return 0;
  
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [playerId, player] of gameRoom.players.entries()) {
    if (now - player.lastActivity > maxInactiveTime) {
      gameRoom.players.delete(playerId);
      cleanedCount++;
      console.log(`Removed inactive player: ${player.name} from game ${gameRoom.id}`);
    }
  }
  
  return cleanedCount;
}

/**
 * Validate Telegram Web App init data (basic validation)
 */
export function validateTelegramInitData(initData) {
  if (!initData || typeof initData !== 'string') {
    return false;
  }
  
  // Basic validation - in production, you should verify the hash
  try {
    const params = new URLSearchParams(initData);
    return params.has('user');
  } catch (error) {
    return false;
  }
}

/**
 * Extract user info from Telegram init data
 */
export function extractTelegramUser(initData) {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch (error) {
    console.error('Error parsing Telegram user data:', error);
  }
  return null;
}

/**
 * Create a standardized API response
 */
export function createApiResponse(success, data = null, error = null) {
  return {
    success,
    data,
    error,
    timestamp: new Date().toISOString()
  };
}

/**
 * Shuffle an array (Fisher-Yates algorithm)
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a random number between min and max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check if a game room is full
 */
export function isGameRoomFull(gameRoom) {
  if (!gameRoom) return true;
  return gameRoom.players.size >= (gameRoom.settings?.maxPlayers || 8);
}

/**
 * Get the next number to call (random from available numbers)
 */
export function getNextNumber(calledNumbers) {
  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const availableNumbers = allNumbers.filter(num => !calledNumbers.includes(num));
  
  if (availableNumbers.length === 0) {
    return null; // All numbers have been called
  }
  
  const randomIndex = Math.floor(Math.random() * availableNumbers.length);
  return availableNumbers[randomIndex];
}

export default {
  generateUniqueId,
  sanitizeString,
  formatGameDuration,
  getGameStatistics,
  cleanupInactivePlayers,
  validateTelegramInitData,
  extractTelegramUser,
  createApiResponse,
  shuffleArray,
  randomInt,
  isGameRoomFull,
  getNextNumber
};
