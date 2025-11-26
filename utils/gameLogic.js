// Bingo game logic utilities

/**
 * Generate a random Bingo card with proper number ranges
 */
export function generateBingoCard() {
  const ranges = [
    { min: 1, max: 15, letter: 'B' },   // B
    { min: 16, max: 30, letter: 'I' },  // I
    { min: 31, max: 45, letter: 'N' },  // N
    { min: 46, max: 60, letter: 'G' },  // G
    { min: 61, max: 75, letter: 'O' }   // O
  ];

  const card = [];
  
  // Generate numbers for each column
  for (let col = 0; col < 5; col++) {
    const columnNumbers = generateColumnNumbers(ranges[col].min, ranges[col].max);
    
    for (let row = 0; row < 5; row++) {
      const index = row * 5 + col;
      
      if (row === 2 && col === 2) {
        // Center cell - FREE space
        card.push({ 
          number: 'FREE', 
          isFree: true, 
          row, 
          col,
          index: index,
          letter: ranges[col].letter
        });
      } else {
        card.push({ 
          number: columnNumbers[row], 
          isFree: false, 
          row, 
          col,
          index: index,
          letter: ranges[col].letter
        });
      }
    }
  }
  
  return card;
}

/**
 * Generate unique numbers for a column
 */
export function generateColumnNumbers(min, max) {
  const numbers = [];
  while (numbers.length < 5) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers.sort((a, b) => a - b); // Sort numbers in ascending order
}

/**
 * Check if a player has won based on marked cells
 */
export function checkWinCondition(markedCells) {
  // Condition 1: Any row OR any column
  const hasCompleteRow = checkRows(markedCells);
  const hasCompleteColumn = checkColumns(markedCells);
  const condition1 = hasCompleteRow || hasCompleteColumn;

  // Condition 2: Both diagonals
  const condition2 = checkBothDiagonals(markedCells);

  // Condition 3: Four corners
  const condition3 = checkFourCorners(markedCells);

  return condition1 || condition2 || condition3;
}

/**
 * Check if any row is complete
 */
function checkRows(markedCells) {
  for (let row = 0; row < 5; row++) {
    let rowComplete = true;
    for (let col = 0; col < 5; col++) {
      const index = row * 5 + col;
      if (index !== 12 && !markedCells.has(index)) { // Skip FREE space (index 12)
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) return true;
  }
  return false;
}

/**
 * Check if any column is complete
 */
function checkColumns(markedCells) {
  for (let col = 0; col < 5; col++) {
    let colComplete = true;
    for (let row = 0; row < 5; row++) {
      const index = row * 5 + col;
      if (index !== 12 && !markedCells.has(index)) { // Skip FREE space
        colComplete = false;
        break;
      }
    }
    if (colComplete) return true;
  }
  return false;
}

/**
 * Check if both diagonals are complete
 */
function checkBothDiagonals(markedCells) {
  // Main diagonal (0,0 to 4,4): 0, 6, 12, 18, 24
  let mainDiagonalComplete = true;
  const mainDiagonal = [0, 6, 12, 18, 24];
  for (const index of mainDiagonal) {
    if (index !== 12 && !markedCells.has(index)) {
      mainDiagonalComplete = false;
      break;
    }
  }

  // Anti-diagonal (0,4 to 4,0): 4, 8, 12, 16, 20
  let antiDiagonalComplete = true;
  const antiDiagonal = [4, 8, 12, 16, 20];
  for (const index of antiDiagonal) {
    if (index !== 12 && !markedCells.has(index)) {
      antiDiagonalComplete = false;
      break;
    }
  }

  return mainDiagonalComplete && antiDiagonalComplete;
}

/**
 * Check if all four corners are marked
 */
function checkFourCorners(markedCells) {
  const corners = [0, 4, 20, 24]; // Top-left, top-right, bottom-left, bottom-right
  return corners.every(index => markedCells.has(index));
}

/**
 * Get the winning pattern for display purposes
 */
export function getWinningPattern(markedCells) {
  const patterns = [];

  // Check rows
  for (let row = 0; row < 5; row++) {
    let rowComplete = true;
    const rowCells = [];
    for (let col = 0; col < 5; col++) {
      const index = row * 5 + col;
      rowCells.push(index);
      if (index !== 12 && !markedCells.has(index)) {
        rowComplete = false;
      }
    }
    if (rowComplete) {
      patterns.push({ 
        type: 'row', 
        cells: rowCells, 
        index: row,
        description: `Row ${row + 1}`
      });
    }
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    let colComplete = true;
    const colCells = [];
    for (let row = 0; row < 5; row++) {
      const index = row * 5 + col;
      colCells.push(index);
      if (index !== 12 && !markedCells.has(index)) {
        colComplete = false;
      }
    }
    if (colComplete) {
      const letters = ['B', 'I', 'N', 'G', 'O'];
      patterns.push({ 
        type: 'column', 
        cells: colCells, 
        index: col,
        description: `Column ${letters[col]}`
      });
    }
  }

  // Check diagonals
  const mainDiagonal = [0, 6, 12, 18, 24];
  const antiDiagonal = [4, 8, 12, 16, 20];
  
  const mainComplete = mainDiagonal.every(index => index === 12 || markedCells.has(index));
  const antiComplete = antiDiagonal.every(index => index === 12 || markedCells.has(index));
  
  if (mainComplete) {
    patterns.push({ 
      type: 'diagonal', 
      cells: mainDiagonal, 
      which: 'main',
      description: 'Main Diagonal'
    });
  }
  
  if (antiComplete) {
    patterns.push({ 
      type: 'diagonal', 
      cells: antiDiagonal, 
      which: 'anti',
      description: 'Anti-Diagonal'
    });
  }

  // Check four corners
  const corners = [0, 4, 20, 24];
  if (corners.every(index => markedCells.has(index))) {
    patterns.push({ 
      type: 'corners', 
      cells: corners,
      description: 'Four Corners'
    });
  }

  return patterns;
}

/**
 * Validate if a Bingo card is properly formatted
 */
export function validateBingoCard(card) {
  if (!Array.isArray(card) || card.length !== 25) {
    return false;
  }

  // Check FREE space
  const freeCell = card[12];
  if (!freeCell || !freeCell.isFree || freeCell.number !== 'FREE') {
    return false;
  }

  // Check number ranges for each column
  const ranges = [
    { min: 1, max: 15 },   // B
    { min: 16, max: 30 },  // I
    { min: 31, max: 45 },  // N
    { min: 46, max: 60 },  // G
    { min: 61, max: 75 }   // O
  ];

  for (let col = 0; col < 5; col++) {
    const columnNumbers = [];
    for (let row = 0; row < 5; row++) {
      const index = row * 5 + col;
      const cell = card[index];
      
      if (index === 12) continue; // Skip FREE space
      
      if (!cell || cell.isFree || typeof cell.number !== 'number') {
        return false;
      }
      
      const number = cell.number;
      if (number < ranges[col].min || number > ranges[col].max) {
        return false;
      }
      
      if (columnNumbers.includes(number)) {
        return false; // Duplicate number in column
      }
      
      columnNumbers.push(number);
    }
  }

  return true;
}

/**
 * Check if a number can be marked (has been called and is on the card)
 */
export function canMarkNumber(card, calledNumbers, cellIndex) {
  if (cellIndex === 12) return false; // FREE space is always marked
  
  const cell = card.find(c => c.index === cellIndex);
  if (!cell || cell.isFree) return false;
  
  return calledNumbers.includes(cell.number);
}

export default {
  generateBingoCard,
  generateColumnNumbers,
  checkWinCondition,
  getWinningPattern,
  validateBingoCard,
  canMarkNumber
};
