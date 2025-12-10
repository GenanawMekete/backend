const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  roomCode: {
    type: String,
    required: true,
    index: true,
  },
  hostId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'paused', 'completed', 'cancelled'],
    default: 'waiting',
  },
  gameType: {
    type: String,
    enum: ['public', 'private', 'tournament'],
    default: 'public',
  },
  gameMode: {
    type: String,
    enum: ['quick', 'regular', 'marathon'],
    default: 'regular',
  },
  entryFee: {
    type: Number,
    default: 0,
  },
  prizePool: {
    type: Number,
    default: 0,
  },
  maxPlayers: {
    type: Number,
    default: 50,
  },
  currentPlayers: {
    type: Number,
    default: 0,
  },
  numbersDrawn: [{
    type: Number,
    min: 1,
    max: 75,
  }],
  drawnNumbersHistory: [{
    number: Number,
    timestamp: Date,
  }],
  winners: [{
    userId: String,
    username: String,
    pattern: String,
    prize: Number,
    claimed: {
      type: Boolean,
      default: false,
    },
  }],
  startTime: {
    type: Date,
  },
  endTime: {
    type: Date,
  },
  duration: {
    type: Number, // in milliseconds
    default: 300000,
  },
  drawInterval: {
    type: Number, // in milliseconds
    default: 5000,
  },
  settings: {
    patterns: [String],
    autoDraw: {
      type: Boolean,
      default: true,
    },
    allowMultipleWins: {
      type: Boolean,
      default: true,
    },
    chatEnabled: {
      type: Boolean,
      default: true,
    },
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
gameSessionSchema.index({ status: 1, createdAt: -1 });
gameSessionSchema.index({ roomCode: 1 }, { unique: true });
gameSessionSchema.index({ 'winners.userId': 1 });

module.exports = mongoose.model('GameSession', gameSessionSchema);
