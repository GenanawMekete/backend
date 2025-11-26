// Validation middleware for the Bingo backend

/**
 * Validate game ID format
 */
export function validateGameId(req, res, next) {
  const gameId = req.params.id;
  
  if (!gameId || typeof gameId !== 'string' || gameId.length !== 8) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid game ID format. Game ID must be 8 characters long.' 
    });
  }
  
  // Check if game ID contains only alphanumeric characters
  if (!/^[A-Z0-9]{8}$/.test(gameId.toUpperCase())) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid game ID format. Only uppercase letters and numbers are allowed.' 
    });
  }
  
  next();
}

/**
 * Validate player data
 */
export function validatePlayerData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const { playerId, playerName, gameId } = data;
  
  // Validate playerId
  if (!playerId || typeof playerId !== 'string' || playerId.trim().length === 0) {
    return false;
  }
  
  // Validate playerName
  if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
    return false;
  }
  
  // Validate gameId if provided
  if (gameId && (typeof gameId !== 'string' || gameId.length !== 8)) {
    return false;
  }
  
  return true;
}

/**
 * Validate chat message
 */
export function validateChatMessage(message) {
  if (typeof message !== 'string') return false;
  
  const trimmed = message.trim();
  return trimmed.length > 0 && trimmed.length <= 200;
}

/**
 * Validate cell mark data
 */
export function validateCellMark(data) {
  if (!data || typeof data !== 'object') return false;
  
  const { gameId, cellIndex } = data;
  
  if (!gameId || typeof gameId !== 'string' || gameId.length !== 8) return false;
  if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 24 || cellIndex === 12) return false;
  
  return true;
}

/**
 * Validate game creation data
 */
export function validateGameCreation(data) {
  if (!data || typeof data !== 'object') return false;
  
  const { playerName, playerId } = data;
  
  if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
    return false;
  }
  
  if (!playerId || typeof playerId !== 'string' || playerId.trim().length === 0) {
    return false;
  }
  
  // Additional validation for player name length
  if (playerName.trim().length > 50) {
    return false;
  }
  
  return true;
}

/**
 * Middleware to validate game creation request
 */
export function validateCreateGame(req, res, next) {
  const { playerName, playerId } = req.body;
  
  if (!playerName || !playerId) {
    return res.status(400).json({
      success: false,
      error: 'Player name and ID are required'
    });
  }
  
  if (typeof playerName !== 'string' || playerName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid player name is required'
    });
  }
  
  if (typeof playerId !== 'string' || playerId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid player ID is required'
    });
  }
  
  // Sanitize player name
  req.body.playerName = playerName.trim().slice(0, 50);
  
  next();
}

/**
 * Middleware to validate join game request
 */
export function validateJoinGame(req, res, next) {
  const { gameId, playerName, playerId } = req.body;
  
  if (!gameId || !playerName || !playerId) {
    return res.status(400).json({
      success: false,
      error: 'Game ID, player name, and player ID are required'
    });
  }
  
  if (typeof gameId !== 'string' || gameId.length !== 8) {
    return res.status(400).json({
      success: false,
      error: 'Valid game ID (8 characters) is required'
    });
  }
  
  if (typeof playerName !== 'string' || playerName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid player name is required'
    });
  }
  
  if (typeof playerId !== 'string' || playerId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid player ID is required'
    });
  }
  
  // Sanitize inputs
  req.body.gameId = gameId.toUpperCase().trim();
  req.body.playerName = playerName.trim().slice(0, 50);
  
  next();
}

export default {
  validateGameId,
  validatePlayerData,
  validateChatMessage,
  validateCellMark,
  validateGameCreation,
  validateCreateGame,
  validateJoinGame
};
