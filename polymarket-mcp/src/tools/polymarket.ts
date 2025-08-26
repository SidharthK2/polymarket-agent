import { z } from "zod";
import { PolymarketService } from "../services/polymarket-service.js";
import { Side } from "@polymarket/clob-client";
import dedent from "dedent";

/**
 * SIMPLIFIED POLYMARKET TOOLS - Ultra Clean & Effective
 * Matches the simplified PolymarketService
 */

interface Market {
	id: string;
	question: string;
	description?: string;
	endDate?: string;
	outcomes: string[];
	eventId?: string;
	eventTitle?: string;
	category?: string;
	conditionId?: string;
	volume24hr?: number;
	liquidity?: number;
	relevanceScore?: number;
}

/**
 * SIMPLIFIED: Enhanced search - now works for niche topics!
 */
export const searchMarketsTool = {
	name: "SEARCH_POLYMARKET_MARKETS",
	description:
		"Search Polymarket markets - now works great for crypto, AI, gaming, tech topics!",
	parameters: z.object({
		query: z
			.string()
			.min(1)
			.describe(
				"Search query (works great for: crypto, ai, gaming, tech, sports, politics)",
			),
		limit: z
			.number()
			.min(1)
			.max(50)
			.optional()
			.default(10)
			.describe("Number of markets to return (1-50)"),
	}),
	execute: async (params: {
		query: string;
		limit?: number;
	}): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const markets = await polymarketService.searchMarketsEnhanced(
				params.query,
				{
					limit: params.limit,
				},
			);

			if (markets.length === 0) {
				return dedent`
					🔍 No markets found for "${params.query}"

					Try popular topics like:
					- crypto, bitcoin, ethereum
					- ai, gpt, chatgpt  
					- gaming, gta
					- tech, meta
					- sports, soccer, nfl, nba
					- politics, election
				`;
			}

			return dedent`
				🎯 Found ${markets.length} markets for "${params.query}":

				${markets
					.map(
						(market, index) => dedent`
				${index + 1}. ${market.question}
				   💰 Volume: $${market.volume24hr?.toLocaleString() || "N/A"} | Liquidity: $${market.liquidity?.toLocaleString() || "N/A"}
				   📅 ${market.endDate ? `Ends: ${new Date(market.endDate).toLocaleDateString()}` : "End date TBD"}
				   🏷️ ${market.category || market.eventTitle || "General"}
				   🆔 Market ID: ${market.id}
				   📝 Condition ID: ${market.conditionId}
				   ${market.description ? `📋 ${market.description.slice(0, 100)}${market.description.length > 100 ? "..." : ""}` : ""}
			`,
					)
					.join("\n\n")}
			`;
		} catch (error) {
			return `Error searching markets: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

/**
 * SIMPLIFIED: Interest-based search
 */
export const searchMarketsByInterestsTool = {
	name: "SEARCH_POLYMARKET_BY_INTERESTS",
	description:
		"Find markets based on user interests - great for multiple topics",
	parameters: z.object({
		interests: z
			.array(z.string())
			.min(1)
			.describe("Array of interests (e.g., ['crypto', 'ai', 'sports'])"),
		limit: z
			.number()
			.min(1)
			.max(50)
			.optional()
			.default(10)
			.describe("Number of markets to return (1-50)"),
	}),
	execute: async (params: {
		interests: string[];
		limit?: number;
	}): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const markets = await polymarketService.searchMarketsByInterests(
				params.interests,
				{ limit: params.limit },
			);

			if (markets.length === 0) {
				return dedent`
					🎯 No markets found for interests: [${params.interests.join(", ")}]

					Try popular interests:
					- crypto, bitcoin, ethereum, defi
					- ai, gpt, technology  
					- gaming, video games
					- sports, soccer, basketball
					- politics, election
				`;
			}

			return dedent`
				🎯 Found ${markets.length} markets for interests [${params.interests.join(", ")}]:

				${markets
					.map(
						(market, index) => dedent`
				${index + 1}. ${market.question}
				   💰 Volume: $${market.volume24hr?.toLocaleString() || "N/A"}
				   📅 ${market.endDate ? `Ends: ${new Date(market.endDate).toLocaleDateString()}` : "End date TBD"}
				   🏷️ ${market.category || market.eventTitle || "General"}
				   🆔 Market ID: ${market.id} | Condition ID: ${market.conditionId}
			`,
					)
					.join("\n\n")}
			`;
		} catch (error) {
			return `Error finding markets: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

/**
 * SIMPLIFIED: Get popular markets
 */
export const getMarketsTool = {
	name: "GET_POLYMARKET_MARKETS",
	description: "Get popular Polymarket prediction markets",
	parameters: z.object({
		limit: z
			.number()
			.min(1)
			.max(50)
			.optional()
			.default(10)
			.describe("Number of markets to fetch (1-50)"),
	}),
	execute: async (params: { limit?: number }): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const markets = await polymarketService.searchMarketsEnhanced("", {
				limit: params.limit,
			});

			if (markets.length === 0) {
				return "No markets available right now.";
			}

			return dedent`
				📊 Top ${markets.length} popular markets:

				${markets
					.map(
						(market, index) => dedent`
				${index + 1}. ${market.question}
				   💰 Volume: $${market.volume24hr?.toLocaleString() || "N/A"}
				   🆔 ID: ${market.id} | Condition: ${market.conditionId}
				   📅 ${market.endDate ? `Ends: ${new Date(market.endDate).toLocaleDateString()}` : "TBD"}
			`,
					)
					.join("\n\n")}
			`;
		} catch (error) {
			return `Error fetching markets: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

/**
 * Get markets by events (unchanged)
 */
export const getMarketsByEventsTool = {
	name: "GET_POLYMARKET_EVENTS",
	description: "Get markets organized by events",
	parameters: z.object({
		limit: z
			.number()
			.min(1)
			.max(50)
			.optional()
			.default(10)
			.describe("Number of events to fetch"),
	}),
	execute: async (params: { limit?: number }): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const eventGroups = await polymarketService.getMarketsByEvents(
				params.limit || 10,
			);

			if (Object.keys(eventGroups).length === 0) {
				return "No events found.";
			}

			return dedent`
				📊 Found ${Object.keys(eventGroups).length} events:

				${Object.entries(eventGroups)
					.map(
						([eventTitle, markets]) => dedent`
					🎯 EVENT: ${eventTitle}
					${markets
						.map(
							(market, index) =>
								`   ${index + 1}. ${market.question} (ID: ${market.id})`,
						)
						.join("\n")}
				`,
					)
					.join("\n\n")}
			`;
		} catch (error) {
			return `Error fetching events: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

/**
 * Get specific market (unchanged)
 */
export const getMarketTool = {
	name: "GET_POLYMARKET_MARKET",
	description: "Get detailed market information",
	parameters: z.object({
		conditionId: z.string().min(1).describe("Market condition ID"),
	}),
	execute: async (params: { conditionId: string }): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const market = await polymarketService.getMarket(params.conditionId);

			return dedent`
				📋 Market Details:

				**Question:** ${market.question}
				**ID:** ${market.id}
				**Condition ID:** ${market.conditionId}
				${market.description ? `**Description:** ${market.description}` : ""}
				${market.endDate ? `**End Date:** ${market.endDate}` : ""}
				**Outcomes:** ${market.outcomes.join(", ")}
			`;
		} catch (error) {
			return `Error fetching market: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

/**
 * SIMPLIFIED: Select market for trading
 */
export const selectMarketTool = {
	name: "SELECT_MARKET_FOR_TRADING",
	description: "Get detailed market information for trading",
	parameters: z.object({
		marketId: z.string().describe("Market ID (conditionId or Gamma ID)"),
	}),
	execute: async (params: { marketId: string }): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			let conditionId: string;

			// Handle Gamma ID vs conditionId
			if (params.marketId.startsWith("0x")) {
				conditionId = params.marketId;
			} else {
				// Look up conditionId from Gamma API
				const gammaMarkets = await polymarketService.getMarketsFromGamma({
					limit: 100,
				});
				const gammaMarket = gammaMarkets.find(
					(m: any) => m.id === params.marketId,
				);

				if (!gammaMarket || !gammaMarket.conditionId) {
					return `❌ Market ${params.marketId} not found or missing conditionId`;
				}
				conditionId = gammaMarket.conditionId as string;
			}

			// Get market details from CLOB
			const rawMarketData = await polymarketService.getRawMarket(conditionId);
			const market = rawMarketData.market;

			// Get current prices
			let priceInfo = "";
			try {
				if (rawMarketData.tokens.length > 0) {
					priceInfo = "\n💰 **Current Prices:**";
					for (const token of rawMarketData.tokens) {
						const orderBook = await polymarketService.getOrderBook(
							token.token_id,
						);
						const bestBid = orderBook.bids[0]?.price || "N/A";
						const bestAsk = orderBook.asks[0]?.price || "N/A";
						priceInfo += `\n• **${token.outcome}:** Buy $${bestBid} | Sell $${bestAsk}`;
					}
				}
			} catch (error) {
				priceInfo = "\n⚠️ Could not fetch current prices";
			}

			const tokenList = rawMarketData.tokens
				.map((t) => `${t.outcome}: ${t.token_id}`)
				.join("\n• ");

			return dedent`
				🎯 **Market Ready for Trading**

				**Question:** ${market.question}
				**Condition ID:** ${conditionId}
				**End Date:** ${market.endDate ? new Date(market.endDate).toLocaleDateString() : "Not specified"}
				**Outcomes:** ${market.outcomes.join(" vs ")}
				${priceInfo}

				**Token IDs:**
				• ${tokenList}

				🔧 **Trading Status:**
				- Can Trade: ${polymarketService.canTrade() ? "✅ Yes" : "❌ No"}
				- Wallet: ${polymarketService.getWalletAddress() || "❌ Not configured"}

			`;
		} catch (error) {
			return `❌ Error selecting market: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

/**
 * Trading tools (unchanged but simplified responses)
 */
export const getOrderBookTool = {
	name: "GET_POLYMARKET_ORDERBOOK",
	description: "Get order book for a token",
	parameters: z.object({
		tokenId: z.string().min(1).describe("Token ID"),
	}),
	execute: async (params: { tokenId: string }): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const orderBook = await polymarketService.getOrderBook(params.tokenId);

			return dedent`
				📊 Order Book for ${params.tokenId}:

				📈 **ASKS (Sell Orders):**
				${
					orderBook.asks.length > 0
						? orderBook.asks
								.slice(0, 5)
								.map((ask) => `   $${ask.price} x ${ask.size}`)
								.join("\n")
						: "   No sells available"
				}

				📉 **BIDS (Buy Orders):**
				${
					orderBook.bids.length > 0
						? orderBook.bids
								.slice(0, 5)
								.map((bid) => `   $${bid.price} x ${bid.size}`)
								.join("\n")
						: "   No buys available"
				}
			`;
		} catch (error) {
			return `Error fetching order book: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

export const createBuyOrderTool = {
	name: "CREATE_POLYMARKET_BUY_ORDER",
	description: "Create a GTC (Good Till Cancelled) buy order",
	parameters: z.object({
		conditionId: z.string().min(1).describe("Market condition ID"),
		outcome: z.string().min(1).describe("Outcome to buy (e.g., 'Yes', 'No')"),
		price: z
			.number()
			.min(0.01)
			.max(0.99)
			.describe("Price per share (0.01-0.99)"),
		size: z.number().min(1).describe("Number of shares"),
	}),
	execute: async (params: {
		conditionId: string;
		outcome: string;
		price: number;
		size: number;
	}): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const rawMarketData = await polymarketService.getRawMarket(
				params.conditionId,
			);
			const market = rawMarketData.market;
			const token = rawMarketData.tokens.find(
				(t) => t.outcome === params.outcome,
			);

			if (!token) {
				const available = rawMarketData.tokens
					.map((t) => `"${t.outcome}"`)
					.join(", ");
				return `❌ Invalid outcome "${params.outcome}". Available: ${available}`;
			}

			// Use the new GTC order method instead of the commented out createBuyOrder
			const result = await polymarketService.createGTDOrder(
				token.token_id,
				params.price,
				params.size,
				Side.BUY,
				0, // No expiration for GTC-like behavior
			);

			if (result.success) {
				return dedent`
					✅ **Buy Order Created!**

					📋 **Order Details:**
					- Market: ${market.question}
					- Outcome: ${params.outcome}
					- Price: $${params.price}
					- Size: ${params.size} shares
					- Total: $${(params.price * params.size).toFixed(2)}
					- Order ID: ${result.orderId}

					${result.message}
				`;
			}
			return `❌ Failed: ${result.error}`;
		} catch (error) {
			return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

export const createSellOrderTool = {
	name: "CREATE_POLYMARKET_SELL_ORDER",
	description: "Create a GTC (Good Till Cancelled) sell order",
	parameters: z.object({
		conditionId: z.string().min(1).describe("Market condition ID"),
		outcome: z.string().min(1).describe("Outcome to sell"),
		price: z.number().min(0.01).max(0.99).describe("Price per share"),
		size: z.number().min(1).describe("Number of shares"),
	}),
	execute: async (params: {
		conditionId: string;
		outcome: string;
		price: number;
		size: number;
	}): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const rawMarketData = await polymarketService.getRawMarket(
				params.conditionId,
			);
			const market = rawMarketData.market;
			const token = rawMarketData.tokens.find(
				(t) => t.outcome === params.outcome,
			);

			if (!token) {
				const available = rawMarketData.tokens
					.map((t) => `"${t.outcome}"`)
					.join(", ");
				return `❌ Invalid outcome "${params.outcome}". Available: ${available}`;
			}

			// Use the new GTC order method instead of the commented out createSellOrder
			const result = await polymarketService.createGTDOrder(
				token.token_id,
				params.price,
				params.size,
				Side.SELL,
				0, // No expiration for GTC-like behavior
			);

			if (result.success) {
				return dedent`
					✅ **Sell Order Created!**

					📋 **Order Details:**
					- Market: ${market.question}
					- Outcome: ${params.outcome}
					- Price: $${params.price}
					- Size: ${params.size} shares
					- Total: $${(params.price * params.size).toFixed(2)}
					- Order ID: ${result.orderId}

					${result.message}
				`;
			}
			return `❌ Failed: ${result.error}`;
		} catch (error) {
			return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

// ✅ NEW MARKET ORDER TOOLS (following official docs)
export const createMarketBuyOrderTool = {
	name: "CREATE_POLYMARKET_MARKET_BUY_ORDER",
	description: "Create a market buy order (FOK - Fill or Kill)",
	parameters: z.object({
		conditionId: z.string().min(1).describe("Market condition ID"),
		outcome: z.string().min(1).describe("Outcome to buy (e.g., 'Yes', 'No')"),
		amount: z.number().min(0.01).describe("Amount in USD to spend"),
	}),
	execute: async (params: {
		conditionId: string;
		outcome: string;
		amount: number;
	}): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const rawMarketData = await polymarketService.getRawMarket(
				params.conditionId,
			);
			const market = rawMarketData.market;
			const token = rawMarketData.tokens.find(
				(t) => t.outcome === params.outcome,
			);

			if (!token) {
				const available = rawMarketData.tokens
					.map((t) => `"${t.outcome}"`)
					.join(", ");
				return `❌ Invalid outcome "${params.outcome}". Available: ${available}`;
			}

			const result = await polymarketService.createMarketBuyOrder(
				token.token_id,
				params.amount,
			);

			if (result.success) {
				return dedent`
					✅ **Market Buy Order Created! (FOK)**

					📋 **Order Details:**
					- Market: ${market.question}
					- Outcome: ${params.outcome}
					- Amount: $${params.amount} USD
					- Order Type: Fill or Kill (FOK)
					- Order ID: ${result.orderId}

					${result.message}
				`;
			}
			return `❌ Failed: ${result.error}`;
		} catch (error) {
			return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

export const createMarketSellOrderTool = {
	name: "CREATE_POLYMARKET_MARKET_SELL_ORDER",
	description: "Create a market sell order (FOK - Fill or Kill)",
	parameters: z.object({
		conditionId: z.string().min(1).describe("Market condition ID"),
		outcome: z.string().min(1).describe("Outcome to sell"),
		shares: z.number().min(1).describe("Number of shares to sell"),
	}),
	execute: async (params: {
		conditionId: string;
		outcome: string;
		shares: number;
	}): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const rawMarketData = await polymarketService.getRawMarket(
				params.conditionId,
			);
			const market = rawMarketData.market;
			const token = rawMarketData.tokens.find(
				(t) => t.outcome === params.outcome,
			);

			if (!token) {
				const available = rawMarketData.tokens
					.map((t) => `"${t.outcome}"`)
					.join(", ");
				return `❌ Invalid outcome "${params.outcome}". Available: ${available}`;
			}

			const result = await polymarketService.createMarketSellOrder(
				token.token_id,
				params.shares,
			);

			if (result.success) {
				return dedent`
					✅ **Market Sell Order Created! (FOK)**

					📋 **Order Details:**
					- Market: ${market.question}
					- Outcome: ${params.outcome}
					- Shares: ${params.shares}
					- Order Type: Fill or Kill (FOK)
					- Order ID: ${result.orderId}

					${result.message}
				`;
			}
			return `❌ Failed: ${result.error}`;
		} catch (error) {
			return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

export const createGTDOrderTool = {
	name: "CREATE_POLYMARKET_GTD_ORDER",
	description: "Create a Good Till Date order (GTD)",
	parameters: z.object({
		conditionId: z.string().min(1).describe("Market condition ID"),
		outcome: z.string().min(1).describe("Outcome to trade"),
		side: z.enum(["BUY", "SELL"]).describe("Order side"),
		price: z.number().min(0.01).max(0.99).describe("Price per share"),
		size: z.number().min(1).describe("Number of shares"),
		expirationMinutes: z
			.number()
			.min(1)
			.max(1440)
			.describe("Minutes until expiration (1-1440)"),
	}),
	execute: async (params: {
		conditionId: string;
		outcome: string;
		side: "BUY" | "SELL";
		price: number;
		size: number;
		expirationMinutes: number;
	}): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const rawMarketData = await polymarketService.getRawMarket(
				params.conditionId,
			);
			const market = rawMarketData.market;
			const token = rawMarketData.tokens.find(
				(t) => t.outcome === params.outcome,
			);

			if (!token) {
				const available = rawMarketData.tokens
					.map((t) => `"${t.outcome}"`)
					.join(", ");
				return `❌ Invalid outcome "${params.outcome}". Available: ${available}`;
			}

			const result = await polymarketService.createGTDOrder(
				token.token_id,
				params.price,
				params.size,
				params.side === "BUY" ? Side.BUY : Side.SELL,
				params.expirationMinutes,
			);

			if (result.success) {
				return dedent`
					✅ **GTD Order Created!**

					📋 **Order Details:**
					- Market: ${market.question}
					- Outcome: ${params.outcome}
					- Side: ${params.side}
					- Price: $${params.price}
					- Size: ${params.size} shares
					- Expires: ${params.expirationMinutes} minutes
					- Total: $${(params.price * params.size).toFixed(2)}
					- Order ID: ${result.orderId}

					${result.message}
				`;
			}
			return `❌ Failed: ${result.error}`;
		} catch (error) {
			return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

export const checkBuyOrderTool = {
	name: "CHECK_BUY_ORDER_REQUIREMENTS",
	description: "Check if you can place a buy order",
	parameters: z.object({
		orderValue: z
			.number()
			.min(0.01)
			.describe("Total order value (price × size)"),
	}),
	execute: async (params: { orderValue: number }): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const requirements = await polymarketService.checkBuyOrderRequirements(
				params.orderValue,
			);

			return requirements.canPlace
				? dedent`
					✅ **Buy Order Check - PASSED**
					💰 Balance: $${requirements.balance?.toFixed(2)}
					📊 Order Value: $${params.orderValue.toFixed(2)}
					✨ You can place this order!
				`
				: dedent`
					❌ **Buy Order Check - FAILED**
					💰 Balance: $${requirements.balance?.toFixed(2)}
					📊 Order Value: $${params.orderValue.toFixed(2)}
					⚠️ ${requirements.error}
				`;
		} catch (error) {
			return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

export const checkSellOrderTool = {
	name: "CHECK_SELL_ORDER_REQUIREMENTS",
	description: "Check if you can place a sell order",
	parameters: z.object({
		tokenId: z.string().describe("Token ID to sell"),
		size: z.number().min(0.01).describe("Number of tokens to sell"),
	}),
	execute: async (params: {
		tokenId: string;
		size: number;
	}): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const requirements = await polymarketService.checkSellOrderRequirements(
				params.tokenId,
				params.size,
			);

			return requirements.canPlace
				? dedent`
					✅ **Sell Order Check - PASSED**
					🎯 Token Balance: ${requirements.balance}
					📊 Sell Size: ${params.size}
					✨ You can place this order!
				`
				: dedent`
					❌ **Sell Order Check - FAILED**
					🎯 Token Balance: ${requirements.balance}
					📊 Sell Size: ${params.size}
					⚠️ ${requirements.error}
				`;
		} catch (error) {
			return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

export const getUserOrdersTool = {
	name: "GET_POLYMARKET_USER_ORDERS",
	description: "Get your current orders",
	parameters: z.object({}),
	execute: async (): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const orders = await polymarketService.getUserOrders();

			if (orders.length === 0) {
				return dedent`
					📋 **No Open Orders**
					Wallet: ${polymarketService.getWalletAddress()}
				`;
			}

			return dedent`
				📋 **Your Orders (${orders.length}):**
				${orders.map((order, i) => `${i + 1}. Order ID: ${order.orderId || "Unknown"}`).join("\n")}
				
				Wallet: ${polymarketService.getWalletAddress()}
			`;
		} catch (error) {
			return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;

export const getUserPositionsTool = {
	name: "GET_POLYMARKET_POSITIONS",
	description: "Get user portfolio positions",
	parameters: z.object({
		userAddress: z.string().min(1).describe("User's Polygon address (0x...)"),
		limit: z
			.number()
			.min(1)
			.max(100)
			.optional()
			.default(20)
			.describe("Number of positions"),
	}),
	execute: async (params: {
		userAddress: string;
		limit?: number;
	}): Promise<string> => {
		const polymarketService = new PolymarketService();

		try {
			const positions = await polymarketService.getUserPositions(
				params.userAddress,
				{
					limit: params.limit,
					sortBy: "CURRENT",
				},
			);

			if (positions.length === 0) {
				return `📊 No positions found for ${params.userAddress}`;
			}

			// Calculate totals
			let totalValue = 0;
			let totalPnL = 0;
			for (const pos of positions) {
				totalValue += pos.currentValue || 0;
				totalPnL += pos.cashPnl || 0;
			}

			return dedent`
				📊 **Portfolio: ${params.userAddress}**

				💰 **Summary:**
				- Total Value: $${totalValue.toFixed(2)}
				- Total P&L: ${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}
				- Positions: ${positions.length}

				🎯 **Top Positions:**
				${positions
					.slice(0, 10)
					.map(
						(pos: Record<string, unknown>, i: number) =>
							`${i + 1}. ${(pos.title as string) || "Unknown"}\n` +
							`   Value: $${((pos.currentValue as number) || 0).toFixed(2)} | ` +
							`P&L: ${((pos.cashPnl as number) || 0) >= 0 ? "+" : ""}$${((pos.cashPnl as number) || 0).toFixed(2)}`,
					)
					.join("\n\n")}

				${positions.length > 10 ? `\n... and ${positions.length - 10} more` : ""}
			`;
		} catch (error) {
			return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
} as const;
