/**
 * Node.js server for Telegram Bingo Mini App on Render
 * Handles static file serving and API routes with Redis support
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Redis configuration - Use environment variables from Render
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Import Redis utilities
let redisAvailable = false;
if (UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN) {
    try {
        const redisModule = require('./lib/redis.js');
        redisAvailable = true;
        console.log('🔴 Redis status: Available (Production Mode)');
    } catch (error) {
        console.log('🔴 Redis module not found, using in-memory storage');
        redisAvailable = false;
    }
} else {
    console.log('🔴 Redis credentials not found, using in-memory storage');
    redisAvailable = false;
}

// In-memory storage as fallback
global.sessions = global.sessions || new Map();
global.userBalances = global.userBalances || new Map();
global.availableCards = global.availableCards || new Map();
global.gameLoops = global.gameLoops || new Map();
global.sseConnections = global.sseConnections || new Map();
global.cardReservations = global.cardReservations || new Map();

// Helper function to generate session ID
function generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Helper function to generate player ID
function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Helper function to generate transaction ID
function generateTransactionId() {
    return 'tx_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Get user balance (Redis in production, in-memory for development)
async function getUserBalance(userId) {
    if (redisAvailable) {
        try {
            const redisModule = require('./lib/redis.js');
            return await redisModule.getUserBalance(userId);
        } catch (error) {
            console.error('Redis error, falling back to in-memory:', error.message);
        }
    }

    // Fallback to in-memory storage
    return global.userBalances.get(userId) || 10.00;
}

// Store user balance (Redis in production, in-memory for development)
async function storeUserBalance(userId, balance) {
    if (redisAvailable) {
        try {
            const redisModule = require('./lib/redis.js');
            const success = await redisModule.storeUserBalance(userId, balance);
            if (success) {
                return true;
            }
        } catch (error) {
            console.error('Redis error, falling back to in-memory:', error.message);
        }
    }

    // Fallback to in-memory storage
    global.userBalances.set(userId, balance);
    return true;
}

// Get session data (Redis in production, in-memory for development)
async function getSession(sessionId) {
    if (redisAvailable) {
        try {
            const redisModule = require('./lib/redis.js');
            const session = await redisModule.getSession(sessionId);
            if (session) {
                return session;
            }
        } catch (error) {
            console.error('Redis error, falling back to in-memory:', error.message);
        }
    }

    // Fallback to in-memory storage
    return global.sessions.get(sessionId) || null;
}

// Update session data (Redis in production, in-memory for development)
async function updateSession(sessionId, updates) {
    const session = await getSession(sessionId);
    if (!session) {
        throw new Error('Session not found');
    }

    const updatedSession = { ...session, ...updates };

    if (redisAvailable) {
        try {
            const redisModule = require('./lib/redis.js');
            const success = await redisModule.storeSession(sessionId, updatedSession);
            if (success) {
                return updatedSession;
            }
        } catch (error) {
            console.error('Redis error, falling back to in-memory:', error.message);
        }
    }

    // Fallback to in-memory storage
    global.sessions.set(sessionId, updatedSession);
    return updatedSession;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // Serve static files from public directory
        if (pathname === '/' || pathname === '/index.html') {
            serveStaticFile('/index.html', res);
        } else if (pathname.startsWith('/api/')) {
            await handleAPI(req, res, pathname, parsedUrl.query);
        } else if (pathname.includes('.')) {
            serveStaticFile(pathname, res);
        } else {
            // Serve index.html for client-side routing
            serveStaticFile('/index.html', res);
        }
    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
});

// Serve static files
function serveStaticFile(filePath, res) {
    const fullPath = path.join(__dirname, 'public', filePath);

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }

        const ext = path.extname(fullPath);
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json'
        };

        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.writeHead(200);
        res.end(data);
    });
}

// Initialize card pool
function initializeCardPool() {
    // Generate 20 unique Bingo cards
    const cards = [];
    for (let i = 0; i < 20; i++) {
        cards.push(generateBingoCard());
    }
    return cards;
}

// Generate a Bingo card
function generateBingoCard() {
    const card = {
        B: [],
        I: [],
        N: [],
        G: [],
        O: []
    };

    // Generate numbers for each column
    card.B = shuffleArray(generateRange(1, 15)).slice(0, 5);
    card.I = shuffleArray(generateRange(16, 30)).slice(0, 5);
    card.N = shuffleArray(generateRange(31, 45)).slice(0, 5);
    card.G = shuffleArray(generateRange(46, 60)).slice(0, 5);
    card.O = shuffleArray(generateRange(61, 75)).slice(0, 5);

    // Set center cell as FREE
    card.N[2] = 'FREE';

    return card;
}

function generateRange(start, end) {
    const range = [];
    for (let i = start; i <= end; i++) {
        range.push(i);
    }
    return range;
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Handle API routes
async function handleAPI(req, res, pathname, query) {
    const method = req.method;

    // Set JSON content type for API responses
    res.setHeader('Content-Type', 'application/json');

    if (pathname === '/api/cards' && method === 'GET') {
        await handleGetAvailableCards(req, res);
    } else if (pathname === '/api/admin/players' && method === 'GET') {
        await handleGetPlayers(req, res, query);
    } else if (pathname === '/api/admin/sessions' && method === 'GET') {
        await handleGetSessions(req, res);
    } else if (pathname === '/api/create-session' && method === 'POST') {
        await handleCreateSession(req, res);
    } else if (pathname === '/api/join-session' && method === 'POST') {
        await handleJoinSession(req, res);
    } else if (pathname === '/api/draw' && method === 'GET') {
        await handleDrawSSE(req, res, query);
    } else if (pathname === '/api/wallet/deposit' && method === 'POST') {
        await handleDeposit(req, res);
    } else if (pathname === '/api/wallet/withdraw' && method === 'POST') {
        await handleWithdraw(req, res);
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
    }
}

// Handle getting available cards
async function handleGetAvailableCards(req, res) {
    try {
        // Initialize card pool if not exists
        if (!global.availableCards.has('cardPool')) {
            const cardPool = initializeCardPool();
            global.availableCards.set('cardPool', cardPool);
        }

        const cardPool = global.availableCards.get('cardPool');
        const availableCards = [];
        const reservedCards = [];

        // Check which cards are available
        for (let i = 0; i < cardPool.length; i++) {
            if (global.cardReservations.has(i)) {
                reservedCards.push({
                    index: i,
                    reservedBy: global.cardReservations.get(i),
                    card: null // Don't send card data for reserved cards
                });
            } else {
                availableCards.push({
                    index: i,
                    card: cardPool[i]
                });
            }
        }

        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            availableCards: availableCards,
            reservedCards: reservedCards,
            totalCards: cardPool.length,
            availableCount: availableCards.length,
            reservedCount: reservedCards.length
        }));

    } catch (error) {
        console.error('Error getting available cards:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to get available cards' }));
    }
}

// Handle getting players (admin function)
async function handleGetPlayers(req, res, query) {
    try {
        const sessionId = query.sessionId || 'demo_session';
        const session = await getSession(sessionId);

        if (!session) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Session not found' }));
            return;
        }

        // Get card details for each player
        const playersWithCards = session.players.map(player => {
            const cardPool = global.availableCards.get('cardPool') || [];
            const playerCards = player.cardIndices.map(index => ({
                index: index,
                card: cardPool[index] || null
            }));

            return {
                id: player.id,
                userId: player.userId,
                userIdShort: player.userId.slice(-4),
                cardIndices: player.cardIndices,
                cards: playerCards,
                cardCost: player.cardCost,
                joinedAt: player.joinedAt,
                balance: player.balance,
                isReady: player.isReady,
                hasWon: player.hasWon
            };
        });

        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            sessionId: session.id,
            sessionState: session.gameState,
            players: playersWithCards,
            totalPlayers: session.players.length,
            gameState: session.gameState,
            countdown: session.countdown,
            drawnNumbers: session.drawnNumbers
        }));

    } catch (error) {
        console.error('Error getting players:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to get players' }));
    }
}

// Handle getting all sessions (admin function)
async function handleGetSessions(req, res) {
    try {
        const sessions = [];
        const reservations = [];

        // Get all sessions
        for (const [sessionId, session] of global.sessions.entries()) {
            sessions.push({
                id: session.id,
                createdAt: session.createdAt,
                playerCount: session.players.length,
                gameState: session.gameState,
                countdown: session.countdown,
                active: session.active,
                drawnNumbers: session.drawnNumbers.length
            });
        }

        // Get all card reservations
        for (const [cardIndex, userId] of global.cardReservations.entries()) {
            reservations.push({
                cardIndex: cardIndex,
                userId: userId,
                userIdShort: userId.slice(-4)
            });
        }

        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            sessions: sessions,
            cardReservations: reservations,
            totalSessions: sessions.length,
            totalReservations: reservations.length,
            serverInfo: {
                redisAvailable: redisAvailable,
                totalGameLoops: global.gameLoops.size,
                totalConnections: Array.from(global.sseConnections.values()).reduce((sum, arr) => sum + arr.length, 0)
            }
        }));

    } catch (error) {
        console.error('Error getting sessions:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to get sessions' }));
    }
}

// Handle session creation
async function handleCreateSession(req, res) {
    const sessionId = generateSessionId();
    const session = {
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

    global.sessions.set(sessionId, session);

    res.writeHead(200);
    res.end(JSON.stringify({
        success: true,
        sessionId: sessionId,
        session: session
    }));
}

// Handle joining session
async function handleJoinSession(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { userId, cardIndices, cardCost } = JSON.parse(body);

            if (!userId || !Array.isArray(cardIndices) || typeof cardCost !== 'number') {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request body' }));
                return;
            }

            // Validate card indices and check availability
            console.log(`🔍 Checking card availability for user ${userId.slice(-4)}:`, cardIndices);
            console.log(`📋 Current reservations:`, Array.from(global.cardReservations.entries()));

            for (const cardIndex of cardIndices) {
                if (global.cardReservations.has(cardIndex)) {
                    const reservedBy = global.cardReservations.get(cardIndex);
                    console.log(`❌ Card ${cardIndex} already reserved by ${reservedBy.slice(-4)}`);
                    res.writeHead(400);
                    res.end(JSON.stringify({
                        error: `Card ${cardIndex} is already taken by another player`
                    }));
                    return;
                }
            }

            // Reserve cards for this player
            console.log(`✅ Reserving cards ${cardIndices} for user ${userId.slice(-4)}`);
            cardIndices.forEach(cardIndex => {
                global.cardReservations.set(cardIndex, userId);
            });

            // Create session if one doesn't exist
            let sessionId = 'demo_session'; // For demo purposes
            let session = await getSession(sessionId);
            let isNewSession = false;

            if (!session) {
                // Create new session directly
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
                global.sessions.set(sessionId, session);
                isNewSession = true;
                console.log(`🆕 Created new session: ${sessionId}`);
            } else {
                console.log(`📋 Found existing session: ${sessionId} with ${session.players.length} players, state: ${session.gameState}`);
            }

            console.log(`👤 Player ${userId.slice(-4)} joining session ${sessionId}`);
            console.log(`📊 Before join - Players: ${session.players.length}, State: ${session.gameState}`);

            // Check if player already exists
            const existingPlayer = session.players.find(p => p.userId === userId);
            if (existingPlayer) {
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    sessionId: sessionId,
                    playerId: existingPlayer.id,
                    message: 'Already in session'
                }));
                return;
            }

            // Create new player
            const playerId = generatePlayerId();
            const player = {
                id: playerId,
                userId: userId,
                cardIndices: cardIndices,
                cardCost: cardCost,
                joinedAt: new Date().toISOString(),
                balance: 10.00,
                isReady: true,
                hasWon: false
            };

            session.players.push(player);

            // Update session (await the async function)
            const newGameState = session.players.length >= session.minPlayers ? 'countdown' : 'waiting';
            await updateSession(sessionId, {
                players: session.players,
                gameState: newGameState
            });

            // Start game loop if minimum players reached and not already started
            if (newGameState === 'countdown' && !global.gameLoops.has(sessionId)) {
                console.log(`🎮 Starting countdown for session ${sessionId} with ${session.players.length} players`);
                console.log(`📊 Session state:`, { gameState: newGameState, players: session.players.length, minPlayers: session.minPlayers });
                console.log(`🔄 Game loops before:`, Array.from(global.gameLoops.keys()));
                startGameLoop(sessionId);
                console.log(`✅ Game loop started for session ${sessionId}`);
            } else if (newGameState === 'waiting') {
                console.log(`⏳ Session ${sessionId} waiting for more players (${session.players.length}/${session.minPlayers})`);
            } else if (global.gameLoops.has(sessionId)) {
                console.log(`⚠️ Game loop already exists for session ${sessionId}`);
            }

            // Debug: Log current session state
            console.log(`🔍 Current session state after join:`, {
                sessionId: sessionId,
                players: session.players.length,
                gameState: newGameState,
                gameLoopExists: global.gameLoops.has(sessionId)
            });

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                sessionId: sessionId,
                playerId: playerId,
                message: 'Joined session successfully',
                gameState: newGameState,
                playerCount: session.players.length
            }));

        } catch (error) {
            console.error('Error joining session:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to join session', details: error.message }));
        }
    });
}

// Handle Server-Sent Events for real-time draws
async function handleDrawSSE(req, res, query) {
    const sessionId = query.sessionId;

    if (!sessionId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'sessionId parameter is required' }));
        return;
    }

    const session = await getSession(sessionId);
    if (!session) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Track SSE connection
    if (!global.sseConnections.has(sessionId)) {
        global.sseConnections.set(sessionId, []);
    }
    global.sseConnections.get(sessionId).push(res);

    // Send initial session state
    sendSSE(res, 'session', {
        sessionId: session.id,
        gameState: session.gameState,
        countdown: session.countdown,
        drawnNumbers: session.drawnNumbers,
        playerCount: session.players.length
    });

    // Send periodic updates
    const interval = setInterval(async () => {
        try {
            const currentSession = await getSession(sessionId);
            if (!currentSession || !currentSession.active) {
                sendSSE(res, 'gameEnd', { reason: 'Session ended' });
                clearInterval(interval);

                // Remove from connections
                const connections = global.sseConnections.get(sessionId) || [];
                const index = connections.indexOf(res);
                if (index > -1) {
                    connections.splice(index, 1);
                }

                res.end();
                return;
            }

            if (currentSession.gameState === 'countdown') {
                sendSSE(res, 'countdown', {
                    countdown: currentSession.countdown,
                    gameState: currentSession.gameState
                });
            }

            if (currentSession.gameState === 'playing') {
                // Generate random draw for demo
                const columns = ['B', 'I', 'N', 'G', 'O'];
                const randomColumn = columns[Math.floor(Math.random() * columns.length)];
                const min = randomColumn === 'B' ? 1 : randomColumn === 'I' ? 16 : randomColumn === 'N' ? 31 : randomColumn === 'G' ? 46 : 61;
                const max = min + 14;
                const number = Math.floor(Math.random() * (max - min + 1)) + min;
                const draw = `${randomColumn}${number}`;

                if (!currentSession.drawnNumbers.includes(draw)) {
                    currentSession.drawnNumbers.push(draw);

                    // Update session with new draw
                    await updateSession(sessionId, {
                        drawnNumbers: currentSession.drawnNumbers
                    });

                    sendSSE(res, 'draw', {
                        draw: draw,
                        drawnNumbers: currentSession.drawnNumbers
                    });
                }
            }
        } catch (error) {
            console.error('Error in draw interval:', error);
            clearInterval(interval);

            // Remove from connections
            const connections = global.sseConnections.get(sessionId) || [];
            const index = connections.indexOf(res);
            if (index > -1) {
                connections.splice(index, 1);
            }
        }
    }, 2000); // Send updates every 2 seconds for demo

    // Clean up on connection close
    req.on('close', () => {
        clearInterval(interval);

        // Remove from connections
        const connections = global.sseConnections.get(sessionId) || [];
        const index = connections.indexOf(res);
        if (index > -1) {
            connections.splice(index, 1);
        }
    });
}

// Handle deposit
async function handleDeposit(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { userId, amount } = JSON.parse(body);

            if (!userId || typeof amount !== 'number' || amount <= 0) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request body' }));
                return;
            }

            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            let currentBalance = await getUserBalance(userId);
            currentBalance += amount;
            await storeUserBalance(userId, currentBalance);

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                newBalance: currentBalance,
                transactionId: generateTransactionId(),
                amount: amount,
                currency: 'ETB',
                status: 'completed',
                message: 'Deposit successful (mock)'
            }));

        } catch (error) {
            console.error('Deposit error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Deposit failed' }));
        }
    });
}

// Handle withdrawal
async function handleWithdraw(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { userId, amount } = JSON.parse(body);

            if (!userId || typeof amount !== 'number' || amount <= 0) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request body' }));
                return;
            }

            let currentBalance = await getUserBalance(userId);

            if (amount > currentBalance) {
                res.writeHead(400);
                res.end(JSON.stringify({
                    error: 'Insufficient balance',
                    currentBalance: currentBalance,
                    requestedAmount: amount
                }));
                return;
            }

            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 3000));

            currentBalance -= amount;
            await storeUserBalance(userId, currentBalance);

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                newBalance: currentBalance,
                transactionId: generateTransactionId(),
                amount: amount,
                currency: 'ETB',
                status: 'completed',
                message: 'Withdrawal successful (mock)'
            }));

        } catch (error) {
            console.error('Withdrawal error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Withdrawal failed' }));
        }
    });
}

// Start the game loop for a session
async function startGameLoop(sessionId) {
    console.log(`🎮 Starting game loop for session: ${sessionId}`);

    // Store the game loop reference
    const gameInterval = setInterval(async () => {
        try {
            const session = await getSession(sessionId);
            if (!session || !session.active) {
                console.log(`🛑 Stopping game loop for session: ${sessionId}`);
                clearInterval(gameInterval);
                global.gameLoops.delete(sessionId);
                return;
            }

            if (session.gameState === 'countdown') {
                const newCountdown = session.countdown - 1;

                if (newCountdown <= 0) {
                    // Start the game
                    console.log(`🚀 Starting game for session: ${sessionId}`);
                    await updateSession(sessionId, {
                        gameState: 'playing',
                        countdown: 0,
                        gameStartedAt: new Date().toISOString()
                    });

                    // Send game started event to all connected clients
                    sendSSEToAll(sessionId, 'gameStarted', {
                        gameState: 'playing',
                        message: 'Game started!'
                    });
                } else {
                    await updateSession(sessionId, {
                        countdown: newCountdown
                    });

                    // Send countdown update to all connected clients
                    sendSSEToAll(sessionId, 'countdown', {
                        countdown: newCountdown,
                        gameState: 'countdown'
                    });
                }
            }
        } catch (error) {
            console.error('Error in game loop:', error);
            clearInterval(gameInterval);
            global.gameLoops.delete(sessionId);
        }
    }, 1000);

    global.gameLoops.set(sessionId, gameInterval);
}

// Send SSE event to all connected clients for a session
async function sendSSEToAll(sessionId, eventType, data) {
    // Get all SSE connections for this session
    const sessionConnections = global.sseConnections.get(sessionId) || [];

    console.log(`📡 Broadcasting ${eventType} to session ${sessionId} (${sessionConnections.length} connections):`, data);

    // Send event to all connected clients
    sessionConnections.forEach(res => {
        try {
            sendSSE(res, eventType, data);
        } catch (error) {
            console.error('Error sending SSE to client:', error);
        }
    });
}

// Send Server-Sent Event
function sendSSE(res, eventType, data) {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Telegram Bingo server running on port ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔗 GitHub: https://github.com/yebeniyam/bingo`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server closed');
    });
});
