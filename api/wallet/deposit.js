/**
 * Mock Telebirr deposit endpoint
 * POST /api/wallet/deposit
 *
 * Request body:
 * {
 *   "userId": "string",
 *   "amount": 10.50
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "newBalance": 20.50,
 *   "transactionId": "tx_xxx",
 *   "message": "Deposit successful"
 * }
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId, amount } = req.body;

        // Validate request body
        if (!userId || typeof amount !== 'number') {
            return res.status(400).json({
                error: 'Invalid request body. Required: userId (string), amount (number)'
            });
        }

        // Validate amount
        if (amount <= 0) {
            return res.status(400).json({
                error: 'Amount must be greater than 0'
            });
        }

        if (amount < 1.00) {
            return res.status(400).json({
                error: 'Minimum deposit amount is 1.00 ETB'
            });
        }

        // Check for reasonable maximum (prevent abuse)
        if (amount > 10000) {
            return res.status(400).json({
                error: 'Maximum deposit amount is 10,000 ETB'
            });
        }

        // Get current balance from storage
        let currentBalance = await getUserBalance(userId);

        // Simulate processing delay (2 seconds for realism)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate transaction ID
        const transactionId = generateTransactionId();

        // In development: mock successful deposit
        // In production: integrate with real Telebirr API
        const isDevelopment = process.env.NODE_ENV !== 'production';

        if (isDevelopment) {
            // Mock success for development
            currentBalance += amount;

            // Store updated balance
            await storeUserBalance(userId, currentBalance);

            res.status(200).json({
                success: true,
                newBalance: currentBalance,
                transactionId: transactionId,
                amount: amount,
                currency: 'ETB',
                status: 'completed',
                message: 'Deposit successful (mock)',
                timestamp: new Date().toISOString(),
                // Mock Telebirr response data
                telebirrData: {
                    referenceId: `TBR_${transactionId}`,
                    statusCode: '200',
                    statusMessage: 'Payment Successful'
                }
            });

        } else {
            // Production: Real Telebirr integration
            try {
                const telebirrResponse = await processTelebirrDeposit(userId, amount, transactionId);

                if (telebirrResponse.success) {
                    currentBalance += amount;
                    await storeUserBalance(userId, currentBalance);

                    res.status(200).json({
                        success: true,
                        newBalance: currentBalance,
                        transactionId: transactionId,
                        amount: amount,
                        currency: 'ETB',
                        status: 'completed',
                        message: 'Deposit successful',
                        timestamp: new Date().toISOString(),
                        telebirrData: telebirrResponse
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        error: 'Telebirr payment failed',
                        message: telebirrResponse.message,
                        transactionId: transactionId
                    });
                }

            } catch (telebirrError) {
                console.error('Telebirr API error:', telebirrError);

                res.status(500).json({
                    success: false,
                    error: 'Payment processing failed',
                    message: 'Please try again later',
                    transactionId: transactionId
                });
            }
        }

    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Deposit processing failed',
            details: error.message
        });
    }
}

/**
 * Generate a unique transaction ID
 * @returns {string} Unique transaction ID
 */
function generateTransactionId() {
    return 'tx_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Get user balance from storage
 * In production, this would use Redis or database
 * @param {string} userId - User ID
 * @returns {number} Current balance
 */
async function getUserBalance(userId) {
    // In-memory storage for demo (not persistent)
    if (typeof global !== 'undefined') {
        if (!global.userBalances) {
            global.userBalances = new Map();
        }
        return global.userBalances.get(userId) || 10.00; // Default starting balance
    }

    // In production, use Redis:
    /*
    try {
        const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/GET/balance:${userId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.result ? parseFloat(data.result) : 10.00;
        }
    } catch (error) {
        console.error('Error getting balance from Redis:', error);
    }
    */

    return 10.00; // Fallback
}

/**
 * Store user balance
 * @param {string} userId - User ID
 * @param {number} balance - New balance
 */
async function storeUserBalance(userId, balance) {
    // In-memory storage for demo
    if (typeof global !== 'undefined') {
        if (!global.userBalances) {
            global.userBalances = new Map();
        }
        global.userBalances.set(userId, balance);
    }

    // In production, use Redis:
    /*
    await fetch(`${process.env.UPSTASH_REDIS_REST_URL}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            commands: [
                ['SET', `balance:${userId}`, balance.toString()],
                ['EXPIRE', `balance:${userId}`, 2592000] // 30 days
            ]
        })
    });
    */
}

/**
 * Process deposit through Telebirr (production only)
 * @param {string} userId - User ID
 * @param {number} amount - Deposit amount
 * @param {string} transactionId - Transaction ID
 * @returns {Object} Telebirr response
 */
async function processTelebirrDeposit(userId, amount, transactionId) {
    // This is a mock implementation
    // In production, you would integrate with the actual Telebirr API

    const telebirrConfig = {
        apiUrl: process.env.TELEBIRR_API_URL || 'https://api.telebirr.com/v1',
        merchantId: process.env.TELEBIRR_MERCHANT_ID,
        apiKey: process.env.TELEBIRR_API_KEY,
        apiSecret: process.env.TELEBIRR_API_SECRET
    };

    // Mock API call
    const mockResponse = {
        success: true,
        referenceId: `TBR_${transactionId}`,
        statusCode: '200',
        statusMessage: 'Payment Successful',
        amount: amount,
        currency: 'ETB',
        timestamp: new Date().toISOString()
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In real implementation, you would:
    /*
    const response = await fetch(`${telebirrConfig.apiUrl}/payments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${telebirrConfig.apiKey}`,
            'X-API-Secret': telebirrConfig.apiSecret
        },
        body: JSON.stringify({
            merchantId: telebirrConfig.merchantId,
            amount: amount,
            currency: 'ETB',
            referenceId: transactionId,
            callbackUrl: `${process.env.VERCEL_URL}/api/wallet/telebirr-callback`,
            description: `Bingo game deposit - ${amount} ETB`,
            customerInfo: {
                customerId: userId
            }
        })
    });

    const result = await response.json();
    return result;
    */

    return mockResponse;
}

/**
 * Get deposit history for a user
 * GET /api/wallet/deposit-history?userId=xxx&limit=10
 */
export async function depositHistoryHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, limit = '10' } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId parameter is required' });
    }

    try {
        // In production, fetch from database
        // For demo, return mock data
        const mockHistory = [
            {
                transactionId: 'tx_abc123',
                amount: 10.50,
                currency: 'ETB',
                status: 'completed',
                timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                method: 'Telebirr'
            },
            {
                transactionId: 'tx_def456',
                amount: 25.00,
                currency: 'ETB',
                status: 'completed',
                timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                method: 'Telebirr'
            }
        ];

        res.status(200).json({
            success: true,
            userId: userId,
            deposits: mockHistory.slice(0, parseInt(limit)),
            totalCount: mockHistory.length
        });

    } catch (error) {
        console.error('Error getting deposit history:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

/**
 * Get supported payment methods
 * GET /api/wallet/payment-methods
 */
export async function paymentMethodsHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const paymentMethods = [
            {
                id: 'telebirr',
                name: 'Telebirr',
                type: 'mobile_money',
                currencies: ['ETB'],
                minAmount: 1.00,
                maxAmount: 10000.00,
                processingTime: 'Instant',
                fees: '0%',
                description: 'Ethiopian mobile money service'
            },
            {
                id: 'cbe',
                name: 'CBE Mobile Banking',
                type: 'bank_transfer',
                currencies: ['ETB'],
                minAmount: 5.00,
                maxAmount: 50000.00,
                processingTime: '1-2 minutes',
                fees: '0%',
                description: 'Commercial Bank of Ethiopia mobile banking'
            }
        ];

        res.status(200).json({
            success: true,
            paymentMethods: paymentMethods
        });

    } catch (error) {
        console.error('Error getting payment methods:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}
