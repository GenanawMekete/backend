class PatternMatcher {
  constructor() {
    // Define common Bingo patterns
    this.patterns = {
      // Single line patterns
      'line1': { name: 'Top Row', cells: [[0,0], [0,1], [0,2], [0,3], [0,4]] },
      'line2': { name: 'Middle Row', cells: [[1,0], [1,1], [1,2], [1,3], [1,4]] },
      'line3': { name: 'Bottom Row', cells: [[2,0], [2,1], [2,2], [2,3], [2,4]] },
      'line4': { name: 'Fourth Row', cells: [[3,0], [3,1], [3,2], [3,3], [3,4]] },
      'line5': { name: 'Fifth Row', cells: [[4,0], [4,1], [4,2], [4,3], [4,4]] },
      
      // Column patterns
      'col1': { name: 'First Column', cells: [[0,0], [1,0], [2,0], [3,0], [4,0]] },
      'col2': { name: 'Second Column', cells: [[0,1], [1,1], [2,1], [3,1], [4,1]] },
      'col3': { name: 'Third Column', cells: [[0,2], [1,2], [2,2], [3,2], [4,2]] },
      'col4': { name: 'Fourth Column', cells: [[0,3], [1,3], [2,3], [3,3], [4,3]] },
      'col5': { name: 'Fifth Column', cells: [[0,4], [1,4], [2,4], [3,4], [4,4]] },
      
      // Diagonal patterns
      'diag1': { name: 'Main Diagonal', cells: [[0,0], [1,1], [2,2], [3,3], [4,4]] },
      'diag2': { name: 'Anti Diagonal', cells: [[0,4], [1,3], [2,2], [3,1], [4,0]] },
      
      // Corner patterns
      'corners': { name: 'Four Corners', cells: [[0,0], [0,4], [4,0], [4,4]] },
      
      // Special patterns
      'postage_stamp': { name: 'Postage Stamp', cells: [[0,0], [0,1], [1,0], [1,1]] },
      'small_diamond': { name: 'Small Diamond', cells: [[1,2], [2,1], [2,2], [2,3], [3,2]] },
      
      // Full house
      'full_house': { name: 'Full House', cells: 'all' },
      
      // Custom patterns can be added
    };
  }

  checkPattern(markedGrid, patternId) {
    const pattern = this.patterns[patternId];
    if (!pattern) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    if (patternId === 'full_house') {
      return this.checkFullHouse(markedGrid);
    }

    return this.checkSpecificPattern(markedGrid, pattern.cells);
  }

  checkSpecificPattern(markedGrid, cells) {
    for (const [row, col] of cells) {
      if (!markedGrid[row] || !markedGrid[row][col]) {
        return {
          matched: false,
          missingCells: [[row, col]],
        };
      }
    }
    
    return {
      matched: true,
      patternCells: cells,
    };
  }

  checkFullHouse(markedGrid) {
    const missingCells = [];
    
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        // Free space in the middle (row 2, col 2) is always considered marked
        if (row === 2 && col === 2) continue;
        
        if (!markedGrid[row][col]) {
          missingCells.push([row, col]);
        }
      }
    }
    
    return {
      matched: missingCells.length === 0,
      missingCells,
    };
  }

  checkAllPatterns(markedGrid, enabledPatterns = null) {
    const matchedPatterns = [];
    const patternsToCheck = enabledPatterns || Object.keys(this.patterns);

    for (const patternId of patternsToCheck) {
      try {
        const result = this.checkPattern(markedGrid, patternId);
        if (result.matched) {
          matchedPatterns.push({
            patternId,
            patternName: this.patterns[patternId].name,
            cells: result.patternCells || 'all',
          });
        }
      } catch (error) {
        // Skip patterns that don't exist
        continue;
      }
    }

    return matchedPatterns;
  }

  checkProgressivePatterns(markedGrid, lastNumber, patternsHistory) {
    const newMatches = [];
    const allPatterns = this.checkAllPatterns(markedGrid);
    
    // Filter out patterns that were already matched
    for (const pattern of allPatterns) {
      const alreadyMatched = patternsHistory.some(
        p => p.patternId === pattern.patternId
      );
      
      if (!alreadyMatched) {
        // Find which cells in this pattern contain the last drawn number
        const cellsWithLastNumber = this.findCellsWithNumber(
          markedGrid,
          pattern.cells,
          lastNumber
        );
        
        newMatches.push({
          ...pattern,
          triggeredBy: lastNumber,
          triggeredCells: cellsWithLastNumber,
          timestamp: Date.now(),
        });
      }
    }

    return newMatches;
  }

  findCellsWithNumber(markedGrid, patternCells, number) {
    if (patternCells === 'all') {
      // For full house, check all cells
      const cells = [];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (markedGrid[row][col] && this.isCellWithNumber(markedGrid, row, col, number)) {
            cells.push([row, col]);
          }
        }
      }
      return cells;
    }

    return patternCells.filter(([row, col]) => 
      markedGrid[row][col] && this.isCellWithNumber(markedGrid, row, col, number)
    );
  }

  isCellWithNumber(markedGrid, row, col, number) {
    // This assumes the card numbers are stored separately
    // In a real implementation, you'd have access to the card numbers
    return true; // Simplified for this example
  }

  addCustomPattern(patternId, patternName, cells) {
    if (this.patterns[patternId]) {
      throw new Error(`Pattern ${patternId} already exists`);
    }

    this.patterns[patternId] = {
      name: patternName,
      cells,
    };

    return patternId;
  }

  removePattern(patternId) {
    if (!this.patterns[patternId]) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    delete this.patterns[patternId];
    return true;
  }

  listPatterns() {
    return Object.entries(this.patterns).map(([id, pattern]) => ({
      id,
      name: pattern.name,
      cellCount: pattern.cells === 'all' ? 24 : pattern.cells.length, // 24 for full house (excluding free space)
      description: this.getPatternDescription(id),
    }));
  }

  getPatternDescription(patternId) {
    const pattern = this.patterns[patternId];
    if (!pattern) return 'Pattern not found';

    if (pattern.cells === 'all') {
      return 'Mark all numbers on the card (excluding free space)';
    }

    return `Requires marking ${pattern.cells.length} specific cells`;
  }
}

module.exports = PatternMatcher;
