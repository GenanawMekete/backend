// Game-related API routes

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateCreateGame, validateJoinGame } from '../middleware/validation.js';
import { createApiResponse } from '../utils/helpers.js';

const router = express.Router();

// Store game rooms (in production, use a database)
const gameRooms = new Map();

/**
 * Create a new game
 */
router.post('/create', validateCreateGame, (req, res) => {
  const { playerName, playerId } = req.body;
  
  try {
    const gameId = uuidv4().slice(0, 8).toUpperCase();
    
    const gameRoom = {
      id: gameId,
      host: playerId,
      players: new Map(),
      calledNumbers: [],
      isGameActive: false,
      createdAt: Date.now(),
      settings: {
        maxPlayers: 8,
        numberCallInterval: 3000,
        winConditions: ['row-column', 'diagonals', 'corners']
      }
    };

    gameRooms.set(gameId, gameRoom);
    
    console.log(`Game ${gameId} created by ${playerName}`);
    
    res.json(createApiResponse(true, {
      gameId,
      message: 'Game created successfully! Share the code with friends.'
    }));
    
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json(createApiResponse(false, null, 'Failed to create game'));
  }
});

/**
 * Get game information
 */
router.get('/:gameId', (req, res) => {
  const gameId = req.params.gameId.toUpperCase();
  const gameRoom = gameRooms.get(gameId);
  
  if (!gameRoom) {
    return res.status(404).json(createApiResponse(false, null, 'Game not found'));
  }

  res.json(createApiResponse(true, {
    gameId: gameRoom.id,
    playerCount: gameRoom.players.size,
    isActive: gameRoom.isGameActive,
    host: gameRoom.host,
    createdAt: new Date(gameRoom.createdAt).toISOString(),
    calledNumbers: gameRoom.calledNumbers.length
  }));
});

/**
 * Join a game (API endpoint - socket connection handles the actual joining)
 */
router.post('/join', validateJoinGame, (req, res) => {
  const { gameId, playerName, playerId } = req.body;
  
  const gameRoom = gameRooms.get(gameId);
  
  if (!gameRoom) {
    return res.status(404).json(createApiResponse(false, null, 'Game not found'));
  }

  if (gameRoom.players.size >= gameRoom.settings.maxPlayers) {
    return res.status(400).json(createApiResponse(false, null, 'Game is full'));
  }

  if (gameRoom.isGameActive) {
    return res.status(400).json(createApiResponse(false, null, 'Game has already started'));
  }

  // Check if player already exists in game
  if (Array.from(gameRoom.players.values()).some(player => player.id === playerId)) {
    return res.status(400).json(createApiResponse(false, null, 'You are already in this game'));
  }

  res.json(createApiResponse(true, {
    gameId,
    canJoin: true,
    message: 'You can join this game'
  }));
});

/**
 * List all active games (for monitoring)
 */
router.get('/', (req, res) => {
  const games = Array.from(gameRooms.values()).map(gameRoom => ({
    gameId: gameRoom.id,
    playerCount: gameRoom.players.size,
    isActive: gameRoom.isGameActive,
    host: gameRoom.host,
    createdAt: new Date(gameRoom.createdAt).toISOString(),
    calledNumbers: gameRoom.calledNumbers.length
  }));

  res.json(createApiResponse(true, {
    totalGames: games.length,
    games
  }));
});

export default router;
