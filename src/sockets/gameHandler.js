const GameSession = require('../models/GameSession');
const BingoCard = require('../models/BingoCard');
const User = require('../models/User');
const CardGenerator = require('../engine/CardGenerator');
const PatternMatcher = require('../engine/PatternMatcher');

const cardGenerator = new CardGenerator();
const patternMatcher = new PatternMatcher();

// Active game sessions in memory (for performance)
const activeGames = new Map();

const gameHandler = (io, socket) => {
  // Join a game room
  socket.on('join_room', async (data) => {
    try {
      const { roomCode, gameType = 'public' } = data;
      
      if (!roomCode) {
        socket.emit('error', { message: 'Room code is required' });
        return;
      }
      
      // Find or create game session
      let gameSession = await GameSession.findOne({ roomCode });
      
      if (!gameSession) {
        // Create new game session
        gameSession = new GameSession({
          sessionId: `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          roomCode,
          hostId: socket.userId,
          gameType,
          status: 'waiting',
          currentPlayers: 1,
          settings: {
            patterns: ['line1', 'line2', 'line3', 'line4', 'line5', 'corners', 'full_house'],
            autoDraw: true,
            allowMultipleWins: true,
            chatEnabled: true,
          },
        });
        
        await gameSession.save();
        
        // Initialize in-memory game state
        activeGames.set(roomCode, {
          sessionId: gameSession.sessionId,
          hostId: socket.userId,
          players: new Map(),
          gameLoop: null,
          numberDrawer: null,
          patternMatcher: new PatternMatcher(),
          cards: new Map(), // userId -> cardId
        });
      } else {
        // Check if game is joinable
        if (gameSession.status !== 'waiting') {
          socket.emit('error', { message: 'Game has already started' });
          return;
        }
        
        if (gameSession.currentPlayers >= gameSession.maxPlayers) {
          socket.emit('error', { message: 'Game room is full' });
          return;
        }
        
        // Update player count
        gameSession.currentPlayers += 1;
        await gameSession.save();
        
        // Add to in-memory state
        const gameState = activeGames.get(roomCode);
        if (gameState) {
          gameState.players.set(socket.userId, {
            username: socket.username,
            joinedAt: Date.now(),
            ready: false,
          });
        }
      }
      
      // Join the socket room
      socket.join(roomCode);
      
      // Generate a bingo card for the player
      const { card, cardId } = cardGenerator.generateCard();
      const bingoCard = new BingoCard({
        cardId,
        sessionId: gameSession.sessionId,
        userId: socket.userId,
        cardNumbers: card,
      });
      
      await bingoCard.save();
      
      // Store card in memory for faster access
      const gameState = activeGames.get(roomCode);
      if (gameState) {
        gameState.cards.set(socket.userId, {
          cardId,
          card,
          marked: Array(5).fill().map(() => Array(5).fill(false)),
          patternsMatched: [],
        });
      }
      
      // Notify room about new player
      io.to(roomCode).emit('player_joined', {
        userId: socket.userId,
        username: socket.username,
        currentPlayers: gameSession.currentPlayers,
        timestamp: Date.now(),
      });
      
      // Send game state to the joining player
      socket.emit('room_joined', {
        roomCode,
        sessionId: gameSession.sessionId,
        hostId: gameSession.hostId,
        gameType: gameSession.gameType,
        currentPlayers: gameSession.currentPlayers,
        maxPlayers: gameSession.maxPlayers,
        status: gameSession.status,
        settings: gameSession.settings,
        card: {
          cardId,
          numbers: card,
          marked: Array(5).fill().map(() => Array(5).fill(false)),
        },
      });
      
      // If host, send additional controls
      if (socket.userId === gameSession.hostId) {
        socket.emit('host_controls', {
          canStart: gameSession.currentPlayers >= process.env.MIN_PLAYERS,
          canConfigure: true,
        });
      }
      
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });
  
  // Leave a game room
  socket.on('leave_room', async (data) => {
    try {
      const { roomCode } = data;
      
      if (!roomCode) {
        socket.emit('error', { message: 'Room code is required' });
        return;
      }
      
      // Leave socket room
      socket.leave(roomCode);
      
      // Update game session
      const gameSession = await GameSession.findOne({ roomCode });
      if (gameSession) {
        gameSession.currentPlayers = Math.max(0, gameSession.currentPlayers - 1);
        
        // If host leaves and there are other players, assign new host
        if (gameSession.hostId === socket.userId && gameSession.currentPlayers > 0) {
          // Get first other player as new host
          const gameState = activeGames.get(roomCode);
          if (gameState) {
            const otherPlayers = Array.from(gameState.players.keys())
              .filter(id => id !== socket.userId);
            
            if (otherPlayers.length > 0) {
              gameSession.hostId = otherPlayers[0];
              io.to(roomCode).emit('new_host', {
                hostId: otherPlayers[0],
                timestamp: Date.now(),
              });
            }
          }
        }
        
        // If no players left, end the session
        if (gameSession.currentPlayers === 0) {
          gameSession.status = 'cancelled';
          activeGames.delete(roomCode);
        }
        
        await gameSession.save();
      }
      
      // Remove from in-memory state
      const gameState = activeGames.get(roomCode);
      if (gameState) {
        gameState.players.delete(socket.userId);
        gameState.cards.delete(socket.userId);
      }
      
      // Notify other players
      socket.to(roomCode).emit('player_left', {
        userId: socket.userId,
        username: socket.username,
        currentPlayers: gameSession ? gameSession.currentPlayers : 0,
        timestamp: Date.now(),
      });
      
      socket.emit('room_left', { roomCode });
      
    } catch (error) {
      console.error('Leave room error:', error);
      socket.emit('error', { message: 'Failed to leave room' });
    }
  });
  
  // Start the game (host only)
  socket.on('start_game', async (data) => {
    try {
      const { roomCode } = data;
      
      if (!roomCode) {
        socket.emit('error', { message: 'Room code is required' });
        return;
      }
      
      const gameSession = await GameSession.findOne({ roomCode });
      if (!gameSession) {
        socket.emit('error', { message: 'Game session not found' });
        return;
      }
      
      // Check if user is host
      if (gameSession.hostId !== socket.userId) {
        socket.emit('error', { message: 'Only host can start the game' });
        return;
      }
      
      // Check minimum players
      if (gameSession.currentPlayers < process.env.MIN_PLAYERS) {
        socket.emit('error', { 
          message: `Need at least ${process.env.MIN_PLAYERS} players to start` 
        });
        return;
      }
      
      // Update session status
      gameSession.status = 'active';
      gameSession.startTime = new Date();
      await gameSession.save();
      
      // Initialize game engine
      const GameLoop = require('../engine/GameLoop');
      const NumberDrawer = require('../engine/NumberDrawer');
      
      const numberDrawer = new NumberDrawer();
      const gameLoop = new GameLoop({
        duration: gameSession.duration,
        drawInterval: gameSession.drawInterval,
        numberDrawer,
        onNumberDrawn: (number, letter) => {
          // Broadcast drawn number to all players
          io.to(roomCode).emit('number_drawn', {
            number,
            letter,
            timestamp: Date.now(),
            totalDrawn: numberDrawer.getDrawCount(),
          });
          
          // Update session with drawn number
          gameSession.numbersDrawn.push(number);
          gameSession.drawnNumbersHistory.push({
            number,
            timestamp: new Date(),
          });
          gameSession.save();
        },
        onGameEnd: async (results) => {
          // Handle game end
          gameSession.status = 'completed';
          gameSession.endTime = new Date();
          await gameSession.save();
          
          // Broadcast game end
          io.to(roomCode).emit('game_ended', {
            results,
            winners: gameSession.winners,
            timestamp: Date.now(),
          });
          
          // Clean up
          activeGames.delete(roomCode);
        },
      });
      
      // Store in active games
      const gameState = activeGames.get(roomCode);
      if (gameState) {
        gameState.gameLoop = gameLoop;
        gameState.numberDrawer = numberDrawer;
      }
      
      // Start the game loop
      gameLoop.start();
      
      // Broadcast game start to all players
      io.to(roomCode).emit('game_started', {
        startTime: gameSession.startTime,
        duration: gameSession.duration,
        drawInterval: gameSession.drawInterval,
        totalNumbers: 75,
        timestamp: Date.now(),
      });
      
    } catch (error) {
      console.error('Start game error:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  });
  
  // Mark a number on the card (daub)
  socket.on('daub_cell', async (data) => {
    try {
      const { roomCode, row, col } = data;
      
      if (!roomCode || row === undefined || col === undefined) {
        socket.emit('error', { message: 'Room code, row, and col are required' });
        return;
      }
      
      const gameState = activeGames.get(roomCode);
      if (!gameState) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      // Get player's card
      const playerCard = gameState.cards.get(socket.userId);
      if (!playerCard) {
        socket.emit('error', { message: 'Card not found' });
        return;
      }
      
      // Mark the cell
      playerCard.marked[row][col] = true;
      
      // Update in database
      await BingoCard.updateOne(
        { cardId: playerCard.cardId },
        { $set: { [`markedNumbers.${row}.${col}`]: true } }
      );
      
      // Check for pattern matches
      const matchedPatterns = patternMatcher.checkAllPatterns(
        playerCard.marked,
        gameState.gameLoop?.patterns || []
      );
      
      // Check for new patterns
      const newPatterns = matchedPatterns.filter(pattern => 
        !playerCard.patternsMatched.some(p => p.patternId === pattern.patternId)
      );
      
      if (newPatterns.length > 0) {
        // Add new patterns to player's card
        playerCard.patternsMatched.push(...newPatterns);
        
        // Update in database
        await BingoCard.updateOne(
          { cardId: playerCard.cardId },
          { 
            $push: { 
              patternsMatched: {
                $each: newPatterns.map(pattern => ({
                  pattern: pattern.patternName,
                  matchedAt: new Date(),
                }))
              }
            } 
          }
        );
        
        // Notify player about pattern match
        socket.emit('pattern_matched', {
          patterns: newPatterns,
          timestamp: Date.now(),
        });
        
        // If it's a winning pattern (e.g., full house), handle bingo
        const winningPatterns = newPatterns.filter(p => 
          ['full_house', 'line1', 'line2', 'line3', 'line4', 'line5'].includes(p.patternId)
        );
        
        if (winningPatterns.length > 0) {
          // Player can call bingo
          socket.emit('can_call_bingo', {
            patterns: winningPatterns,
            timestamp: Date.now(),
          });
        }
      }
      
      // Acknowledge the daub
      socket.emit('cell_daubed', {
        row,
        col,
        marked: true,
        timestamp: Date.now(),
      });
      
    } catch (error) {
      console.error('Daub cell error:', error);
      socket.emit('error', { message: 'Failed to mark cell' });
    }
  });
  
  // Call bingo
  socket.on('call_bingo', async (data) => {
    try {
      const { roomCode, patternId } = data;
      
      if (!roomCode || !patternId) {
        socket.emit('error', { message: 'Room code and pattern ID are required' });
        return;
      }
      
      const gameState = activeGames.get(roomCode);
      if (!gameState) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      // Verify the player has the pattern
      const playerCard = gameState.cards.get(socket.userId);
      if (!playerCard) {
        socket.emit('error', { message: 'Card not found' });
        return;
      }
      
      const hasPattern = playerCard.patternsMatched.some(p => p.patternId === patternId);
      if (!hasPattern) {
        socket.emit('error', { message: 'Pattern not matched' });
        return;
      }
      
      // Get game session
      const gameSession = await GameSession.findOne({ roomCode });
      if (!gameSession) {
        socket.emit('error', { message: 'Game session not found' });
        return;
      }
      
      // Check if multiple wins are allowed
      const alreadyWon = gameSession.winners.some(w => w.userId === socket.userId);
      if (!gameSession.settings.allowMultipleWins && alreadyWon) {
        socket.emit('error', { message: 'You have already won in this game' });
        return;
      }
      
      // Calculate prize (simplified)
      const prize = gameSession.prizePool / Math.max(gameSession.winners.length + 1, 1);
      
      // Add winner to session
      gameSession.winners.push({
        userId: socket.userId,
        username: socket.username,
        pattern: patternId,
        prize,
        claimed: false,
      });
      
      await gameSession.save();
      
      // Update user stats
      await User.updateOne(
        { telegramId: socket.telegramId },
        { 
          $inc: { 
            gamesWon: 1,
            totalWinnings: prize,
          },
          $set: { lastActive: new Date() },
        }
      );
      
      // Broadcast bingo call to all players
      io.to(roomCode).emit('bingo_called', {
        userId: socket.userId,
        username: socket.username,
        pattern: patternId,
        prize,
        timestamp: Date.now(),
        winnersCount: gameSession.winners.length,
      });
      
      // If this is the first winner and game should end, stop the game
      if (gameSession.winners.length === 1 && !gameSession.settings.allowMultipleWins) {
        gameState.gameLoop?.endGame();
      }
      
    } catch (error) {
      console.error('Call bingo error:', error);
      socket.emit('error', { message: 'Failed to call bingo' });
    }
  });
  
  // Get game state
  socket.on('get_game_state', async (data) => {
    try {
      const { roomCode } = data;
      
      if (!roomCode) {
        socket.emit('error', { message: 'Room code is required' });
        return;
      }
      
      const gameSession = await GameSession.findOne({ roomCode });
      if (!gameSession) {
        socket.emit('error', { message: 'Game session not found' });
        return;
      }
      
      const gameState = activeGames.get(roomCode);
      
      socket.emit('game_state', {
        roomCode,
        sessionId: gameSession.sessionId,
        status: gameSession.status,
        hostId: gameSession.hostId,
        currentPlayers: gameSession.currentPlayers,
        maxPlayers: gameSession.maxPlayers,
        numbersDrawn: gameSession.numbersDrawn,
        winners: gameSession.winners,
        startTime: gameSession.startTime,
        endTime: gameSession.endTime,
        settings: gameSession.settings,
        gameLoopState: gameState?.gameLoop?.getState() || null,
        timestamp: Date.now(),
      });
      
    } catch (error) {
      console.error('Get game state error:', error);
      socket.emit('error', { message: 'Failed to get game state' });
    }
  });
  
  // Update game settings (host only)
  socket.on('update_settings', async (data) => {
    try {
      const { roomCode, settings } = data;
      
      if (!roomCode || !settings) {
        socket.emit('error', { message: 'Room code and settings are required' });
        return;
      }
      
      const gameSession = await GameSession.findOne({ roomCode });
      if (!gameSession) {
        socket.emit('error', { message: 'Game session not found' });
        return;
      }
      
      // Check if user is host
      if (gameSession.hostId !== socket.userId) {
        socket.emit('error', { message: 'Only host can update settings' });
        return;
      }
      
      // Update settings
      gameSession.settings = { ...gameSession.settings, ...settings };
      await gameSession.save();
      
      // Broadcast settings update
      io.to(roomCode).emit('settings_updated', {
        settings: gameSession.settings,
        updatedBy: socket.username,
        timestamp: Date.now(),
      });
      
    } catch (error) {
      console.error('Update settings error:', error);
      socket.emit('error', { message: 'Failed to update settings' });
    }
  });
};

module.exports = gameHandler;
