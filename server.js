// server.js - Simplified version for Render deployment
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage
const gameRooms = new Map();
const playerConnections = new Map();

// Utility functions
function generateBingoCard() {
  const ranges = [
    { min: 1, max: 15 }, { min: 16, max: 30 }, { min: 31, max: 45 },
    { min: 46, max: 60 }, { min: 61, max: 75 }
  ];

  const card = [];
  for (let col = 0; col < 5; col++) {
    const numbers = generateColumnNumbers(ranges[col].min, ranges[col].max);
    for (let row = 0; row < 5; row++) {
      if (row === 2 && col === 2) {
        card.push({ number: 'FREE', isFree: true, row, col, index: row * 5 + col });
      } else {
        card.push({ number: numbers[row], isFree: false, row, col, index: row * 5 + col });
      }
    }
  }
  return card;
}

function generateColumnNumbers(min, max) {
  const numbers = [];
  while (numbers.length < 5) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!numbers.includes(num)) numbers.push(num);
  }
  return numbers;
}

function checkWinCondition(markedCells) {
  // Check rows
  for (let row = 0; row < 5; row++) {
    let complete = true;
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      if (idx !== 12 && !markedCells.has(idx)) complete = false;
    }
    if (complete) return true;
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    let complete = true;
    for (let row = 0; row < 5; row++) {
      const idx = row * 5 + col;
      if (idx !== 12 && !markedCells.has(idx)) complete = false;
    }
    if (complete) return true;
  }

  // Check diagonals
  let mainComplete = true, antiComplete = true;
  for (let i = 0; i < 5; i++) {
    const mainIdx = i * 5 + i;
    const antiIdx = i * 5 + (4 - i);
    if (mainIdx !== 12 && !markedCells.has(mainIdx)) mainComplete = false;
    if (antiIdx !== 12 && !markedCells.has(antiIdx)) antiComplete = false;
  }
  if (mainComplete && antiComplete) return true;

  // Check corners
  const corners = [0, 4, 20, 24];
  if (corners.every(idx => markedCells.has(idx))) return true;

  return false;
}

// API Routes
app.get('/', (req, res) => {
  res.json({ message: 'Bingo Backend API', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  res.json({
    activeGames: gameRooms.size,
    totalPlayers: Array.from(gameRooms.values()).reduce((sum, room) => sum + room.players.size, 0),
    uptime: process.uptime()
  });
});

app.post('/api/game/create', (req, res) => {
  const { playerName, playerId } = req.body;
  const gameId = uuidv4().slice(0, 8).toUpperCase();
  
  gameRooms.set(gameId, {
    id: gameId,
    host: playerId,
    players: new Map(),
    calledNumbers: [],
    isGameActive: false,
    createdAt: Date.now()
  });

  res.json({ success: true, gameId });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-game', (data) => {
    const { playerName, playerId } = data;
    const gameId = uuidv4().slice(0, 8).toUpperCase();
    
    const gameRoom = {
      id: gameId,
      host: playerId,
      players: new Map(),
      calledNumbers: [],
      isGameActive: false,
      createdAt: Date.now()
    };

    gameRooms.set(gameId, gameRoom);
    joinGame(socket, gameId, playerId, playerName);
    socket.emit('game-created', { gameId });
  });

  socket.on('join-game', (data) => {
    const { gameId, playerId, playerName } = data;
    joinGame(socket, gameId, playerId, playerName);
  });

  function joinGame(socket, gameId, playerId, playerName) {
    const gameRoom = gameRooms.get(gameId);
    if (!gameRoom) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    const player = {
      id: playerId,
      name: playerName,
      socketId: socket.id,
      card: generateBingoCard(),
      markedCells: new Set([12]),
      isHost: playerId === gameRoom.host
    };

    gameRoom.players.set(playerId, player);
    playerConnections.set(socket.id, { gameId, playerId });
    socket.join(gameId);

    socket.emit('game-joined', {
      game: {
        id: gameRoom.id,
        host: gameRoom.host,
        isGameActive: gameRoom.isGameActive,
        calledNumbers: gameRoom.calledNumbers,
        players: Array.from(gameRoom.players.values()).map(p => ({
          id: p.id, name: p.name, isHost: p.isHost, markedCount: p.markedCells.size
        }))
      },
      player: { id: player.id, name: player.name, isHost: player.isHost, card: player.card }
    });

    socket.to(gameId).emit('player-joined', {
      player: { id: player.id, name: player.name, isHost: player.isHost, markedCount: player.markedCells.size },
      players: Array.from(gameRoom.players.values()).map(p => ({
        id: p.id, name: p.name, isHost: p.isHost, markedCount: p.markedCells.size
      }))
    });
  }

  socket.on('start-game', (data) => {
    const { gameId } = data;
    const connection = playerConnections.get(socket.id);
    const gameRoom = gameRooms.get(gameId);
    
    if (gameRoom && gameRoom.host === connection.playerId) {
      gameRoom.isGameActive = true;
      startNumberCalling(gameId);
      io.to(gameId).emit('game-started', { startedAt: Date.now() });
    }
  });

  socket.on('mark-cell', (data) => {
    const { gameId, cellIndex } = data;
    const connection = playerConnections.get(socket.id);
    const gameRoom = gameRooms.get(gameId);
    const player = gameRoom?.players.get(connection.playerId);

    if (player && gameRoom?.isGameActive) {
      const cell = player.card.find(c => c.index === cellIndex);
      if (cell && !cell.isFree && gameRoom.calledNumbers.includes(cell.number)) {
        player.markedCells.add(cellIndex);
        
        if (checkWinCondition(player.markedCells)) {
          gameRoom.isGameActive = false;
          io.to(gameId).emit('player-won', {
            winner: { id: player.id, name: player.name }
          });
        } else {
          socket.to(gameId).emit('player-marked-cell', {
            playerId: player.id, markedCount: player.markedCells.size
          });
        }
        
        socket.emit('cell-marked', { cellIndex });
      }
    }
  });

  socket.on('send-chat', (data) => {
    const { gameId, message } = data;
    const connection = playerConnections.get(socket.id);
    const gameRoom = gameRooms.get(gameId);
    const player = gameRoom?.players.get(connection.playerId);

    if (player) {
      io.to(gameId).emit('chat-message', {
        playerId: player.id, playerName: player.name, message, timestamp: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    const connection = playerConnections.get(socket.id);
    if (connection) {
      const { gameId, playerId } = connection;
      const gameRoom = gameRooms.get(gameId);
      
      if (gameRoom) {
        gameRoom.players.delete(playerId);
        socket.to(gameId).emit('player-left', { playerId });
        
        if (gameRoom.players.size === 0) {
          gameRooms.delete(gameId);
        }
      }
      playerConnections.delete(socket.id);
    }
  });

  function startNumberCalling(gameId) {
    const gameRoom = gameRooms.get(gameId);
    if (!gameRoom) return;

    const interval = setInterval(() => {
      if (gameRoom.isGameActive && gameRoom.calledNumbers.length < 75) {
        let number;
        do {
          number = Math.floor(Math.random() * 75) + 1;
        } while (gameRoom.calledNumbers.includes(number));

        gameRoom.calledNumbers.push(number);
        io.to(gameId).emit('number-called', {
          number, totalCalled: gameRoom.calledNumbers.length
        });
      } else {
        clearInterval(interval);
      }
    }, 3000);
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bingo backend running on port ${PORT}`);
});
