require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');

// Import configurations
const { pgPool, connectMongoDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initSocketIO } = require('./sockets');

// Import routes
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.SERVER_URL 
    : ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - ${req.ip}`);
  next();
});

// Routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Initialize Socket.IO
initSocketIO(server);

// Start server function
const startServer = async () => {
  try {
    // Connect to databases
    await connectMongoDB();
    await connectRedis();
    
    // Test PostgreSQL connection
    await pgPool.query('SELECT 1');
    logger.info('PostgreSQL connected successfully');
    
    // Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown function
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server...');
  
  try {
    // Close server
    server.close(async () => {
      logger.info('HTTP server closed');
      
      // Close database connections
      await pgPool.end();
      logger.info('PostgreSQL connection closed');
      
      // Close Redis connections
      const { cleanupQueues } = require('./utils/queue');
      await cleanupQueues();
      logger.info('Queues closed');
      
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcing shutdown');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = { app, server };
