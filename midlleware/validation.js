// Validation middleware

export function validateGameId(req, res, next) {
  const gameId = req.params.id;
  
  if (!gameId || typeof gameId !== 'string' || gameId.length !== 8) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }
  
  next();
}

export function validatePlayerData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const { playerId, playerName, gameId } = data;
  
  if (!playerId || typeof playerId !== 'string' || playerId.length === 0) {
    return false;
  }
  
  if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
    return false;
  }
  
  if (gameId && (typeof gameId !== 'string' || gameId.length !== 8)) {
    return false;
  }
  
  return true;
}

export function validateChatMessage(message) {
  if (typeof message !== 'string') return false;
  
  const trimmed = message.trim();
  return trimmed.length > 0 && trimmed.length <= 200;
}

export function validateCellMark(data) {
  if (!data || typeof data !== 'object') return false;
  
  const { gameId, cellIndex } = data;
  
  if (!gameId || typeof gameId !== 'string' || gameId.length !== 8) return false;
  if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 24 || cellIndex === 12) return false;
  
  return true;
}
