const EventEmitter = require('events');

class GameLoop extends EventEmitter {
  constructor(options = {}) {
    super();
    this.duration = options.duration || 300000; // 5 minutes
    this.drawInterval = options.drawInterval || 5000; // 5 seconds
    this.state = 'idle'; // idle, waiting, active, paused, completed
    this.timer = null;
    this.drawTimer = null;
    this.startTime = null;
    this.elapsedTime = 0;
    this.remainingTime = this.duration;
    this.numberDrawer = options.numberDrawer;
    this.patternMatcher = options.patternMatcher;
    this.onNumberDrawn = options.onNumberDrawn;
    this.onGameEnd = options.onGameEnd;
  }

  start() {
    if (this.state !== 'waiting' && this.state !== 'paused') {
      throw new Error('Game can only start from waiting or paused state');
    }

    this.state = 'active';
    this.startTime = Date.now();
    
    // Start the main game timer
    this.timer = setTimeout(() => {
      this.endGame();
    }, this.remainingTime);

    // Start drawing numbers
    this.startDrawing();

    this.emit('gameStarted', {
      startTime: this.startTime,
      duration: this.duration,
    });
  }

  startDrawing() {
    if (!this.numberDrawer) {
      throw new Error('NumberDrawer is required');
    }

    // Draw first number immediately
    this.drawNumber();

    // Continue drawing at intervals
    this.drawTimer = setInterval(() => {
      if (this.state === 'active') {
        this.drawNumber();
      }
    }, this.drawInterval);
  }

  drawNumber() {
    try {
      const number = this.numberDrawer.draw();
      const letter = this.getLetterForNumber(number);
      
      this.emit('numberDrawn', {
        number,
        letter,
        timestamp: Date.now(),
        remainingNumbers: this.numberDrawer.getRemainingNumbers(),
        drawnNumbers: this.numberDrawer.getDrawnNumbers(),
      });

      if (this.onNumberDrawn) {
        this.onNumberDrawn(number, letter);
      }

      // Check if all numbers drawn
      if (this.numberDrawer.getRemainingNumbers().length === 0) {
        this.endGame();
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  getLetterForNumber(number) {
    if (number >= 1 && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
    return '';
  }

  pause() {
    if (this.state !== 'active') return;

    this.state = 'paused';
    clearTimeout(this.timer);
    clearInterval(this.drawTimer);
    
    this.elapsedTime = Date.now() - this.startTime;
    this.remainingTime -= this.elapsedTime;

    this.emit('gamePaused', {
      elapsedTime: this.elapsedTime,
      remainingTime: this.remainingTime,
    });
  }

  resume() {
    if (this.state !== 'paused') return;

    this.state = 'active';
    this.startTime = Date.now();
    
    this.timer = setTimeout(() => {
      this.endGame();
    }, this.remainingTime);

    this.startDrawing();

    this.emit('gameResumed', {
      startTime: this.startTime,
      remainingTime: this.remainingTime,
    });
  }

  endGame() {
    if (this.state === 'completed') return;

    this.state = 'completed';
    clearTimeout(this.timer);
    clearInterval(this.drawTimer);

    const endTime = Date.now();
    const totalElapsed = endTime - this.startTime;

    const results = {
      endTime,
      totalElapsed,
      drawnNumbers: this.numberDrawer.getDrawnNumbers(),
      remainingNumbers: this.numberDrawer.getRemainingNumbers(),
    };

    this.emit('gameEnded', results);

    if (this.onGameEnd) {
      this.onGameEnd(results);
    }
  }

  reset() {
    this.state = 'idle';
    this.startTime = null;
    this.elapsedTime = 0;
    this.remainingTime = this.duration;
    
    clearTimeout(this.timer);
    clearInterval(this.drawTimer);
    
    if (this.numberDrawer) {
      this.numberDrawer.reset();
    }

    this.emit('gameReset');
  }

  getState() {
    return {
      state: this.state,
      elapsedTime: this.elapsedTime,
      remainingTime: this.remainingTime,
      startTime: this.startTime,
      duration: this.duration,
      drawInterval: this.drawInterval,
    };
  }

  updateSettings(settings) {
    if (this.state === 'active') {
      throw new Error('Cannot update settings during active game');
    }

    if (settings.duration) {
      this.duration = settings.duration;
      this.remainingTime = settings.duration;
    }

    if (settings.drawInterval) {
      this.drawInterval = settings.drawInterval;
    }

    this.emit('settingsUpdated', settings);
  }
}

module.exports = GameLoop;
