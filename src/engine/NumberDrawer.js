class NumberDrawer {
  constructor(options = {}) {
    this.minNumber = options.minNumber || 1;
    this.maxNumber = options.maxNumber || 75;
    this.drawnNumbers = [];
    this.remainingNumbers = this.generateAllNumbers();
    this.history = [];
  }

  generateAllNumbers() {
    const numbers = [];
    for (let i = this.minNumber; i <= this.maxNumber; i++) {
      numbers.push(i);
    }
    return numbers;
  }

  draw() {
    if (this.remainingNumbers.length === 0) {
      throw new Error('No numbers left to draw');
    }

    // Fisher-Yates shuffle for random selection
    const randomIndex = Math.floor(Math.random() * this.remainingNumbers.length);
    const drawnNumber = this.remainingNumbers.splice(randomIndex, 1)[0];
    
    this.drawnNumbers.push(drawnNumber);
    
    const drawRecord = {
      number: drawnNumber,
      timestamp: Date.now(),
      drawIndex: this.drawnNumbers.length,
      remainingCount: this.remainingNumbers.length,
    };
    
    this.history.push(drawRecord);

    return drawnNumber;
  }

  getDrawnNumbers() {
    return [...this.drawnNumbers];
  }

  getRemainingNumbers() {
    return [...this.remainingNumbers];
  }

  getHistory() {
    return [...this.history];
  }

  getLastDraw() {
    return this.history.length > 0 ? { ...this.history[this.history.length - 1] } : null;
  }

  getDrawCount() {
    return this.drawnNumbers.length;
  }

  getRemainingCount() {
    return this.remainingNumbers.length;
  }

  hasNumberBeenDrawn(number) {
    return this.drawnNumbers.includes(number);
  }

  reset() {
    this.drawnNumbers = [];
    this.remainingNumbers = this.generateAllNumbers();
    this.history = [];
  }

  // For testing or specific game modes
  drawSpecific(number) {
    if (number < this.minNumber || number > this.maxNumber) {
      throw new Error(`Number must be between ${this.minNumber} and ${this.maxNumber}`);
    }

    if (this.hasNumberBeenDrawn(number)) {
      throw new Error(`Number ${number} has already been drawn`);
    }

    const index = this.remainingNumbers.indexOf(number);
    if (index === -1) {
      throw new Error(`Number ${number} is not available`);
    }

    this.remainingNumbers.splice(index, 1);
    this.drawnNumbers.push(number);
    
    const drawRecord = {
      number,
      timestamp: Date.now(),
      drawIndex: this.drawnNumbers.length,
      remainingCount: this.remainingNumbers.length,
    };
    
    this.history.push(drawRecord);

    return number;
  }

  // Get statistics
  getStatistics() {
    const total = this.maxNumber - this.minNumber + 1;
    const drawn = this.drawnNumbers.length;
    const remaining = this.remainingNumbers.length;
    
    return {
      total,
      drawn,
      remaining,
      percentageDrawn: (drawn / total) * 100,
      averageTimeBetweenDraws: this.calculateAverageTime(),
      drawsPerMinute: this.calculateDrawsPerMinute(),
    };
  }

  calculateAverageTime() {
    if (this.history.length < 2) return 0;
    
    const first = this.history[0].timestamp;
    const last = this.history[this.history.length - 1].timestamp;
    return (last - first) / (this.history.length - 1);
  }

  calculateDrawsPerMinute() {
    if (this.history.length < 2) return 0;
    
    const first = this.history[0].timestamp;
    const last = this.history[this.history.length - 1].timestamp;
    const minutes = (last - first) / 60000;
    return minutes > 0 ? this.history.length / minutes : 0;
  }
}

module.exports = NumberDrawer;
