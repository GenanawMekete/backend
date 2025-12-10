const { Queue, Worker } = require('bullmq');
const { redisClient } = require('../config/redis');
const logger = require('./logger');

// Initialize queues
const gameResultQueue = new Queue('game-results', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

const notificationQueue = new Queue('notifications', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 1000,
  },
});

// Worker for processing game results
const gameResultWorker = new Worker('game-results', async (job) => {
  try {
    const { sessionId, winners, prizePool } = job.data;
    
    logger.info(`Processing game results for session: ${sessionId}`);
    
    // Update user balances and stats
    for (const winner of winners) {
      // Update winner's balance and stats
      // This would typically update the database
      logger.info(`Awarding ${winner.prize} to user ${winner.userId}`);
      
      // Send win notification (could be email, push notification, etc.)
      await notificationQueue.add('win-notification', {
        userId: winner.userId,
        prize: winner.prize,
        gameSession: sessionId,
      });
    }
    
    // Update game session as processed
    // await GameSession.updateOne({ sessionId }, { processed: true });
    
    return { success: true, sessionId };
  } catch (error) {
    logger.error(`Error processing game results: ${error.message}`);
    throw error;
  }
}, {
  connection: redisClient,
  concurrency: 5,
});

// Worker for sending notifications
const notificationWorker = new Worker('notifications', async (job) => {
  try {
    const { type, data } = job.data;
    
    switch (type) {
      case 'win-notification':
        logger.info(`Sending win notification to user ${data.userId}`);
        // Implement notification logic (email, push, etc.)
        break;
        
      case 'game-start':
        logger.info(`Sending game start notification`);
        // Implement notification logic
        break;
        
      default:
        logger.warn(`Unknown notification type: ${type}`);
    }
    
    return { success: true, type };
  } catch (error) {
    logger.error(`Error sending notification: ${error.message}`);
    throw error;
  }
}, {
  connection: redisClient,
  concurrency: 10,
});

// Event handlers for monitoring
gameResultWorker.on('completed', (job) => {
  logger.info(`Game result job ${job.id} completed`);
});

gameResultWorker.on('failed', (job, err) => {
  logger.error(`Game result job ${job.id} failed: ${err.message}`);
});

notificationWorker.on('completed', (job) => {
  logger.info(`Notification job ${job.id} completed`);
});

notificationWorker.on('failed', (job, err) => {
  logger.error(`Notification job ${job.id} failed: ${err.message}`);
});

// Helper functions
const addGameResultJob = async (sessionId, winners, prizePool) => {
  return await gameResultQueue.add('process-results', {
    sessionId,
    winners,
    prizePool,
    timestamp: Date.now(),
  });
};

const addNotificationJob = async (type, data) => {
  return await notificationQueue.add('send-notification', {
    type,
    data,
    timestamp: Date.now(),
  });
};

// Cleanup function
const cleanupQueues = async () => {
  await gameResultQueue.close();
  await notificationQueue.close();
  await gameResultWorker.close();
  await notificationWorker.close();
};

module.exports = {
  gameResultQueue,
  notificationQueue,
  addGameResultJob,
  addNotificationJob,
  cleanupQueues,
};
