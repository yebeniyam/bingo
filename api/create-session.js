/**
 * Create a new Bingo game session
 * POST /api/create-session
 *
 * This endpoint creates a new game session and returns a session ID.
 * Sessions are used to group players together for a multiplayer game.
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // In a real implementation, you would use Upstash Redis or similar
        // For this example, we'll use in-memory storage (not persistent across deployments)
        const sessionId = generateSessionId();
        const session = {
            id: sessionId,
            createdAt: new Date().toISOString(),
            players: [],
            drawnNumbers: [],
            gameState: 'waiting', // waiting, countdown, playing, finished
            countdown: 60, // seconds until game starts
            maxPlayers: 50, // reasonable limit
            minPlayers: 2, // minimum players to start
            active: true
        };

        // Store session (in production, use Redis)
        await storeSession(sessionId, session);

        res.status(200).json({
            success: true,
            sessionId: sessionId,
            session: session
        });

    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({
            error: 'Failed to create session',
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
 * Store session data
 * In production, this would use Upstash Redis
 * @param {string} sessionId - Session ID
 * @param {Object} session - Session data
 */
async function storeSession(sessionId, session) {
    // For Vercel Edge Functions, we can't use traditional Redis clients
    // In production, you would use Upstash Redis REST API or similar

    // For this example, we'll use a simple in-memory approach
    // Note: This won't persist across function instances/deployments
    if (typeof global !== 'undefined') {
        if (!global.sessions) {
            global.sessions = new Map();
        }
        global.sessions.set(sessionId, session);
    }

    // In production, use Upstash Redis REST API:
    /*
    const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            commands: [
                ['SET', `session:${sessionId}`, JSON.stringify(session)],
                ['EXPIRE', `session:${sessionId}`, 3600] // 1 hour expiry
            ]
        })
    });

    if (!response.ok) {
        throw new Error('Failed to store session in Redis');
    }
    */
}

/**
 * Get session data
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session data or null if not found
 */
export async function getSession(sessionId) {
    if (typeof global !== 'undefined' && global.sessions) {
        return global.sessions.get(sessionId) || null;
    }

    // In production, use Upstash Redis REST API:
    /*
    try {
        const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/GET/session:${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.result ? JSON.parse(data.result) : null;
        }
    } catch (error) {
        console.error('Error getting session from Redis:', error);
    }
    */

    return null;
}

/**
 * Update session data
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Partial session data to update
 */
export async function updateSession(sessionId, updates) {
    const session = await getSession(sessionId);
    if (!session) {
        throw new Error('Session not found');
    }

    const updatedSession = { ...session, ...updates };

    if (typeof global !== 'undefined' && global.sessions) {
        global.sessions.set(sessionId, updatedSession);
    }

    // In production, use Upstash Redis REST API:
    /*
    await fetch(`${process.env.UPSTASH_REDIS_REST_URL}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            commands: [
                ['SET', `session:${sessionId}`, JSON.stringify(updatedSession)]
            ]
        })
    });
    */

    return updatedSession;
}

/**
 * Delete session
 * @param {string} sessionId - Session ID
 */
export async function deleteSession(sessionId) {
    if (typeof global !== 'undefined' && global.sessions) {
        global.sessions.delete(sessionId);
    }

    // In production, use Upstash Redis REST API:
    /*
    await fetch(`${process.env.UPSTASH_REDIS_REST_URL}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            commands: [
                ['DEL', `session:${sessionId}`]
            ]
        })
    });
    */
}
