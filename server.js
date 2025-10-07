/**
 * Node.js server for Telegram Bingo Mini App on Render
 * Handles static file serving and API routes
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// In-memory storage for demo (in production, use Redis)
global.sessions = global.sessions || new Map();
global.userBalances = global.userBalances || new Map();

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

// Get user balance
function getUserBalance(userId) {
    return global.userBalances.get(userId) || 10.00;
}

// Store user balance
function storeUserBalance(userId, balance) {
    global.userBalances.set(userId, balance);
}

// Get session data
function getSession(sessionId) {
    return global.sessions.get(sessionId) || null;
}

// Update session data
function updateSession(sessionId, updates) {
    const session = getSession(sessionId);
    if (!session) {
        throw new Error('Session not found');
    }

    const updatedSession = { ...session, ...updates };
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
            let session = getSession(sessionId);

            if (!session) {
                // Create new session
                const createResult = await new Promise(resolve => {
                    handleCreateSession({ method: 'POST' }, {
                        writeHead: (code) => ({ end: (data) => resolve(JSON.parse(data)) }),
                        end: (data) => resolve(JSON.parse(data))
                    });
                });
                sessionId = createResult.sessionId;
                session = createResult.session;
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
            global.sessions.set(sessionId, session);

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                sessionId: sessionId,
                playerId: playerId,
                message: 'Joined session successfully',
                gameState: session.gameState
            }));

        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to join session' }));
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

    const session = getSession(sessionId);
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
    const interval = setInterval(() => {
        const currentSession = getSession(sessionId);
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
                global.sessions.set(sessionId, currentSession);

                sendSSE(res, 'draw', {
                    draw: draw,
                    drawnNumbers: currentSession.drawnNumbers
                });
            }
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

            let currentBalance = getUserBalance(userId);
            currentBalance += amount;
            storeUserBalance(userId, currentBalance);

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

            let currentBalance = getUserBalance(userId);

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
            storeUserBalance(userId, currentBalance);

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
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Withdrawal failed' }));
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
