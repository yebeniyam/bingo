import { getSession, updateSession } from '../api/create-session.js';

/**
 * Server-Sent Events endpoint for real-time Bingo draws
 * GET /api/draw?sessionId=xxx
 *
 * This endpoint streams game updates to connected clients using SSE.
 * Clients receive:
 * - New draws as they happen
 * - Countdown updates
 * - Game state changes
 * - Winner announcements
 */

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId } = req.query;

    // Validate sessionId parameter
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId parameter is required' });
    }

    try {
        // Get session data
        const session = await getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

        // Send initial session state
        sendSSE(res, 'session', {
            sessionId: session.id,
            gameState: session.gameState,
            countdown: session.countdown,
            drawnNumbers: session.drawnNumbers,
            playerCount: session.players.length
        });

        // Keep connection alive
        const keepAliveInterval = setInterval(() => {
            res.write(': keepalive\n\n');
        }, 30000); // Send keepalive every 30 seconds

        // Monitor session for updates
        const sessionMonitor = setInterval(async () => {
            try {
                const currentSession = await getSession(sessionId);
                if (!currentSession || !currentSession.active) {
                    // Session ended or not found
                    sendSSE(res, 'gameEnd', {
                        reason: 'Session ended',
                        finishedAt: currentSession?.finishedAt || new Date().toISOString()
                    });
                    clearInterval(sessionMonitor);
                    clearInterval(keepAliveInterval);
                    res.end();
                    return;
                }

                // Send countdown updates during countdown phase
                if (currentSession.gameState === 'countdown') {
                    sendSSE(res, 'countdown', {
                        countdown: currentSession.countdown,
                        gameState: currentSession.gameState
                    });
                }

                // Send game state updates during playing phase
                if (currentSession.gameState === 'playing') {
                    sendSSE(res, 'gameState', {
                        gameState: currentSession.gameState,
                        drawnNumbers: currentSession.drawnNumbers,
                        playerCount: currentSession.players.length
                    });
                }

                // Send winner information if game finished
                if (currentSession.gameState === 'finished' && currentSession.winners) {
                    sendSSE(res, 'gameEnd', {
                        winners: currentSession.winners,
                        prizePerWinner: currentSession.prizePerWinner,
                        totalPot: currentSession.players.reduce((sum, p) => sum + p.cardCost, 0),
                        finishedAt: currentSession.finishedAt
                    });
                    clearInterval(sessionMonitor);
                    clearInterval(keepAliveInterval);
                    res.end();
                }

            } catch (error) {
                console.error('Error monitoring session:', error);
                clearInterval(sessionMonitor);
                clearInterval(keepAliveInterval);
                res.end();
            }
        }, 1000); // Check every second

        // Handle client disconnect
        req.on('close', () => {
            clearInterval(sessionMonitor);
            clearInterval(keepAliveInterval);
            res.end();
        });

    } catch (error) {
        console.error('Error in draw endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

/**
 * Send Server-Sent Event data
 * @param {Object} res - Response object
 * @param {string} eventType - Type of event
 * @param {Object} data - Data to send
 */
function sendSSE(res, eventType, data) {
    try {
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
        console.error('Error sending SSE:', error);
    }
}

/**
 * Alternative polling-based endpoint for clients that don't support SSE
 * GET /api/draw-polling?sessionId=xxx&lastDrawIndex=0
 */
export async function pollingHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, lastDrawIndex = '0' } = req.query;

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId parameter is required' });
    }

    try {
        const session = await getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const lastIndex = parseInt(lastDrawIndex);
        const newDraws = session.drawnNumbers.slice(lastIndex);

        res.status(200).json({
            success: true,
            sessionId: session.id,
            gameState: session.gameState,
            countdown: session.gameState === 'countdown' ? session.countdown : 0,
            drawnNumbers: session.drawnNumbers,
            newDraws: newDraws,
            playerCount: session.players.length,
            winners: session.gameState === 'finished' ? session.winners : [],
            prizePerWinner: session.gameState === 'finished' ? session.prizePerWinner : 0,
            lastDrawIndex: session.drawnNumbers.length
        });

    } catch (error) {
        console.error('Error in polling endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

/**
 * WebSocket-style endpoint for real-time updates (alternative to SSE)
 * This would be used with a WebSocket library in production
 */
export async function websocketHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // For Vercel Edge Functions, WebSocket is not directly supported
    // In production, you would use a WebSocket service or upgrade to WebSockets

    res.status(200).json({
        error: 'WebSocket not supported in Edge Functions',
        message: 'Use SSE endpoint instead',
        sseEndpoint: '/api/draw'
    });
}

/**
 * Get current session state without establishing SSE connection
 * GET /api/session-state?sessionId=xxx
 */
export async function sessionStateHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId parameter is required' });
    }

    try {
        const session = await getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.status(200).json({
            success: true,
            sessionId: session.id,
            gameState: session.gameState,
            countdown: session.countdown,
            drawnNumbers: session.drawnNumbers,
            playerCount: session.players.length,
            maxPlayers: session.maxPlayers,
            minPlayers: session.minPlayers,
            createdAt: session.createdAt,
            active: session.active,
            // Don't send sensitive player data
            players: session.players.map(p => ({
                id: p.id,
                joinedAt: p.joinedAt,
                cardCount: p.cardIndices ? p.cardIndices.length : 0
            }))
        });

    } catch (error) {
        console.error('Error getting session state:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}
