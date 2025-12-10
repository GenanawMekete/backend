const socketIO = require('socket.io');
const { getRedisAdapter } = require('../config/redis');
const gameHandler = require('./gameHandler');
const chatHandler = require('./chatHandler');

let io;

const initSocketIO = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.SERVER_URL 
        : ['http://localhost:3000', 'http://localhost:8080'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Use Redis adapter for horizontal scaling
  io.adapter(getRedisAdapter());

  // Socket middleware for authentication
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.telegramId = decoded.telegramId;
      
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`New socket connection: ${socket.id} - User: ${socket.username}`);
    
    // Store user in room for private messages
    socket.join(`user:${socket.userId}`);
    
    // Initialize handlers
    gameHandler(io, socket);
    chatHandler(io, socket);
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} - Reason: ${reason}`);
      
      // Leave all rooms
      const rooms = Object.keys(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
      
      // Notify game rooms about disconnection
      socket.broadcast.emit('user_disconnected', {
        userId: socket.userId,
        username: socket.username,
        timestamp: Date.now(),
      });
    });
    
    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

module.exports = {
  initSocketIO,
  getIO,
};
