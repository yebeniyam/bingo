/**
 * Node.js server for Telegram Bingo Mini App on Render
 * Handles static file serving and API routes with Redis support
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Import Redis utilities (if available)
let redisAvailable = false;
try {
    // Dynamic import for Redis functions
    const redisModule = require('./lib/redis.js');
    redisAvailable = redisModule.isRedisAvailable();
    console.log('🔴 Redis status:', redisAvailable ? 'Available' : 'Not available (using in-memory storage)');
} catch (error) {
    console.log('🔴 Redis module not found, using in-memory storage');
}

// In-memory storage for demo (in production, use Redis)
global.sessions = global.sessions || new Map();
global.userBalances = global.userBalances || new Map();
global.availableCards = global.availableCards || new Map(); // Track available cards globally
global.gameLoops = global.gameLoops || new Map(); // Track active game loops
global.sseConnections = global.sseConnections || new Map(); // Track SSE connections

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

// Handle API routes
async function handleAPI(req, res, pathname, query) {
    const method = req.method;

    // Set JSON content type for API responses
    res.setHeader('Content-Type', 'application/json');

    if (pathname === '/api/create-session' && method === 'POST') {
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

            // Create session if one doesn't exist
            let sessionId = 'demo_session'; // For demo purposes
            let session = await getSession(sessionId);

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
            }

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
                startGameLoop(sessionId);
            }

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                sessionId: sessionId,
                playerId: playerId,
                message: 'Joined session successfully',
                gameState: newGameState
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
        }
    }, 2000); // Send updates every 2 seconds for demo

    // Clean up on connection close
    req.on('close', () => {
        clearInterval(interval);
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
    // In a production environment, you would track all SSE connections
    // For this demo, we'll just log the event
    console.log(`📡 Broadcasting ${eventType} to session ${sessionId}:`, data);
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
