# 🎲 Telegram Bingo Mini App with Telebirr Integration

A complete, production-ready Telegram Mini App for multiplayer Bingo gaming with Ethiopian Birr (ETB) wallet functionality via Telebirr integration.

## ✨ Features

### 🎮 Game Features
- **20 pre-generated Bingo cards** with standard B-I-N-G-O format
- **Multiplayer support** with real-time gameplay
- **1-3 cards per player** (1 ETB per card)
- **60-second countdown** before game starts
- **Real-time number drawing** every second
- **Win detection** for rows, columns, and diagonals
- **Multiple simultaneous winners** with fair prize distribution
- **80% prize pool** distribution to winners

### 💰 Wallet System
- **Telebirr integration** for deposits and withdrawals
- **Real-time balance** display and updates
- **Minimum deposit/withdrawal** amounts
- **Transaction history** and status tracking
- **Mock implementation** for development
- **Production-ready** structure for real Telebirr API

### 🚀 Technical Features
- **Telegram WebApp SDK** integration
- **Server-Sent Events (SSE)** for real-time updates
- **Vercel Edge Functions** for backend
- **Responsive design** for mobile devices
- **Theme integration** with Telegram's color scheme
- **Error handling** and loading states

## 📁 Project Structure

```
/
├── public/
│   └── index.html                 # Main Telegram Mini App
├── api/
│   ├── create-session.js          # Create new game sessions
│   ├── join-session.js            # Join existing sessions
│   ├── draw.js                    # SSE endpoint for real-time draws
│   └── wallet/
│       ├── deposit.js             # Telebirr deposit handling
│       └── withdraw.js            # Telebirr withdrawal handling
├── lib/
│   ├── bingo.js                   # Bingo game logic utilities
│   └── telegram.js                # Telegram SDK helpers
├── vercel.json                    # Vercel deployment configuration
└── README.md                      # This file
```

## 🚀 Quick Start

### Prerequisites
- **Vercel account** (for deployment)
- **Upstash Redis** account (for production data storage)
- **Telegram Bot Token** (for production Telebirr integration)

### Local Development

1. **Clone and setup:**
   ```bash
   git clone <your-repo-url>
   cd telegram-bingo
   ```

2. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

3. **Set up environment variables:**
   ```bash
   # Create .env.local file
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   TELEBIRR_MERCHANT_ID=your_merchant_id
   TELEBIRR_API_KEY=your_api_key
   TELEBIRR_API_SECRET=your_api_secret
   ```

4. **Run locally:**
   ```bash
   vercel dev
   ```

5. **Open in Telegram:**
   - Go to `@BotFather` in Telegram
   - Create a new bot and get your bot token
   - Set up webhook or use direct links for testing

### Production Deployment

1. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Set environment variables in Vercel dashboard:**
   - Go to your project in Vercel
   - Navigate to Settings → Environment Variables
   - Add all required variables

3. **Configure Telegram Bot:**
   - Set bot domain to your Vercel URL
   - Enable Mini App in BotFather

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token | Yes |
| `TELEBIRR_MERCHANT_ID` | Telebirr merchant identifier | Production |
| `TELEBIRR_API_KEY` | Telebirr API key | Production |
| `TELEBIRR_API_SECRET` | Telebirr API secret | Production |
| `TELEBIRR_API_URL` | Telebirr API base URL | Production |

### Vercel Configuration

The `vercel.json` file includes:
- **Edge Functions** configuration for API routes
- **SSE headers** for real-time draw streaming
- **CORS headers** for cross-origin requests
- **Static file** serving for the frontend

## 🎮 Game Flow

### Player Journey

1. **App Launch**
   - Telegram WebApp initializes
   - User authentication via Telegram
   - Balance loaded from storage

2. **Card Selection**
   - 20 unique Bingo cards displayed
   - Player selects 1-3 cards (1 ETB each)
   - Balance validated before proceeding

3. **Game Session**
   - Auto-join or create new session
   - Wait for minimum players (2)
   - 60-second countdown begins

4. **Gameplay**
   - Numbers drawn every second
   - Real-time updates via SSE
   - Cards marked automatically
   - Win detection on each draw

5. **Game End**
   - Winners announced
   - Prizes distributed (80% of pot)
   - Return to card selection

### Session Management

- **Automatic session creation** when first player joins
- **60-second countdown** after minimum players reached
- **Real-time player count** updates
- **Automatic cleanup** after game ends
- **Maximum 50 players** per session

## 💳 Wallet Integration

### Deposit Process

1. **Initiate Deposit**
   ```javascript
   // Frontend request
   await fetch('/api/wallet/deposit', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userId: 'telegram_user_id',
       amount: 10.50
     })
   });
   ```

2. **Development Mode**
   - Mock success after 2 seconds
   - Balance updated immediately
   - Transaction logged for reference

3. **Production Mode**
   - Real Telebirr API integration
   - Invoice generation via Telegram
   - Webhook confirmation handling

### Withdrawal Process

1. **Initiate Withdrawal**
   ```javascript
   // Frontend request
   await fetch('/api/wallet/withdraw', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userId: 'telegram_user_id',
       amount: 5.00
     })
   });
   ```

2. **Validation**
   - Minimum 1.00 ETB withdrawal
   - Maximum 5,000 ETB per transaction
   - Sufficient balance verification

3. **Processing**
   - Mock processing in development
   - Real Telebirr API in production
   - Estimated arrival time provided

## 🔧 API Endpoints

### Session Management

#### `POST /api/create-session`
Create a new game session.

**Response:**
```json
{
  "success": true,
  "sessionId": "session_abc123",
  "session": {
    "id": "session_abc123",
    "players": [],
    "gameState": "waiting",
    "countdown": 60
  }
}
```

#### `POST /api/join-session`
Join an existing session or create new one.

**Request:**
```json
{
  "userId": "telegram_user_id",
  "cardIndices": [0, 1, 2],
  "cardCost": 3
}
```

### Real-time Updates

#### `GET /api/draw?sessionId=xxx`
Server-Sent Events stream for game updates.

**Events:**
- `session`: Initial session state
- `countdown`: Countdown updates
- `gameState`: Game state changes
- `gameEnd`: Game completion with winners

### Wallet Operations

#### `POST /api/wallet/deposit`
Process ETB deposit via Telebirr.

#### `POST /api/wallet/withdraw`
Process ETB withdrawal to Telebirr.

#### `GET /api/wallet/deposit-history?userId=xxx`
Get user's deposit history.

#### `GET /api/wallet/withdraw-history?userId=xxx`
Get user's withdrawal history.

## 🛠 Development

### File Structure Details

#### `public/index.html`
- Complete Telegram Mini App frontend
- Vanilla JavaScript (no frameworks)
- Responsive CSS with Telegram theming
- Real-time SSE integration
- Wallet management UI

#### `lib/bingo.js`
- Card generation algorithms
- Win detection logic
- Number validation
- Game state utilities

#### `lib/telegram.js`
- WebApp SDK wrapper
- Theme management
- User authentication
- Development fallbacks

#### `api/*.js`
- Vercel Edge Functions
- Session management
- Real-time game logic
- Wallet operations

### Key Technical Decisions

1. **Edge Functions**: Used for minimal latency and global distribution
2. **Server-Sent Events**: Real-time updates without WebSocket complexity
3. **In-memory storage**: Simplified demo with Redis upgrade path
4. **Vanilla JavaScript**: No build step, direct deployment
5. **Telegram theming**: Native look and feel

### Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| **Storage** | In-memory | Upstash Redis |
| **Wallet** | Mock responses | Real Telebirr API |
| **Draws** | Simulated | Server-validated |
| **Balance** | localStorage | Redis-backed |

## 🔒 Security Considerations

### Data Protection
- **User IDs** stored securely in sessions
- **Balance data** encrypted in transit
- **Transaction logs** for audit trails
- **Input validation** on all endpoints

### Telegram Integration
- **Init data validation** for authenticity
- **Webhook signature** verification
- **Rate limiting** on API endpoints
- **CORS configuration** for cross-origin requests

### Telebirr Integration
- **API credentials** stored securely in environment
- **Webhook endpoints** for payment confirmation
- **Transaction verification** before balance updates
- **Error handling** for failed payments

## 🚀 Deployment Checklist

- [ ] **Vercel account** set up
- [ ] **Upstash Redis** database created
- [ ] **Environment variables** configured
- [ ] **Telegram bot** created and configured
- [ ] **Domain** (optional) for custom URL
- [ ] **Webhook** URL set in Telegram
- [ ] **Testing** completed in development

## 🧪 Testing

### Manual Testing Steps

1. **Open in Telegram WebApp**
2. **Check balance display** (starts at 10.00 ETB)
3. **Select 1-3 cards** and start game
4. **Verify countdown** timer works
5. **Check real-time draws** appear
6. **Test deposit/withdrawal** modals
7. **Verify win detection** (may take multiple games)

### Automated Testing

```javascript
// Example test structure
describe('Bingo Game', () => {
  test('card generation creates valid cards', () => {
    const card = generateBingoCard();
    expect(card.B.length).toBe(5);
    expect(card.N[2]).toBe('FREE');
  });

  test('win detection works correctly', () => {
    const card = generateBingoCard();
    const markedNumbers = ['B1', 'B2', 'B3', 'B4', 'B5'];
    expect(checkCardForWin(card, markedNumbers)).toBe(true);
  });
});
```

## 📊 Performance

### Optimization Features

- **Edge Functions** for global latency
- **SSE** for efficient real-time updates
- **Minimal dependencies** for fast loading
- **Responsive images** and optimized CSS
- **Connection pooling** for Redis

### Monitoring

- **Error tracking** with console logging
- **Performance metrics** via Vercel analytics
- **User engagement** monitoring
- **Transaction success** rates

## 🔄 Updates and Maintenance

### Regular Tasks

1. **Monitor session cleanup** (runs every 6 hours)
2. **Check Redis storage** usage
3. **Update Telegram WebApp** features as needed
4. **Review transaction logs** for issues

### Version Updates

- **Semantic versioning** for releases
- **Backward compatibility** maintained
- **Gradual rollout** for major changes
- **Rollback plan** for failed deployments

## 🆘 Troubleshooting

### Common Issues

**Game won't start:**
- Check minimum player requirement (2 players)
- Verify session creation is working
- Check browser console for errors

**Balance not updating:**
- Verify API endpoints are accessible
- Check environment variables
- Confirm Redis connection (production)

**Real-time updates not working:**
- Check SSE endpoint accessibility
- Verify session ID is valid
- Check browser compatibility

**Telegram integration issues:**
- Verify bot token is correct
- Check WebApp initialization
- Confirm domain/webhook setup

### Debug Mode

Enable debug logging:
```javascript
// Add to browser console
localStorage.setItem('debug', 'true');
```

## 📞 Support

For technical support or questions:
- **Documentation**: This README file
- **Issues**: GitHub Issues (if applicable)
- **Logs**: Vercel function logs
- **Monitoring**: Vercel dashboard

## 📋 License

This project is created for educational and demonstration purposes. Please ensure compliance with local regulations for real-money gaming applications.

---

**🎯 Ready to deploy!** Follow the deployment checklist above to get your Bingo game running in Telegram.
