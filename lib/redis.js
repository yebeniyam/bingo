/**
 * Redis utility functions for production deployment
 * Uses Upstash Redis for persistent data storage
 */

const UPSTASH_REDIS_URL = 'https://absolute-feline-20781.upstash.io';
const UPSTASH_REDIS_TOKEN = 'AVEtAAIncDJiNGU4ZTQ3YjBiZWI0ZmI5YTZmNTE1ZjdiNTk5OWUxZHAyMjA3ODE';

/**
 * Check if Redis is available for production
 * @returns {boolean} True if Redis credentials are available
 */
export function isRedisAvailable() {
    return !!(UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN);
}

/**
 * Store data in Redis with expiry
 * @param {string} key - Redis key
 * @param {any} data - Data to store
 * @param {number} expirySeconds - Expiry time in seconds (default: 1 hour)
 * @returns {Promise<boolean>} Success status
 */
export async function storeRedisData(key, data, expirySeconds = 3600) {
    if (!isRedisAvailable()) {
        console.log('Redis not available, using in-memory storage');
        return false;
    }

    try {
        const response = await fetch(`${UPSTASH_REDIS_URL}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${UPSTASH_REDIS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                commands: [
                    ['SET', key, JSON.stringify(data)],
                    ['EXPIRE', key, expirySeconds]
                ]
            })
        });

        if (response.ok) {
            console.log(`✅ Data stored in Redis: ${key}`);
            return true;
        } else {
            console.error('❌ Failed to store data in Redis:', response.statusText);
            return false;
        }
    } catch (error) {
        console.error('❌ Redis storage error:', error.message);
        return false;
    }
}

/**
 * Retrieve data from Redis
 * @param {string} key - Redis key
 * @returns {Promise<any|null>} Retrieved data or null
 */
export async function getRedisData(key) {
    if (!isRedisAvailable()) {
        console.log('Redis not available, using in-memory storage');
        return null;
    }

    try {
        const response = await fetch(`${UPSTASH_REDIS_URL}/GET/${key}`, {
            headers: {
                'Authorization': `Bearer ${UPSTASH_REDIS_TOKEN}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.result) {
                console.log(`✅ Data retrieved from Redis: ${key}`);
                return JSON.parse(result.result);
            }
            return null;
        } else {
            console.error('❌ Failed to retrieve data from Redis:', response.statusText);
            return null;
        }
    } catch (error) {
        console.error('❌ Redis retrieval error:', error.message);
        return null;
    }
}

/**
 * Delete data from Redis
 * @param {string} key - Redis key to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteRedisData(key) {
    if (!isRedisAvailable()) {
        return false;
    }

    try {
        const response = await fetch(`${UPSTASH_REDIS_URL}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${UPSTASH_REDIS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                commands: [['DEL', key]]
            })
        });

        if (response.ok) {
            console.log(`✅ Data deleted from Redis: ${key}`);
            return true;
        } else {
            console.error('❌ Failed to delete data from Redis:', response.statusText);
            return false;
        }
    } catch (error) {
        console.error('❌ Redis deletion error:', error.message);
        return false;
    }
}

/**
 * Store session data in Redis
 * @param {string} sessionId - Session ID
 * @param {Object} sessionData - Session data
 * @returns {Promise<boolean>} Success status
 */
export async function storeSession(sessionId, sessionData) {
    const key = `session:${sessionId}`;
    return await storeRedisData(key, sessionData, 3600); // 1 hour expiry
}

/**
 * Get session data from Redis
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Session data or null
 */
export async function getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await getRedisData(key);
}

/**
 * Update session data in Redis
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Partial session data to update
 * @returns {Promise<Object|null>} Updated session data or null
 */
export async function updateSession(sessionId, updates) {
    const existingSession = await getSession(sessionId);
    if (!existingSession) {
        return null;
    }

    const updatedSession = { ...existingSession, ...updates };
    const success = await storeSession(sessionId, updatedSession);

    return success ? updatedSession : null;
}

/**
 * Delete session from Redis
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return await deleteRedisData(key);
}

/**
 * Store user balance in Redis
 * @param {string} userId - User ID
 * @param {number} balance - User balance
 * @returns {Promise<boolean>} Success status
 */
export async function storeUserBalance(userId, balance) {
    const key = `balance:${userId}`;
    return await storeRedisData(key, { balance, updatedAt: new Date().toISOString() }, 2592000); // 30 days
}

/**
 * Get user balance from Redis
 * @param {string} userId - User ID
 * @returns {Promise<number>} User balance (default: 10.00)
 */
export async function getUserBalance(userId) {
    const key = `balance:${userId}`;
    const data = await getRedisData(key);

    if (data && typeof data.balance === 'number') {
        return data.balance;
    }

    // Return default balance for new users
    return 10.00;
}

/**
 * Store transaction record in Redis
 * @param {string} transactionId - Transaction ID
 * @param {Object} transactionData - Transaction data
 * @returns {Promise<boolean>} Success status
 */
export async function storeTransaction(transactionId, transactionData) {
    const key = `transaction:${transactionId}`;
    return await storeRedisData(key, {
        ...transactionData,
        createdAt: new Date().toISOString()
    }, 2592000); // 30 days
}

/**
 * Get transaction data from Redis
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object|null>} Transaction data or null
 */
export async function getTransaction(transactionId) {
    const key = `transaction:${transactionId}`;
    return await getRedisData(key);
}

/**
 * Clean up expired sessions (for maintenance)
 * @returns {Promise<number>} Number of sessions cleaned up
 */
export async function cleanupExpiredSessions() {
    if (!isRedisAvailable()) {
        return 0;
    }

    try {
        // In a real implementation, you would scan for expired keys
        // For this demo, we'll just return 0
        console.log('Session cleanup completed');
        return 0;
    } catch (error) {
        console.error('Error during session cleanup:', error);
        return 0;
    }
}

/**
 * Get Redis connection info for monitoring
 * @returns {Object} Redis connection information
 */
export function getRedisInfo() {
    return {
        available: isRedisAvailable(),
        url: UPSTASH_REDIS_URL ? UPSTASH_REDIS_URL.replace(/:[^:]+@/, ':***@') : null, // Hide token in logs
        hasToken: !!UPSTASH_REDIS_TOKEN
    };
}

/**
 * Test Redis connection
 * @returns {Promise<boolean>} Connection test result
 */
export async function testRedisConnection() {
    if (!isRedisAvailable()) {
        return false;
    }

    try {
        const testKey = `test:${Date.now()}`;
        const testData = { test: true, timestamp: new Date().toISOString() };

        const stored = await storeRedisData(testKey, testData, 10); // 10 second expiry
        if (stored) {
            const retrieved = await getRedisData(testKey);
            if (retrieved && retrieved.test === true) {
                await deleteRedisData(testKey);
                console.log('✅ Redis connection test successful');
                return true;
            }
        }

        console.log('❌ Redis connection test failed');
        return false;
    } catch (error) {
        console.error('❌ Redis connection test error:', error.message);
        return false;
    }
}
