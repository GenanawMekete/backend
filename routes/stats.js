// Statistics API routes

import express from 'express';
import { createApiResponse, getGameStatistics } from '../utils/helpers.js';

const router = express.Router();

// This would typically connect to your game state storage
// For now, we'll use a placeholder that will be populated by the main server

let gameRooms = new Map();

/**
 * Inject game rooms from main server
 */
export function setGameRooms(rooms) {
  gameRooms = rooms;
}

/**
 * Get server statistics
 */
router.get('/', (req, res) => {
  try {
    const activeGames = gameRooms.size;
    const totalPlayers = Array.from(gameRooms.values()).reduce((sum, room) => sum + room.players.size, 0);
    
    const activePlayers = Array.from(gameRooms.values()).reduce((sum, room) => {
      return sum + Array.from(room.players.values()).filter(player => 
        Date.now() - player.lastActivity < 5 * 60 * 1000 // Active in last 5 minutes
      ).length;
    }, 0);

    const gameStats = Array.from(gameRooms.values()).map(getGameStatistics);

    res.json(createApiResponse(true, {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      },
      games: {
        active: activeGames,
        totalPlayers,
        activePlayers,
        details: gameStats
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    }));
    
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json(createApiResponse(false, null, 'Failed to get statistics'));
  }
});

/**
 * Get detailed statistics for a specific game
 */
router.get('/game/:gameId', (req, res) => {
  const gameId = req.params.gameId.toUpperCase();
  const gameRoom = gameRooms.get(gameId);
  
  if (!gameRoom) {
    return res.status(404).json(createApiResponse(false, null, 'Game not found'));
  }

  const stats = getGameStatistics(gameRoom);
  
  // Add player details
  stats.players = Array.from(gameRoom.players.values()).map(player => ({
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    markedCount: player.markedCells.size,
    lastActivity: new Date(player.lastActivity).toISOString(),
    joinedAt: new Date(player.joinedAt).toISOString()
  }));

  res.json(createApiResponse(true, stats));
});

/**
 * Get health check
 */
router.get('/health', (req, res) => {
  res.json(createApiResponse(true, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    games: gameRooms.size
  }));
});

export default router;
