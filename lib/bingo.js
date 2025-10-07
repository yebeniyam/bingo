/**
 * Bingo game utility functions
 * Handles card generation, win detection, and game logic
 */

/**
 * Generates a standard 5x5 Bingo card with B-I-N-G-O columns
 * @returns {Object} Card object with B, I, N, G, O arrays
 */
export function generateBingoCard() {
    const card = {
        B: [],
        I: [],
        N: [],
        G: [],
        O: []
    };

    // Generate numbers for each column with proper ranges
    card.B = shuffleArray(generateRange(1, 15)).slice(0, 5);
    card.I = shuffleArray(generateRange(16, 30)).slice(0, 5);
    card.N = shuffleArray(generateRange(31, 45)).slice(0, 5);
    card.G = shuffleArray(generateRange(46, 60)).slice(0, 5);
    card.O = shuffleArray(generateRange(61, 75)).slice(0, 5);

    // Set center cell as FREE
    card.N[2] = 'FREE';

    return card;
}

/**
 * Generates an array of numbers in a given range
 * @param {number} start - Start of range (inclusive)
 * @param {number} end - End of range (inclusive)
 * @returns {Array} Array of numbers in the range
 */
export function generateRange(start, end) {
    const range = [];
    for (let i = start; i <= end; i++) {
        range.push(i);
    }
    return range;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled copy of the array
 */
export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Generates multiple unique Bingo cards
 * @param {number} count - Number of cards to generate
 * @returns {Array} Array of Bingo card objects
 */
export function generateBingoCards(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
        cards.push(generateBingoCard());
    }
    return cards;
}

/**
 * Checks if a Bingo card has won based on marked numbers
 * @param {Object} card - Bingo card object
 * @param {Array} markedNumbers - Array of marked number strings (e.g., ['B5', 'I23'])
 * @returns {boolean} True if card has a winning pattern
 */
export function checkCardForWin(card, markedNumbers) {
    // Convert card to flat array of cell values
    const cells = [];
    for (const col of ['B', 'I', 'N', 'G', 'O']) {
        card[col].forEach((value, index) => {
            cells.push({
                value: value,
                col: col,
                row: index,
                isFree: value === 'FREE'
            });
        });
    }

    // Check rows
    for (let row = 0; row < 5; row++) {
        if (checkLineWin(cells, row * 5, (i) => i + 1, 5)) {
            return true;
        }
    }

    // Check columns
    for (let col = 0; col < 5; col++) {
        if (checkLineWin(cells, col, (i) => i + 5, 5)) {
            return true;
        }
    }

    // Check diagonals
    if (checkLineWin(cells, 0, (i) => i + 6, 5)) { // Main diagonal
        return true;
    }
    if (checkLineWin(cells, 4, (i) => i + 4, 5)) { // Anti-diagonal
        return true;
    }

    return false;
}

/**
 * Helper function to check if a line (row, column, or diagonal) is a winning line
 * @param {Array} cells - Array of cell objects
 * @param {number} startIndex - Starting index in cells array
 * @param {Function} nextIndex - Function to get next index
 * @param {number} length - Length of line to check
 * @returns {boolean} True if line is a win
 */
function checkLineWin(cells, startIndex, nextIndex, length) {
    for (let i = 0; i < length; i++) {
        const cellIndex = startIndex + (i === 0 ? 0 : nextIndex(i - 1));
        const cell = cells[cellIndex];

        // Cell must be either FREE or marked
        if (!cell.isFree && !isCellMarked(cell, markedNumbers)) {
            return false;
        }
    }
    return true;
}

/**
 * Checks if a specific cell is marked
 * @param {Object} cell - Cell object with col and value properties
 * @param {Array} markedNumbers - Array of marked number strings
 * @returns {boolean} True if cell is marked
 */
function isCellMarked(cell, markedNumbers) {
    if (cell.isFree) return true;

    const markKey = `${cell.col}${cell.value}`;
    return markedNumbers.includes(markKey);
}

/**
 * Gets all possible winning patterns for a card
 * @param {Object} card - Bingo card object
 * @returns {Array} Array of winning pattern objects
 */
export function getWinningPatterns(card) {
    const patterns = [];

    // Add row patterns
    for (let row = 0; row < 5; row++) {
        const pattern = [];
        for (let col = 0; col < 5; col++) {
            const colLetter = ['B', 'I', 'N', 'G', 'O'][col];
            const value = card[colLetter][row];
            pattern.push(value === 'FREE' ? 'FREE' : `${colLetter}${value}`);
        }
        patterns.push({
            type: 'row',
            row: row,
            cells: pattern
        });
    }

    // Add column patterns
    for (let col = 0; col < 5; col++) {
        const pattern = [];
        const colLetter = ['B', 'I', 'N', 'G', 'O'][col];
        for (let row = 0; row < 5; row++) {
            const value = card[colLetter][row];
            pattern.push(value === 'FREE' ? 'FREE' : `${colLetter}${value}`);
        }
        patterns.push({
            type: 'column',
            column: col,
            cells: pattern
        });
    }

    // Add diagonal patterns
    const diagonal1 = [];
    const diagonal2 = [];
    for (let i = 0; i < 5; i++) {
        const value1 = card[['B', 'I', 'N', 'G', 'O'][i]][i];
        const value2 = card[['B', 'I', 'N', 'G', 'O'][4 - i]][i];

        diagonal1.push(value1 === 'FREE' ? 'FREE' : `${['B', 'I', 'N', 'G', 'O'][i]}${value1}`);
        diagonal2.push(value2 === 'FREE' ? 'FREE' : `${['B', 'I', 'N', 'G', 'O'][4 - i]}${value2}`);
    }

    patterns.push({
        type: 'diagonal',
        direction: 'main',
        cells: diagonal1
    });

    patterns.push({
        type: 'diagonal',
        direction: 'anti',
        cells: diagonal2
    });

    return patterns;
}

/**
 * Validates that a Bingo card follows standard rules
 * @param {Object} card - Bingo card object to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validateBingoCard(card) {
    const errors = [];

    // Check that all columns exist
    const requiredColumns = ['B', 'I', 'N', 'G', 'O'];
    for (const col of requiredColumns) {
        if (!card[col] || !Array.isArray(card[col]) || card[col].length !== 5) {
            errors.push(`Column ${col} must have exactly 5 numbers`);
        }
    }

    // Check number ranges
    if (card.B) {
        card.B.forEach((num, index) => {
            if (num !== 'FREE' && (num < 1 || num > 15)) {
                errors.push(`B${index + 1} must be between 1-15`);
            }
        });
    }

    if (card.I) {
        card.I.forEach((num, index) => {
            if (num !== 'FREE' && (num < 16 || num > 30)) {
                errors.push(`I${index + 1} must be between 16-30`);
            }
        });
    }

    if (card.N) {
        card.N.forEach((num, index) => {
            if (num !== 'FREE' && (num < 31 || num > 45)) {
                errors.push(`N${index + 1} must be between 31-45`);
            }
        });
        // Check that center is FREE
        if (card.N[2] !== 'FREE') {
            errors.push('N3 (center) must be FREE');
        }
    }

    if (card.G) {
        card.G.forEach((num, index) => {
            if (num !== 'FREE' && (num < 46 || num > 60)) {
                errors.push(`G${index + 1} must be between 46-60`);
            }
        });
    }

    if (card.O) {
        card.O.forEach((num, index) => {
            if (num !== 'FREE' && (num < 61 || num > 75)) {
                errors.push(`O${index + 1} must be between 61-75`);
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Calculates the total pot for a game session
 * @param {number} playerCount - Number of players in the session
 * @param {number} cardsPerPlayer - Average cards per player
 * @returns {number} Total pot in ETB
 */
export function calculateTotalPot(playerCount, cardsPerPlayer) {
    const totalCards = playerCount * cardsPerPlayer;
    return totalCards * 1.0; // 1 ETB per card
}

/**
 * Calculates prize per winner based on total pot and winner count
 * @param {number} totalPot - Total pot in ETB
 * @param {number} winnerCount - Number of winners
 * @returns {number} Prize per winner in ETB
 */
export function calculatePrizePerWinner(totalPot, winnerCount) {
    if (winnerCount === 0) return 0;
    return (totalPot * 0.8) / winnerCount; // 80% of pot distributed to winners
}

/**
 * Generates a random draw in B-I-N-G-O format
 * @param {Array} usedNumbers - Array of already drawn numbers to avoid duplicates
 * @returns {string|null} Random draw like 'B15' or null if no numbers left
 */
export function generateRandomDraw(usedNumbers = []) {
    const columns = [
        { letter: 'B', min: 1, max: 15 },
        { letter: 'I', min: 16, max: 30 },
        { letter: 'N', min: 31, max: 45 },
        { letter: 'G', min: 46, max: 60 },
        { letter: 'O', min: 61, max: 75 }
    ];

    // Filter out columns that still have available numbers
    const availableColumns = columns.filter(col => {
        const usedInColumn = usedNumbers.filter(num => num.startsWith(col.letter)).length;
        return usedInColumn < 15; // Each column has 15 numbers
    });

    if (availableColumns.length === 0) {
        return null; // No more numbers available
    }

    // Pick random column
    const randomColumn = availableColumns[Math.floor(Math.random() * availableColumns.length)];

    // Generate available numbers in this column
    const availableNumbers = [];
    for (let num = randomColumn.min; num <= randomColumn.max; num++) {
        const drawKey = `${randomColumn.letter}${num}`;
        if (!usedNumbers.includes(drawKey)) {
            availableNumbers.push(num);
        }
    }

    if (availableNumbers.length === 0) {
        return generateRandomDraw(usedNumbers); // Try another column
    }

    // Pick random number from available numbers
    const randomNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    return `${randomColumn.letter}${randomNumber}`;
}

/**
 * Creates a complete draw sequence for a game (75 unique draws)
 * @returns {Array} Array of 75 unique draw strings
 */
export function generateCompleteDrawSequence() {
    const draws = [];
    const usedNumbers = [];

    while (draws.length < 75) {
        const draw = generateRandomDraw(usedNumbers);
        if (draw) {
            draws.push(draw);
            usedNumbers.push(draw);
        } else {
            break; // Should not happen in a complete game
        }
    }

    return draws;
}

/**
 * Validates a draw string format
 * @param {string} draw - Draw string to validate (e.g., 'B15')
 * @returns {boolean} True if valid format
 */
export function isValidDraw(draw) {
    if (typeof draw !== 'string' || draw.length < 2 || draw.length > 3) {
        return false;
    }

    const letter = draw.charAt(0).toUpperCase();
    const number = parseInt(draw.substring(1));

    if (!['B', 'I', 'N', 'G', 'O'].includes(letter)) {
        return false;
    }

    const ranges = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
    const [min, max] = ranges[letter];

    return number >= min && number <= max && !isNaN(number);
}

/**
 * Converts card data to a format suitable for frontend display
 * @param {Object} card - Bingo card object
 * @returns {Array} 5x5 array for easy frontend rendering
 */
export function cardToDisplayArray(card) {
    const displayArray = [];

    for (let row = 0; row < 5; row++) {
        const rowArray = [];
        for (const col of ['B', 'I', 'N', 'G', 'O']) {
            rowArray.push({
                value: card[col][row],
                letter: col,
                isFree: card[col][row] === 'FREE'
            });
        }
        displayArray.push(rowArray);
    }

    return displayArray;
}

/**
 * Creates a card from a display array (reverse of cardToDisplayArray)
 * @param {Array} displayArray - 5x5 display array
 * @returns {Object} Bingo card object
 */
export function displayArrayToCard(displayArray) {
    const card = { B: [], I: [], N: [], G: [], O: [] };

    displayArray.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const colLetter = ['B', 'I', 'N', 'G', 'O'][colIndex];
            card[colLetter][rowIndex] = cell.value;
        });
    });

    return card;
}
