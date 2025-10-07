import { getSession, updateSession } from '../api/create-session.js';

/**
 * Join a Bingo game session
 * POST /api/join-session
 *
 * Request body:
 * {
 *   "userId": "string",
 *   "cardIndices": [0, 1, 2], // indices of selected cards (0-19)
 *   "cardCost": 3 // total cost for selected cards
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "sessionId": "session_xxx",
 *   "playerId": "player_xxx",
 *   "message": "Joined session successfully"
 * }
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId, cardIndices, cardCost } = req.body;

        // Validate request body
        if (!userId || !Array.isArray(cardIndices) || typeof cardCost !== 'number') {
            return res.status(400).json({
                error: 'Invalid request body. Required: userId, cardIndices (array), cardCost (number)'
            });
        }

        // Validate card indices
        if (cardIndices.length === 0 || cardIndices.length > 3) {
            return res.status(400).json({
                error: 'Must select 1-3 cards'
            });
        }

        for (const index of cardIndices) {
            if (typeof index !== 'number' || index < 0 || index > 19) {
                return res.status(400).json({
                    error: `Invalid card index: ${index}. Must be 0-19.`
                });
            }
        }

        // For this demo, we'll create a session if one doesn't exist
        // In production, you might want to require a valid sessionId
        let sessionId = req.body.sessionId;
        let session = null;

        if (sessionId) {
            session = await getSession(sessionId);
            if (!session) {
                return res.status(404).json({
                    error: 'Session not found'
                });
            }
        } else {
            // Create new session for demo purposes
            sessionId = generateSessionId();
            session = {
                id: sessionId,
                createdAt: new Date().toISOString(),
                players: [],
                drawnNumbers: [],
                gameState: 'waiting',
                countdown: 60,
                maxPlayers: 50,
                minPlayers: 2,
                active: true
            };
        }

        // Check if session is full
        if (session.players.length >= session.maxPlayers) {
            return res.status(400).json({
                error: 'Session is full'
            });
        }

        // Check if player is already in session
        const existingPlayer = session.players.find(p => p.userId === userId);
        if (existingPlayer) {
            return res.status(200).json({
                success: true,
                sessionId: sessionId,
                playerId: existingPlayer.id,
                message: 'Already in session'
            });
        }

        // Create new player
        const playerId = generatePlayerId();
        const player = {
            id: playerId,
            userId: userId,
            cardIndices: cardIndices,
            cardCost: cardCost,
            joinedAt: new Date().toISOString(),
            balance: 10.00, // Starting balance for demo
            isReady: true,
            hasWon: false
        };

        // Add player to session
        session.players.push(player);

        // Update session
        await updateSession(sessionId, {
            players: session.players,
            // Start countdown if we have enough players
            gameState: session.players.length >= session.minPlayers ? 'countdown' : 'waiting'
        });

        // Start game loop if this is the first player or we reached minimum
        if (session.players.length === 1 || session.players.length === session.minPlayers) {
            startGameLoop(sessionId);
        }

        res.status(200).json({
            success: true,
            sessionId: sessionId,
            playerId: playerId,
            message: 'Joined session successfully',
            gameState: session.gameState
        });

    } catch (error) {
        console.error('Error joining session:', error);
        res.status(500).json({
            error: 'Failed to join session',
            details: error.message
        });
    }
}

/**
 * Generate a unique session ID
 * @returns {string} Unique session ID
 */
function generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Generate a unique player ID
 * @returns {string} Unique player ID
 */
function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Start the game loop for a session
 * This handles the countdown and game progression
 * @param {string} sessionId - Session ID
 */
async function startGameLoop(sessionId) {
    // In a real implementation, this would be handled by a more robust system
    // For this demo, we'll use a simple interval-based approach

    const gameInterval = setInterval(async () => {
        try {
            const session = await getSession(sessionId);
            if (!session || !session.active) {
                clearInterval(gameInterval);
                return;
            }

            if (session.gameState === 'countdown') {
                const newCountdown = session.countdown - 1;

                if (newCountdown <= 0) {
                    // Start the game
                    await updateSession(sessionId, {
                        gameState: 'playing',
                        countdown: 0,
                        gameStartedAt: new Date().toISOString()
                    });

                    // Start drawing numbers
                    startDrawingNumbers(sessionId, gameInterval);
                } else {
                    await updateSession(sessionId, {
                        countdown: newCountdown
                    });
                }
            }
        } catch (error) {
            console.error('Error in game loop:', error);
            clearInterval(gameInterval);
        }
    }, 1000);
}

/**
 * Start drawing numbers for a game session
 * @param {string} sessionId - Session ID
 * @param {Object} gameInterval - Game loop interval
 */
async function startDrawingNumbers(sessionId, gameInterval) {
    const drawInterval = setInterval(async () => {
        try {
            const session = await getSession(sessionId);
            if (!session || !session.active || session.gameState !== 'playing') {
                clearInterval(drawInterval);
                return;
            }

            // Generate next draw (simulate random draw)
            const columns = ['B', 'I', 'N', 'G', 'O'];
            const randomColumn = columns[Math.floor(Math.random() * columns.length)];
            const min = randomColumn === 'B' ? 1 : randomColumn === 'I' ? 16 : randomColumn === 'N' ? 31 : randomColumn === 'G' ? 46 : 61;
            const max = min + 14;

            let number;
            let attempts = 0;
            do {
                number = Math.floor(Math.random() * (max - min + 1)) + min;
                attempts++;
            } while (session.drawnNumbers.includes(`${randomColumn}${number}`) && attempts < 100);

            if (attempts >= 100) {
                // End game if no more numbers
                await endGame(sessionId, [], 0);
                clearInterval(drawInterval);
                return;
            }

            const draw = `${randomColumn}${number}`;
            const newDrawnNumbers = [...session.drawnNumbers, draw];

            // Update session with new draw
            await updateSession(sessionId, {
                drawnNumbers: newDrawnNumbers
            });

            // Check for winners after each draw
            await checkForWinners(sessionId, draw);

        } catch (error) {
            console.error('Error drawing number:', error);
            clearInterval(drawInterval);
        }
    }, 1000); // Draw every second for demo (in production, might be slower)
}

/**
 * Check all players for winning conditions
 * @param {string} sessionId - Session ID
 * @param {string} lastDraw - Last drawn number
 */
async function checkForWinners(sessionId, lastDraw) {
    try {
        const session = await getSession(sessionId);
        if (!session || !session.active) return;

        const winners = [];
        let totalPot = 0;

        // Calculate total pot (1 ETB per card)
        session.players.forEach(player => {
            totalPot += player.cardCost;
        });

        // Check each player for wins (simplified check)
        // In a real implementation, you would check actual cards
        session.players.forEach(player => {
            // Simple win condition for demo (every 10th draw)
            if (session.drawnNumbers.length >= 10 && !player.hasWon) {
                // Random win for demo purposes
                if (Math.random() < 0.1) { // 10% chance per draw after 10 draws
                    winners.push({
                        userId: player.userId,
                        playerId: player.id,
                        winningDraw: lastDraw,
                        prize: 0 // Will be calculated below
                    });
                    player.hasWon = true;
                }
            }
        });

        if (winners.length > 0) {
            // Calculate prize per winner
            const prizePerWinner = (totalPot * 0.8) / winners.length; // 80% of pot

            // Update winners with prize amount
            winners.forEach(winner => {
                winner.prize = prizePerWinner;
            });

            // End game with winners
            await endGame(sessionId, winners, prizePerWinner);
        }

        // Auto-end game after 75 draws (all numbers drawn)
        if (session.drawnNumbers.length >= 75) {
            await endGame(sessionId, [], 0);
        }

    } catch (error) {
        console.error('Error checking for winners:', error);
    }
}

/**
 * End the game and distribute prizes
 * @param {string} sessionId - Session ID
 * @param {Array} winners - Array of winner objects
 * @param {number} prizePerWinner - Prize amount per winner
 */
async function endGame(sessionId, winners, prizePerWinner) {
    try {
        const session = await getSession(sessionId);
        if (!session) return;

        // Update session as finished
        await updateSession(sessionId, {
            gameState: 'finished',
            winners: winners,
            prizePerWinner: prizePerWinner,
            finishedAt: new Date().toISOString(),
            active: false
        });

        // Update player balances (in production, use wallet API)
        for (const winner of winners) {
            const player = session.players.find(p => p.userId === winner.userId);
            if (player) {
                player.balance += prizePerWinner;
            }
        }

        console.log(`Game ${sessionId} ended. Winners:`, winners.length);

    } catch (error) {
        console.error('Error ending game:', error);
    }
}
