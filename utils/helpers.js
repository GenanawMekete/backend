// Helper functions

export function generateUniqueId() {
  return Math.random().toString(36).substr(2, 9);
}

export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, 100); // Limit to 100 characters
}

export function formatGameDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

export function getGameStatistics(gameRoom) {
  if (!gameRoom) return null;
  
  return {
    gameId: gameRoom.id,
    playerCount: gameRoom.players.size,
    isActive: gameRoom.isGameActive,
    numbersCalled: gameRoom.calledNumbers.length,
    duration: gameRoom.startedAt ? Date.now() - gameRoom.startedAt : 0,
    createdAt: gameRoom.createdAt
  };
}

export function cleanupInactivePlayers(gameRoom, maxInactiveTime = 5 * 60 * 1000) { // 5 minutes
  if (!gameRoom) return;
  
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [playerId, player] of gameRoom.players.entries()) {
    if (now - player.lastActivity > maxInactiveTime) {
      gameRoom.players.delete(playerId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} inactive players from game ${gameRoom.id}`);
  }
  
  return cleanedCount;
}
