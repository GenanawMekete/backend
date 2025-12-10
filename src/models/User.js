const { DataTypes } = require('sequelize');
const { pgPool } = require('../config/db');

const User = pgPool.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  telegramId: {
    type: DataTypes.BIGINT,
    unique: true,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 1000.00,
  },
  gamesPlayed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  gamesWon: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  totalWinnings: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
  },
  lastActive: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
