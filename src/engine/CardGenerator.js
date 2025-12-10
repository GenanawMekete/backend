class CardGenerator {
  constructor() {
    this.columns = {
      'B': { min: 1, max: 15 },
      'I': { min: 16, max: 30 },
      'N': { min: 31, max: 45 },
      'G': { min: 46, max: 60 },
      'O': { min: 61, max: 75 },
    };
    
    this.columnOrder = ['B', 'I', 'N', 'G', 'O'];
  }

  generateCard() {
    const card = [];
    
    for (let row = 0; row < 5; row++) {
      card[row] = [];
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) {
          // Free space in the middle
          card[row][col] = 'FREE';
        } else {
          const column = this.columnOrder[col];
          card[row][col] = this.getUniqueNumberForColumn(column, card, col);
        }
      }
    }
    
    return {
      card,
      cardId: this.generateCardId(card),
    };
  }

  getUniqueNumberForColumn(column, card, colIndex) {
    const { min, max } = this.columns[column];
    const usedNumbers = new Set();
    
    // Collect already used numbers in this column
    for (let row = 0; row < 5; row++) {
      if (card[row] && card[row][colIndex] && card[row][colIndex] !== 'FREE') {
        usedNumbers.add(card[row][colIndex]);
      }
    }
    
    let number;
    let attempts = 0;
    const maxAttempts = 50;
    
    do {
      number = this.getRandomNumber(min, max);
      attempts++;
      
      if (attempts > maxAttempts) {
        throw new Error(`Could not find unique number for column ${column}`);
      }
    } while (usedNumbers.has(number));
    
    return number;
  }

  getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  generateCardId(card) {
    // Create a unique ID based on card numbers
    const numbers = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (card[row][col] !== 'FREE') {
          numbers.push(card[row][col]);
        }
      }
    }
    
    const hash = numbers.join('-');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    
    return `CARD_${timestamp}_${random}_${this.simpleHash(hash)}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substr(0, 8);
  }

  validateCard(card) {
    if (!Array.isArray(card) || card.length !== 5) {
      return { valid: false, error: 'Card must be a 5x5 array' };
    }

    for (let row = 0; row < 5; row++) {
      if (!Array.isArray(card[row]) || card[row].length !== 5) {
        return { valid: false, error: `Row ${row} must have 5 columns` };
      }
    }

    // Check free space
    if (card[2][2] !== 'FREE') {
      return { valid: false, error: 'Center cell must be FREE' };
    }

    // Check column ranges
    for (let col = 0; col < 5; col++) {
      const column = this.columnOrder[col];
      const { min, max } = this.columns[column];
      const columnNumbers = new Set();
      
      for (let row = 0; row < 5; row++) {
        if (row === 2 && col === 2) continue; // Skip free space
        
        const value = card[row][col];
        
        if (typeof value !== 'number') {
          return { valid: false, error: `Invalid value at [${row}][${col}]` };
        }
        
        if (value < min || value > max) {
          return { valid: false, error: `Value ${value} at [${row}][${col}] is outside column ${column} range (${min}-${max})` };
        }
        
        if (columnNumbers.has(value)) {
          return { valid: false, error: `Duplicate value ${value} in column ${column}` };
        }
        
        columnNumbers.add(value);
      }
    }

    return { valid: true };
  }

  generateMultipleCards(count) {
    const cards = [];
    const cardIds = new Set();
    
    for (let i = 0; i < count; i++) {
      let card;
      let attempts = 0;
      const maxAttempts = 10;
      
      do {
        card = this.generateCard();
        attempts++;
        
        if (attempts > maxAttempts) {
          throw new Error('Could not generate unique card after multiple attempts');
        }
      } while (cardIds.has(card.cardId));
      
      cards.push(card);
      cardIds.add(card.cardId);
    }
    
    return cards;
  }

  // For special game modes
  generateCardWithPattern(pattern) {
    const card = this.generateCard().card;
    
    // Apply pattern constraints
    switch (pattern) {
      case 'easy':
        // Ensure certain numbers are included
        return this.modifyCardForEasyMode(card);
      case 'hard':
        // Ensure certain numbers are excluded
        return this.modifyCardForHardMode(card);
      default:
        return { card, cardId: this.generateCardId(card) };
    }
  }

  modifyCardForEasyMode(card) {
    // Ensure at least one low number in each column
    for (let col = 0; col < 5; col++) {
      const column = this.columnOrder[col];
      const { min } = this.columns[column];
      
      // Find a cell to replace with a low number
      for (let row = 0; row < 5; row++) {
        if (row === 2 && col === 2) continue;
        
        if (card[row][col] > min + 5) {
          card[row][col] = this.getRandomNumber(min, min + 5);
          break;
        }
      }
    }
    
    return { card, cardId: this.generateCardId(card) };
  }

  modifyCardForHardMode(card) {
    // Ensure at least one high number in each column
    for (let col = 0; col < 5; col++) {
      const column = this.columnOrder[col];
      const { max } = this.columns[column];
      
      // Find a cell to replace with a high number
      for (let row = 0; row < 5; row++) {
        if (row === 2 && col === 2) continue;
        
        if (card[row][col] < max - 5) {
          card[row][col] = this.getRandomNumber(max - 5, max);
          break;
        }
      }
    }
    
    return { card, cardId: this.generateCardId(card) };
  }

  // Convert card to different formats
  cardToJSON(card) {
    return {
      card,
      columns: this.columnOrder,
      validation: this.validateCard(card),
    };
  }

  cardToCSV(card) {
    const rows = [];
    rows.push(this.columnOrder.join(','));
    
    for (let row = 0; row < 5; row++) {
      const rowData = card[row].map(cell => 
        cell === 'FREE' ? 'FREE' : cell.toString()
      );
      rows.push(rowData.join(','));
    }
    
    return rows.join('\n');
  }
}

module.exports = CardGenerator;
