// Bingo game logic utilities

export function generateBingoCard() {
  const ranges = [
    { min: 1, max: 15 },   // B
    { min: 16, max: 30 },  // I
    { min: 31, max: 45 },  // N
    { min: 46, max: 60 },  // G
    { min: 61, max: 75 }   // O
  ];

  const card = [];
  
  for (let col = 0; col < 5; col++) {
    const numbers = generateColumnNumbers(ranges[col].min, ranges[col].max);
    
    for (let row = 0; row < 5; row++) {
      if (row === 2 && col === 2) {
        // Center cell - FREE space
        card.push({ 
          number: 'FREE', 
          isFree: true, 
          row, 
          col,
          index: row * 5 + col
        });
      } else {
        card.push({ 
          number: numbers[row], 
          isFree: false, 
          row, 
          col,
          index: row * 5 + col
        });
      }
    }
  }
  
  return card;
}

export function generateColumnNumbers(min, max) {
  const numbers = [];
  while (numbers.length < 5) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers;
}

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

function checkBothDiagonals(markedCells) {
  // Main diagonal (0,0 to 4,4)
  let mainDiagonalComplete = true;
  for (let i = 0; i < 5; i++) {
    const index = i * 5 + i;
    if (index !== 12 && !markedCells.has(index)) {
      mainDiagonalComplete = false;
      break;
    }
  }

  // Anti-diagonal (0,4 to 4,0)
  let antiDiagonalComplete = true;
  for (let i = 0; i < 5; i++) {
    const index = i * 5 + (4 - i);
    if (index !== 12 && !markedCells.has(index)) {
      antiDiagonalComplete = false;
      break;
    }
  }

  return mainDiagonalComplete && antiDiagonalComplete;
}

function checkFourCorners(markedCells) {
  const corners = [0, 4, 20, 24]; // Top-left, top-right, bottom-left, bottom-right
  return corners.every(index => markedCells.has(index));
}

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
    if (rowComplete) patterns.push({ type: 'row', cells: rowCells, index: row });
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
    if (colComplete) patterns.push({ type: 'column', cells: colCells, index: col });
  }

  // Check diagonals
  let mainComplete = true;
  let antiComplete = true;
  const mainCells = [];
  const antiCells = [];
  
  for (let i = 0; i < 5; i++) {
    const mainIndex = i * 5 + i;
    const antiIndex = i * 5 + (4 - i);
    
    mainCells.push(mainIndex);
    antiCells.push(antiIndex);
    
    if (mainIndex !== 12 && !markedCells.has(mainIndex)) mainComplete = false;
    if (antiIndex !== 12 && !markedCells.has(antiIndex)) antiComplete = false;
  }
  
  if (mainComplete) patterns.push({ type: 'diagonal', cells: mainCells, which: 'main' });
  if (antiComplete) patterns.push({ type: 'diagonal', cells: antiCells, which: 'anti' });

  // Check four corners
  const corners = [0, 4, 20, 24];
  if (corners.every(index => markedCells.has(index))) {
    patterns.push({ type: 'corners', cells: corners });
  }

  return patterns;
}

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
