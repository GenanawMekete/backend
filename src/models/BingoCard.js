const mongoose = require('mongoose');

const bingoCardSchema = new mongoose.Schema({
  cardId: {
    type: String,
    required: true,
    unique: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  cardNumbers: {
    type: [[Number]],
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length === 5 && arr.every(row => row.length === 5);
      },
      message: 'Card must be a 5x5 matrix',
    },
  },
  markedNumbers: {
    type: [[Boolean]],
    default: Array(5).fill().map(() => Array(5).fill(false)),
  },
  patternsMatched: [{
    pattern: String,
    matchedAt: Date,
    numbersRequired: [Number],
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  purchasePrice: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for faster queries
bingoCardSchema.index({ sessionId: 1, userId: 1 });
bingoCardSchema.index({ userId: 1, isActive: 1 });

// Method to mark a number
bingoCardSchema.methods.markNumber = function(number) {
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      if (this.cardNumbers[i][j] === number && !this.markedNumbers[i][j]) {
        this.markedNumbers[i][j] = true;
        return { row: i, col: j, marked: true };
      }
    }
  }
  return { marked: false };
};

// Method to check if a number is on the card
bingoCardSchema.methods.hasNumber = function(number) {
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      if (this.cardNumbers[i][j] === number) {
        return { row: i, col: j, exists: true };
      }
    }
  }
  return { exists: false };
};

module.exports = mongoose.model('BingoCard', bingoCardSchema);
