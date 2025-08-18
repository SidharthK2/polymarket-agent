# Polymarket MCP Server

A Model Context Protocol (MCP) server for interacting with Polymarket prediction markets. This server provides AI agents with the ability to fetch market data, analyze order books, and execute trades on Polymarket.

## Features

- 📊 **Market Discovery**: Fetch available prediction markets
- 🔍 **Market Analysis**: Get detailed information about specific markets
- 📈 **Order Book Data**: Access real-time bid/ask data
- 💰 **Trading Operations**: Place buy and sell orders
- 👤 **Account Management**: View user's open orders

## Installation

```bash
cd polymarket-mcp
pnpm install
pnpm build
```

## Configuration

The Polymarket CLOB uses [two-level authentication](https://docs.polymarket.com/developers/CLOB/authentication):

### L1: Private Key Authentication (Required)
Set your Polygon private key for wallet control and order signing:

```bash
# Required: Your Polygon private key (controls funds, signs orders)
export WALLET_PRIVATE_KEY="0x1234567890abcdef..."
```

### L2: API Key Authentication (Optional)
If you have existing API credentials, you can provide them:

```bash
# Optional: Existing Polymarket CLOB API credentials
export CLOB_API_KEY="your_api_key_uuid"
export CLOB_SECRET="your_api_secret"
export CLOB_PASS_PHRASE="your_passphrase"
```

**Note**: If you don't provide API credentials, the client will automatically create/derive them using your private key according to the [Polymarket authentication flow](https://docs.polymarket.com/developers/CLOB/authentication#l2%3A-api-key-authentication).

### Additional Configuration
```bash
# Optional: Custom endpoints
export CLOB_API_URL="https://clob.polymarket.com"
export POLYGON_RPC_URL="https://polygon-rpc.com"
```

## Usage

### As a standalone MCP server:

```bash
pnpm start
```

### Integrating with an AI agent:

Add to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "node",
      "args": ["path/to/polymarket-mcp/dist/index.js"],
      "env": {
        "WALLET_PRIVATE_KEY": "your_private_key",
        "CLOB_API_KEY": "your_api_key"
      }
    }
  }
}
```

## Available Tools

### GET_POLYMARKET_MARKETS
Fetch available prediction markets with optional limit.

**Parameters:**
- `limit` (optional): Number of markets to fetch (1-50, default: 10)

### GET_POLYMARKET_MARKET
Get detailed information about a specific market.

**Parameters:**
- `conditionId`: The condition ID of the market

### GET_POLYMARKET_ORDERBOOK
Get the order book (bids and asks) for a specific token.

**Parameters:**
- `tokenId`: The token ID to get order book for

### CREATE_POLYMARKET_BUY_ORDER
Place a buy order on Polymarket.

**Parameters:**
- `tokenId`: The token ID to trade
- `price`: Order price between 0.01 and 0.99
- `size`: Order size (number of shares)

### CREATE_POLYMARKET_SELL_ORDER
Place a sell order on Polymarket.

**Parameters:**
- `tokenId`: The token ID to trade
- `price`: Order price between 0.01 and 0.99
- `size`: Order size (number of shares)

### GET_POLYMARKET_USER_ORDERS
Get the current user's orders on Polymarket.

**Parameters:** None

## Architecture

The server is built using:
- **FastMCP**: MCP protocol implementation
- **@polymarket/clob-client**: Official Polymarket CLOB API client
- **@ethersproject/wallet**: Ethereum wallet management
- **Zod**: Runtime type validation

## Security Considerations

- **Non-custodial**: Your private key controls your funds - the operator never has access
- **L1 Authentication**: Private key remains secure and is only used for signing orders
- **L2 Authentication**: API credentials are automatically managed or can be provided
- **Environment Variables**: All sensitive data is read from environment variables
- **Input Validation**: All parameters are validated using Zod schemas
- **No Logging**: Private keys and secrets are never logged or exposed

Learn more about [Polymarket's authentication security model](https://docs.polymarket.com/developers/CLOB/authentication).

## Development

```bash
# Watch mode for development
pnpm watch

# Build the project
pnpm build

# Start the server
pnpm start

# Development mode (build + start)
pnpm dev
```

## Integration Example

When integrated with an AI agent, you can use natural language to interact with Polymarket:

```
User: "Show me the top 5 prediction markets"
Agent: [Uses GET_POLYMARKET_MARKETS tool with limit=5]

User: "What's the order book for token xyz?"
Agent: [Uses GET_POLYMARKET_ORDERBOOK tool with tokenId="xyz"]

User: "Place a buy order for 100 shares at 0.65 for token abc"
Agent: [Uses CREATE_POLYMARKET_BUY_ORDER tool with appropriate parameters]
```

## License

MIT
