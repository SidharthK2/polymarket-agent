# 🤖 Polymarket Multi-Agent Trading System

A sophisticated Telegram bot powered by AI agents for personalized prediction market discovery and trading on Polymarket.

## ✨ Features

### 🧠 **Multi-Agent Architecture**
- **Interest Profiler Agent**: Analyzes user preferences and trading interests
- **Market Recommender Agent**: Discovers relevant markets using advanced search
- **Trading Agent**: Executes orders and manages positions
- **Onboarding Coordinator**: Orchestrates the complete user experience

### 🎯 **Intelligent Market Discovery**
- Natural language market search across categories (crypto, sports, politics, tech)
- Tag-based filtering and volume/liquidity optimization
- Personalized recommendations based on user interest profiling
- Real-time market data and price discovery

### ⚡ **Advanced Trading Capabilities**
- **Order Types**: Market orders (FOK), limit orders (GTC), and time-based orders (GTD)
- **Order Management**: Balance validation, position tracking, and requirement checking
- **Risk Management**: Automatic order size validation and balance verification
- **Portfolio Analytics**: Position monitoring and P&L tracking

### 💬 **Telegram Integration**
- Conversational interface for natural trading commands
- State persistence across conversations
- Real-time order execution and status updates
- Error handling with actionable user guidance

## 🏗️ Architecture

```
Telegram User Input
        ↓
  Onboarding Coordinator
        ↓
   Interest Profiler → Market Recommender → Trading Agent
        ↓                     ↓                   ↓
   User Preferences    Market Discovery    Order Execution
        ↓                     ↓                   ↓
     ADK State         Polymarket APIs      CLOB Trading
```

### 🔧 **Core Components**

#### **IQAI ADK Integration**
- Multi-agent orchestration with state management
- Tool integration via Model Context Protocol (MCP)
- Conversation persistence and context awareness

#### **Polymarket Integration**
- **Gamma API**: Market discovery and metadata
- **CLOB API**: Real-time trading and order management  
- **Data API**: Portfolio positions and historical data

## 🚀 **Getting Started**

### Prerequisites
- Node.js 24+
- TypeScript
- Telegram Bot Token
- Polymarket wallet with USDC balance

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd polymarket-agent

# Install dependencies
npm install

# Build the project
npm run build
```

### Environment Setup

Create a `.env` file:

```env
# Required
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
PRIVATE_KEY=your_wallet_private_key
LLM_MODEL=gemini-2.5-flash-preview-05-20
GOOGLE_API_KEY=your_google_api_key
CG_API_KEY=your_coingecko_api_key

# Optional
DEBUG=false
COINGECKO_ENVIRONMENT=demo
CLOB_API_URL=https://clob.polymarket.com
POLYGON_RPC_URL=https://polygon-rpc.com
```

### Running the System

```bash
# Start the multi-agent system
npm start

# Development mode with debugging
DEBUG=true npm start
```

## 🎮 **Usage Examples**

### Market Discovery
```
User: "Show me crypto markets"
Bot: [Returns personalized crypto prediction markets with prices]

User: "Find sports betting opportunities"  
Bot: [Discovers relevant sports markets based on volume and liquidity]
```

### Trading Operations
```
User: "0xb656b85f5d1af20590c9ffff863e5f3e5820d75f42d5f781c1775071dc86e65a"
Bot: [Prepares Bitcoin market for trading with current prices]

User: "Buy 10 Yes at 0.65"
Bot: [Executes buy order and returns confirmation with order ID]

User: "Sell 5 No at 0.40"
Bot: [Places sell order and shows execution details]
```

### Portfolio Management
```
User: "Show my positions"
Bot: [Displays current holdings with P&L breakdown]

User: "Check my orders"  
Bot: [Lists active orders and status updates]
```

## 📦 **Project Structure**

```
src/
├── agents/                          # AI agent implementations
│   ├── interest-profiler-agent.ts   # User preference analysis
│   ├── market-recommender-agent.ts  # Market discovery logic
│   ├── trading-agent.ts             # Order execution specialist
│   └── onboarding-coordinator.ts    # Main orchestration agent
├── services/
│   └── polymarket-service.ts        # Core Polymarket API integration
├── tools/
│   └── polymarket.ts                # MCP tool definitions
├── env.ts                           # Environment configuration
└── index.ts                         # Application entry point
```

## 🔌 **Polymarket MCP Server**

This project includes a standalone MCP server for Polymarket integration:

### Features
- **Market Search**: Discovery across categories with tag filtering
- **Real-time Data**: Order books, prices, and market metadata
- **Trading Operations**: Order creation, validation, and execution
- **Portfolio Management**: Position tracking and balance monitoring

### Available Tools
```typescript
// Market Discovery
SEARCH_POLYMARKET_MARKETS
SEARCH_POLYMARKET_BY_INTERESTS  
GET_POLYMARKET_EVENTS
GET_POLYMARKET_MARKETS

// Trading Operations  
CREATE_POLYMARKET_BUY_ORDER
CREATE_POLYMARKET_SELL_ORDER
CREATE_POLYMARKET_MARKET_BUY_ORDER
CREATE_POLYMARKET_MARKET_SELL_ORDER
CREATE_POLYMARKET_GTD_ORDER

// Market Analysis
GET_POLYMARKET_ORDERBOOK
SELECT_MARKET_FOR_TRADING
CHECK_BUY_ORDER_REQUIREMENTS
CHECK_SELL_ORDER_REQUIREMENTS

// Portfolio Management
GET_POLYMARKET_POSITIONS
GET_POLYMARKET_USER_ORDERS
```

### Standalone Usage

```bash
# Build the MCP server
cd polymarket-mcp
npm install && npm run build

# Run as standalone MCP server
node dist/index.js
```

## 🛠️ **Technical Stack**

### Core Technologies
- **TypeScript**: Type-safe development with comprehensive schemas
- **IQAI ADK**: Advanced agent framework with state management
- **Model Context Protocol (MCP)**: Standardized tool integration
- **Polymarket APIs**: Gamma (discovery), CLOB (trading), Data (analytics)
- **Telegram Bot API**: Conversational interface with rich formatting

### API Integrations
- **Polymarket Gamma API**: Market metadata and discovery
- **Polymarket CLOB API**: Real-time trading and order management
- **Polymarket Data API**: Portfolio positions and analytics
- **CoinGecko API**: Crypto market data and price feeds
- **Telegram Bot API**: Message handling and user interaction

### Development Tools
- **Zod**: Runtime type validation and schema enforcement
- **dotenv**: Environment configuration management
- **ethers.js**: Ethereum wallet and transaction handling
- **FastMCP**: High-performance MCP server implementation

## 🔒 **Security Features**

- Secure private key handling with ethers.js wallet integration
- API credential derivation following Polymarket security standards
- Balance and allowance validation before order execution
- Error handling with detailed logging for debugging
- Rate limiting and request optimization

## 🎯 **Use Cases**

### Individual Traders
- Discover markets aligned with personal interests
- Execute trades through natural conversation
- Monitor portfolio performance and P&L
- Get real-time market insights and pricing data

### Developers
- Integrate Polymarket functionality into applications
- Build custom trading interfaces and workflows  
- Access comprehensive market data and analytics
- Implement automated trading strategies

### Research & Analytics
- Analyze prediction market trends and sentiment
- Track market performance across categories
- Study user behavior and trading patterns
- Generate insights on market efficiency

## 📈 **Performance**

- **Market Discovery**: Sub-second response times via optimized API calls
- **Order Execution**: Real-time trading with immediate confirmation
- **State Management**: Persistent conversation context with SQLite backend
- **Error Recovery**: Graceful degradation with helpful user feedback

## 📄 **License**

MIT License - See LICENSE file for details

---
