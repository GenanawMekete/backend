import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

// Import utilities
import { generateBingoCard, checkWinCondition, getWinningPattern } from './utils/gameLogic.js';
import { validateGameId, validatePlayerData } from './middleware/validation.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Game state storage
const gameRooms = new Map();
const playerConnections = new Map();
const activeIntervals = new Map();

// Cleanup inactive games (24 hours)
setInterval(() => {
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  for (const [gameId, game] of gameRooms.entries()) {
    if (now - game.createdAt > twentyFourHours) {
      // Cleanup intervals
      if (activeIntervals.has(gameId)) {
        clearInterval(activeIntervals.get(gameId));
        activeIntervals.delete(gameId);
      }
      
      // Remove game
      gameRooms.delete(gameId);
      console.log(`Cleaned up inactive game: ${gameId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour

// API Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Multiplayer Bingo Backend', 
    version: '1.0.0',
    endpoints: {
      stats: '/api/stats',
      gameInfo: '/api/game/:id'
    }
  });
});

app.get('/api/stats', (req, res) => {
  const stats = {
    activeGames: gameRooms.size,
    totalPlayers: Array.from(gameRooms.values()).reduce((sum, room) => sum + room.players.size, 0),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
  res.json(stats);
});

app.get('/api/game/:id', validateGameId, (req, res) => {
  const gameId = req.params.id.toUpperCase();
  const gameRoom = gameRooms.get(gameId);
  
  if (!gameRoom) {
    return res.status(404).json({ error: 'Game not found' });
  }

  res.json({
    gameId: gameRoom.id,
    playerCount: gameRoom.players.size,
    isActive: gameRoom.isGameActive,
    host: gameRoom.host,
    createdAt: gameRoom.createdAt,
    calledNumbers: gameRoom.calledNumbers.length
  });
});

app.post('/api/game/create', (req, res) => {
  const { playerName, playerId } = req.body;
  
  if (!playerName || !playerId) {
    return res.status(400).json({ error: 'Player name and ID are required' });
  }

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
      numberCallInterval: 3000, // 3 seconds
      winConditions: ['row-column', 'diagonals', 'corners']
    },
    stats: {
      numbersCalled: 0,
      gameDuration: 0
    }
  };

  gameRooms.set(gameId, gameRoom);
  
  console.log(`Game ${gameId} created by ${playerName}`);
  
  res.json({
    success: true,
    gameId,
    message: 'Game created successfully'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    games: gameRooms.size
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'Total connections:', io.engine.clientsCount);

  // Create new game room
  socket.on('create-game', (data) => {
    try {
      const { playerName, playerId } = data;
      
      if (!validatePlayerData(data)) {
        socket.emit('error', { message: 'Invalid player data' });
        return;
      }

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
        },
        stats: {
          numbersCalled: 0,
          gameDuration: 0
        }
      };

      gameRooms.set(gameId, gameRoom);
      
      // Add host to game
      joinGame(socket, gameId, playerId, playerName);
      
      socket.emit('game-created', { 
        gameId, 
        message: 'Game created successfully! Share the code with friends.' 
      });
      
      console.log(`Game ${gameId} created by ${playerName}`);
    } catch (error) {
      console.error('Error creating game:', error);
      socket.emit('error', { message: 'Failed to create game' });
    }
  });

  // Join existing game
  socket.on('join-game', (data) => {
    try {
      const { gameId, playerId, playerName } = data;
      
      if (!validatePlayerData(data)) {
        socket.emit('error', { message: 'Invalid player data' });
        return;
      }

      joinGame(socket, gameId, playerId, playerName);
    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('error', { message: 'Failed to join game' });
    }
  });

  function joinGame(socket, gameId, playerId, playerName) {
    const gameRoom = gameRooms.get(gameId);
    
    if (!gameRoom) {
      socket.emit('error', { message: 'Game not found!' });
      return;
    }

    if (gameRoom.players.size >= gameRoom.settings.maxPlayers) {
      socket.emit('error', { message: 'Game is full! Maximum 8 players allowed.' });
      return;
    }

    if (gameRoom.isGameActive) {
      socket.emit('error', { message: 'Game has already started!' });
      return;
    }

    // Check if player already exists in game
    if (gameRoom.players.has(playerId)) {
      socket.emit('error', { message: 'You are already in this game!' });
      return;
    }

    // Create player
    const player = {
      id: playerId,
      name: playerName,
      socketId: socket.id,
      card: generateBingoCard(),
      markedCells: new Set([12]), // FREE space is always marked
      isReady: false,
      isHost: playerId === gameRoom.host,
      joinedAt: Date.now(),
      lastActivity: Date.now()
    };

    // Add player to game
    gameRoom.players.set(playerId, player);
    playerConnections.set(socket.id, { gameId, playerId });

    // Join socket room
    socket.join(gameId);

    // Send game state to the joining player
    socket.emit('game-joined', {
      game: {
        id: gameRoom.id,
        host: gameRoom.host,
        isGameActive: gameRoom.isGameActive,
        calledNumbers: gameRoom.calledNumbers,
        players: Array.from(gameRoom.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          isReady: p.isReady,
          markedCount: p.markedCells.size
        }))
      },
      player: {
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        card: player.card
      }
    });

    // Notify other players
    socket.to(gameId).emit('player-joined', {
      player: {
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        isReady: player.isReady,
        markedCount: player.markedCells.size
      },
      players: Array.from(gameRoom.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isReady: p.isReady,
        markedCount: p.markedCells.size
      }))
    });

    console.log(`Player ${playerName} joined game ${gameId}. Total players: ${gameRoom.players.size}`);
  }

  // Start game
  socket.on('start-game', (data) => {
    const { gameId } = data;
    const connection = playerConnections.get(socket.id);
    
    if (!connection) {
      socket.emit('error', { message: 'Not connected to a game!' });
      return;
    }
    
    const gameRoom = gameRooms.get(gameId);
    if (!gameRoom || gameRoom.host !== connection.playerId) {
      socket.emit('error', { message: 'Only the host can start the game!' });
      return;
    }

    if (gameRoom.players.size < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start!' });
      return;
    }

    if (gameRoom.isGameActive) {
      socket.emit('error', { message: 'Game is already active!' });
      return;
    }

    gameRoom.isGameActive = true;
    gameRoom.startedAt = Date.now();

    // Start number calling
    startNumberCalling(gameId);

    io.to(gameId).emit('game-started', {
      startedAt: gameRoom.startedAt,
      calledNumbers: gameRoom.calledNumbers
    });

    console.log(`Game ${gameId} started with ${gameRoom.players.size} players`);
  });

  // Mark cell
  socket.on('mark-cell', (data) => {
    const { gameId, cellIndex } = data;
    const connection = playerConnections.get(socket.id);
    
    if (!connection) {
      socket.emit('error', { message: 'Not connected to a game!' });
      return;
    }
    
    const gameRoom = gameRooms.get(gameId);
    if (!gameRoom || !gameRoom.isGameActive) {
      socket.emit('error', { message: 'Game is not active!' });
      return;
    }

    const player = gameRoom.players.get(connection.playerId);
    if (!player) {
      socket.emit('error', { message: 'Player not found in game!' });
      return;
    }

    // Update last activity
    player.lastActivity = Date.now();

    // Validate the cell can be marked
    const cell = player.card.find(c => c.index === cellIndex);
    if (!cell || cell.isFree) {
      socket.emit('error', { message: 'Invalid cell!' });
      return;
    }

    // Check if number has been called
    if (!gameRoom.calledNumbers.includes(cell.number)) {
      socket.emit('error', { message: `Number ${cell.number} hasn't been called yet!` });
      return;
    }

    // Check if cell is already marked
    if (player.markedCells.has(cellIndex)) {
      socket.emit('error', { message: 'Cell already marked!' });
      return;
    }

    // Mark the cell
    player.markedCells.add(cellIndex);

    // Check for win
    if (checkWinCondition(player.markedCells)) {
      const winningPattern = getWinningPattern(player.markedCells);
      
      gameRoom.isGameActive = false;
      gameRoom.winner = player.id;
      gameRoom.finishedAt = Date.now();
      gameRoom.stats.gameDuration = gameRoom.finishedAt - gameRoom.startedAt;
      gameRoom.stats.numbersCalled = gameRoom.calledNumbers.length;

      // Stop number calling
      if (activeIntervals.has(gameId)) {
        clearInterval(activeIntervals.get(gameId));
        activeIntervals.delete(gameId);
      }

      // Notify all players
      io.to(gameId).emit('player-won', {
        winner: {
          id: player.id,
          name: player.name,
          markedCells: Array.from(player.markedCells),
          winningPattern: winningPattern,
          card: player.card
        },
        gameDuration: gameRoom.stats.gameDuration,
        numbersCalled: gameRoom.stats.numbersCalled
      });

      console.log(`Player ${player.name} won game ${gameId} in ${gameRoom.stats.gameDuration}ms`);
    } else {
      // Notify others about the mark
      socket.to(gameId).emit('player-marked-cell', {
        playerId: player.id,
        markedCount: player.markedCells.size
      });
    }

    // Send confirmation to player
    socket.emit('cell-marked', {
      cellIndex,
      markedCount: player.markedCells.size
    });
  });

  // Chat message
  socket.on('send-chat', (data) => {
    const { gameId, message } = data;
    const connection = playerConnections.get(socket.id);
    
    if (!connection) return;
    
    const gameRoom = gameRooms.get(gameId);
    if (!gameRoom) return;

    const player = gameRoom.players.get(connection.playerId);
    if (!player) return;

    // Update last activity
    player.lastActivity = Date.now();

    // Validate message
    const trimmedMessage = message.toString().trim().slice(0, 200); // Limit to 200 chars
    
    if (trimmedMessage.length === 0) {
      socket.emit('error', { message: 'Message cannot be empty!' });
      return;
    }

    io.to(gameId).emit('chat-message', {
      playerId: player.id,
      playerName: player.name,
      message: trimmedMessage,
      timestamp: Date.now()
    });
  });

  // Player ready status
  socket.on('player-ready', (data) => {
    const { gameId, isReady } = data;
    const connection = playerConnections.get(socket.id);
    
    if (!connection) return;
    
    const gameRoom = gameRooms.get(gameId);
    if (!gameRoom) return;

    const player = gameRoom.players.get(connection.playerId);
    if (!player) return;

    player.isReady = isReady;
    player.lastActivity = Date.now();

    io.to(gameId).emit('player-ready-updated', {
      playerId: player.id,
      isReady: player.isReady,
      players: Array.from(gameRoom.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isReady: p.isReady,
        markedCount: p.markedCells.size
      }))
    });
  });

  // Leave game
  socket.on('leave-game', () => {
    const connection = playerConnections.get(socket.id);
    if (connection) {
      leaveGame(socket, connection.gameId, connection.playerId);
    }
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, 'Reason:', reason);
    
    const connection = playerConnections.get(socket.id);
    if (connection) {
      leaveGame(socket, connection.gameId, connection.playerId);
    }
  });

  function leaveGame(socket, gameId, playerId) {
    const gameRoom = gameRooms.get(gameId);
    
    if (gameRoom) {
      const player = gameRoom.players.get(playerId);
      
      // Remove player
      gameRoom.players.delete(playerId);
      
      // Notify other players
      socket.to(gameId).emit('player-left', {
        playerId: playerId,
        playerName: player?.name,
        players: Array.from(gameRoom.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          markedCount: p.markedCells.size
        }))
      });

      // Clean up empty games
      if (gameRoom.players.size === 0) {
        // Stop number calling if game was active
        if (activeIntervals.has(gameId)) {
          clearInterval(activeIntervals.get(gameId));
          activeIntervals.delete(gameId);
        }
        
        gameRooms.delete(gameId);
        console.log(`Game ${gameId} deleted (no players)`);
      } else if (playerId === gameRoom.host) {
        // Assign new host
        const newHost = Array.from(gameRoom.players.values())[0];
        gameRoom.host = newHost.id;
        newHost.isHost = true;
        
        io.to(gameId).emit('new-host', { 
          hostId: newHost.id, 
          hostName: newHost.name 
        });
        
        console.log(`New host assigned for game ${gameId}: ${newHost.name}`);
      }
    }
    
    playerConnections.delete(socket.id);
    
    if (player) {
      console.log(`Player ${player.name} left game ${gameId}`);
    }
  }

  function startNumberCalling(gameId) {
    const gameRoom = gameRooms.get(gameId);
    if (!gameRoom) return;

    // Clear any existing interval
    if (activeIntervals.has(gameId)) {
      clearInterval(activeIntervals.get(gameId));
    }

    const interval = setInterval(() => {
      if (gameRoom.isGameActive && gameRoom.calledNumbers.length < 75) {
        callNextNumber(gameId);
      } else {
        clearInterval(interval);
        activeIntervals.delete(gameId);
      }
    }, gameRoom.settings.numberCallInterval);

    activeIntervals.set(gameId, interval);
  }

  function callNextNumber(gameId) {
    const gameRoom = gameRooms.get(gameId);
    if (!gameRoom || !gameRoom.isGameActive) return;

    let number;
    do {
      number = Math.floor(Math.random() * 75) + 1;
    } while (gameRoom.calledNumbers.includes(number));

    gameRoom.calledNumbers.push(number);
    gameRoom.stats.numbersCalled = gameRoom.calledNumbers.length;
    
    io.to(gameId).emit('number-called', {
      number,
      totalCalled: gameRoom.calledNumbers.length,
      calledNumbers: gameRoom.calledNumbers
    });

    console.log(`Game ${gameId}: Called number ${number}`);
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
🎯 Multiplayer Bingo Backend Server
📍 Port: ${PORT}
🌐 Environment: ${process.env.NODE_ENV || 'development'}
🚀 Ready to accept connections!
  `);
});

export { app, io };
