/**
 * Mock Telebirr withdrawal endpoint
 * POST /api/wallet/withdraw
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
 *   "newBalance": 5.50,
 *   "transactionId": "tx_xxx",
 *   "message": "Withdrawal successful"
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
                error: 'Minimum withdrawal amount is 1.00 ETB'
            });
        }

        // Check for reasonable maximum (prevent abuse)
        if (amount > 5000) {
            return res.status(400).json({
                error: 'Maximum withdrawal amount is 5,000 ETB per transaction'
            });
        }

        // Get current balance
        let currentBalance = await getUserBalance(userId);

        // Check if user has sufficient balance
        if (amount > currentBalance) {
            return res.status(400).json({
                error: 'Insufficient balance',
                currentBalance: currentBalance,
                requestedAmount: amount
            });
        }

        // Simulate processing delay (3 seconds for realism)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Generate transaction ID
        const transactionId = generateTransactionId();

        // In development: mock successful withdrawal
        // In production: integrate with real Telebirr API
        const isDevelopment = process.env.NODE_ENV !== 'production';

        if (isDevelopment) {
            // Mock success for development
            currentBalance -= amount;

            // Store updated balance
            await storeUserBalance(userId, currentBalance);

            res.status(200).json({
                success: true,
                newBalance: currentBalance,
                transactionId: transactionId,
                amount: amount,
                currency: 'ETB',
                status: 'completed',
                message: 'Withdrawal successful (mock)',
                timestamp: new Date().toISOString(),
                estimatedArrival: new Date(Date.now() + 300000).toISOString(), // 5 minutes
                // Mock Telebirr response data
                telebirrData: {
                    referenceId: `TBR_${transactionId}`,
                    statusCode: '200',
                    statusMessage: 'Withdrawal Successful'
                }
            });

        } else {
            // Production: Real Telebirr integration
            try {
                const telebirrResponse = await processTelebirrWithdrawal(userId, amount, transactionId);

                if (telebirrResponse.success) {
                    currentBalance -= amount;
                    await storeUserBalance(userId, currentBalance);

                    res.status(200).json({
                        success: true,
                        newBalance: currentBalance,
                        transactionId: transactionId,
                        amount: amount,
                        currency: 'ETB',
                        status: 'completed',
                        message: 'Withdrawal successful',
                        timestamp: new Date().toISOString(),
                        estimatedArrival: telebirrResponse.estimatedArrival,
                        telebirrData: telebirrResponse
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        error: 'Telebirr withdrawal failed',
                        message: telebirrResponse.message,
                        transactionId: transactionId
                    });
                }

            } catch (telebirrError) {
                console.error('Telebirr API error:', telebirrError);

                res.status(500).json({
                    success: false,
                    error: 'Withdrawal processing failed',
                    message: 'Please try again later',
                    transactionId: transactionId
                });
            }
        }

    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Withdrawal processing failed',
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
 * Process withdrawal through Telebirr (production only)
 * @param {string} userId - User ID
 * @param {number} amount - Withdrawal amount
 * @param {string} transactionId - Transaction ID
 * @returns {Object} Telebirr response
 */
async function processTelebirrWithdrawal(userId, amount, transactionId) {
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
        statusMessage: 'Withdrawal Successful',
        amount: amount,
        currency: 'ETB',
        timestamp: new Date().toISOString(),
        estimatedArrival: new Date(Date.now() + 300000).toISOString(), // 5 minutes
        withdrawalFee: 0.00
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In real implementation, you would:
    /*
    const response = await fetch(`${telebirrConfig.apiUrl}/withdrawals`, {
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
            description: `Bingo game withdrawal - ${amount} ETB`,
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
 * Get withdrawal history for a user
 * GET /api/wallet/withdraw-history?userId=xxx&limit=10
 */
export async function withdrawHistoryHandler(req, res) {
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
                transactionId: 'tx_withdraw_001',
                amount: 15.75,
                currency: 'ETB',
                status: 'completed',
                timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                method: 'Telebirr',
                estimatedArrival: new Date(Date.now() - 86340000).toISOString()
            },
            {
                transactionId: 'tx_withdraw_002',
                amount: 8.50,
                currency: 'ETB',
                status: 'completed',
                timestamp: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
                method: 'Telebirr',
                estimatedArrival: new Date(Date.now() - 259170000).toISOString()
            }
        ];

        res.status(200).json({
            success: true,
            userId: userId,
            withdrawals: mockHistory.slice(0, parseInt(limit)),
            totalCount: mockHistory.length
        });

    } catch (error) {
        console.error('Error getting withdrawal history:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

/**
 * Get withdrawal limits and fees
 * GET /api/wallet/withdrawal-info
 */
export async function withdrawalInfoHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const withdrawalInfo = {
            limits: {
                minAmount: 1.00,
                maxAmountPerTransaction: 5000.00,
                maxAmountPerDay: 25000.00,
                maxTransactionsPerDay: 5
            },
            fees: {
                telebirr: 0.00,
                bankTransfer: 0.00,
                processingTime: '1-5 minutes'
            },
            methods: [
                {
                    id: 'telebirr',
                    name: 'Telebirr',
                    minAmount: 1.00,
                    maxAmount: 5000.00,
                    fee: 0.00,
                    processingTime: '1-2 minutes'
                },
                {
                    id: 'bank_transfer',
                    name: 'Bank Transfer',
                    minAmount: 10.00,
                    maxAmount: 25000.00,
                    fee: 0.00,
                    processingTime: '2-5 minutes'
                }
            ],
            requirements: [
                'Valid phone number registered with Telebirr',
                'Sufficient balance in gaming wallet',
                'Compliance with local regulations'
            ]
        };

        res.status(200).json({
            success: true,
            withdrawalInfo: withdrawalInfo
        });

    } catch (error) {
        console.error('Error getting withdrawal info:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

/**
 * Cancel a pending withdrawal
 * POST /api/wallet/cancel-withdrawal
 */
export async function cancelWithdrawalHandler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, transactionId } = req.body;

    if (!userId || !transactionId) {
        return res.status(400).json({
            error: 'userId and transactionId are required'
        });
    }

    try {
        // In production, check if withdrawal can be cancelled
        // For demo, always return success
        res.status(200).json({
            success: true,
            message: 'Withdrawal cancelled successfully',
            transactionId: transactionId,
            refundAmount: 0, // Amount refunded to balance
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error cancelling withdrawal:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}
