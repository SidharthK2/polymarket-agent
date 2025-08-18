import { z } from "zod";
import { PolymarketService } from "../services/polymarket-service.js";
import dedent from "dedent";

// Import Market type from service
type Market = {
	id: string;
	question: string;
	description?: string;
	endDate?: string;
	outcomes?: string[];
	eventId?: string;
	eventTitle?: string;
	category?: string;
	conditionId?: string;
};

/**
 * Zod schemas for tool parameters
 */
const getMarketsParams = z.object({
	limit: z
		.number()
		.min(1)
		.max(50)
		.optional()
		.default(10)
		.describe("Number of markets to fetch (1-50)"),
});

const searchMarketsParams = z.object({
	query: z
		.string()
		.min(1)
		.describe("Search query for market titles/descriptions (keywords)"),
	limit: z
		.number()
		.min(1)
		.max(50)
		.optional()
		.default(10)
		.describe("Number of markets to return (1-50)"),
	category: z
		.string()
		.optional()
		.describe("Filter by category (e.g., 'Politics', 'Sports', 'Crypto')"),
});

const getMarketParams = z.object({
	conditionId: z
		.string()
		.min(1)
		.describe("The condition ID of the market to fetch"),
});

const getOrderBookParams = z.object({
	tokenId: z.string().min(1).describe("The token ID to get order book for"),
});

const createOrderParams = z.object({
	tokenId: z.string().min(1).describe("The token ID to trade"),
	price: z
		.number()
		.min(0.01)
		.max(0.99)
		.describe("Order price between 0.01 and 0.99"),
	size: z.number().min(1).describe("Order size (number of shares)"),
});

const getUserPositionsParams = z.object({
	userAddress: z.string().min(1).describe("The user's Polygon address (0x...)"),
	limit: z
		.number()
		.min(1)
		.max(500)
		.optional()
		.default(20)
		.describe("Number of positions to fetch (1-500)"),
	sizeThreshold: z
		.number()
		.min(0)
		.optional()
		.default(1)
		.describe("Minimum position size to include"),
	eventId: z.string().optional().describe("Filter by specific event ID"),
	redeemable: z
		.boolean()
		.optional()
		.describe("Filter for redeemable positions only"),
	sortBy: z
		.enum([
			"TOKENS",
			"CURRENT",
			"INITIAL",
			"CASHPNL",
			"PERCENTPNL",
			"TITLE",
			"RESOLVING",
			"PRICE",
		])
		.optional()
		.default("CURRENT")
		.describe("Sort criteria"),
});

type GetMarketsParams = z.infer<typeof getMarketsParams>;
type SearchMarketsParams = z.infer<typeof searchMarketsParams>;
type GetMarketParams = z.infer<typeof getMarketParams>;
type GetOrderBookParams = z.infer<typeof getOrderBookParams>;
type CreateOrderParams = z.infer<typeof createOrderParams>;
type GetUserPositionsParams = z.infer<typeof getUserPositionsParams>;

/**
 * Tool to search markets by user interests/keywords
 */
export const searchMarketsTool = {
	name: "SEARCH_POLYMARKET_MARKETS",
	description:
		"Search Polymarket markets with enhanced relevance scoring and popularity data",
	parameters: z.object({
		query: z
			.string()
			.min(1)
			.optional()
			.default("market")
			.describe("Search query for market titles/descriptions (keywords)"),
		limit: z
			.number()
			.min(1)
			.max(50)
			.optional()
			.default(10)
			.describe("Number of markets to return (1-50)"),
		category: z
			.string()
			.optional()
			.describe("Filter by category (e.g., 'Politics', 'Sports', 'Crypto')"),
		sortBy: z
			.string()
			.optional()
			.default("popularity")
			.describe("Sort strategy: relevance, popularity, or recent"),
		minLiquidity: z
			.number()
			.optional()
			.default(500)
			.describe("Minimum market liquidity threshold"),
		useEnhanced: z
			.boolean()
			.optional()
			.default(true)
			.describe("Use enhanced search with Gamma API data"),
	}),
	execute: async (params: {
		query?: string;
		limit?: number;
		category?: string;
		sortBy?: string;
		minLiquidity?: number;
		useEnhanced?: boolean;
	}) => {
		const polymarketService = new PolymarketService();

		try {
			const query = params.query || params.category || "market";
			const markets = params.useEnhanced
				? await polymarketService.searchMarketsEnhanced(query, {
						limit: params.limit,
						category: params.category,
						sortBy: params.sortBy,
						minLiquidity: params.minLiquidity,
					})
				: await polymarketService.searchMarkets(query, {
						limit: params.limit,
						category: params.category,
						sortBy: params.sortBy,
					});

			if (markets.length === 0) {
				return dedent`
					🔍 No markets found for "${query}"${params.category ? ` in ${params.category}` : ""}

					Try:
					- Broader keywords (e.g., "election" instead of "specific candidate")
					- Different categories like "Politics", "Sports", "Crypto", "Entertainment"
					- Lowering the minimum liquidity threshold (current: $${params.minLiquidity || 500})
					- Different sort strategies: relevance, popularity, recent
				`;
			}

			const enhancedMarkets = markets as Array<
				Market & {
					relevanceScore?: number;
					popularityScore?: number;
					volume24hr?: number;
					liquidity?: number;
				}
			>;

			return dedent`
				🎯 Found ${markets.length} markets matching "${query}"${params.category ? ` in ${params.category}` : ""} (sorted by ${params.sortBy || "popularity"}):

				${enhancedMarkets
					.map(
						(market, index) => dedent`
				${index + 1}. ${market.question}
				   📊 Relevance: ${market.relevanceScore?.toFixed(2) || "N/A"} | Popularity: ${market.popularityScore?.toFixed(2) || "N/A"}
				   💰 Volume: $${market.volume24hr?.toLocaleString() || "N/A"} | Liquidity: $${market.liquidity?.toLocaleString() || "N/A"}
				   📅 ${market.endDate ? `Ends: ${new Date(market.endDate).toLocaleDateString()}` : "End date TBD"}
				   🏷️  ${market.category || market.eventTitle || "General"}
				   🆔 ID: ${market.id}
				   ${market.description ? `📝 ${market.description.slice(0, 120)}${market.description.length > 120 ? "..." : ""}` : ""}
			`,
					)
					.join("\n\n")}
			`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error searching markets: ${error.message}`;
			}
			return "An unknown error occurred while searching markets";
		}
	},
} as const;

/**
 * Tool to search markets by user interests with intelligent matching
 */
export const searchMarketsByInterestsTool = {
	name: "SEARCH_POLYMARKET_BY_INTERESTS",
	description:
		"Find markets based on user interests with intelligent category mapping and user profile consideration",
	parameters: z.object({
		interests: z
			.array(z.string())
			.min(1)
			.describe(
				"Array of user interests (e.g., ['politics', 'crypto', 'sports'])",
			),
		limit: z
			.number()
			.min(1)
			.max(50)
			.optional()
			.default(10)
			.describe("Number of markets to return (1-50)"),
		knowledgeLevel: z
			.enum(["beginner", "intermediate", "advanced"])
			.optional()
			.default("intermediate")
			.describe("User's knowledge level for market complexity filtering"),
		riskTolerance: z
			.enum(["conservative", "moderate", "aggressive"])
			.optional()
			.default("moderate")
			.describe("User's risk tolerance for market selection"),
		sortBy: z
			.string()
			.optional()
			.default("popularity")
			.describe("Sort strategy: relevance, popularity, or recent"),
	}),
	execute: async (params: {
		interests: string[];
		limit?: number;
		knowledgeLevel?: "beginner" | "intermediate" | "advanced";
		riskTolerance?: "conservative" | "moderate" | "aggressive";
		sortBy?: string;
	}) => {
		const polymarketService = new PolymarketService();

		try {
			const markets = await polymarketService.searchMarketsByInterests(
				params.interests,
				{
					limit: params.limit,
					knowledgeLevel: params.knowledgeLevel,
					riskTolerance: params.riskTolerance,
					sortBy: params.sortBy,
				},
			);

			if (markets.length === 0) {
				return dedent`
					🎯 No markets found matching your interests: [${params.interests.join(", ")}]

					Try:
					- Broader interests (e.g., "politics" instead of "specific policies")
					- Different knowledge level settings
					- Adjusting risk tolerance settings
					- Popular categories: Politics, Sports, Crypto, Entertainment, Economics
				`;
			}

			const enhancedMarkets = markets as Array<
				Market & {
					relevanceScore?: number;
					matchReason?: string;
					riskLevel?: string;
					volume24hr?: number;
					liquidity?: number;
				}
			>;
			const profileMatch =
				params.knowledgeLevel === "beginner"
					? "Beginner-friendly"
					: params.riskTolerance === "conservative"
						? "Conservative"
						: "Standard";

			return dedent`
				🎯 Found ${markets.length} markets matching your interests [${params.interests.join(", ")}] (${profileMatch} profile):

				${enhancedMarkets
					.map((market, index) => {
						const riskLevel =
							market.riskLevel ||
							(params.riskTolerance === "conservative"
								? "Low"
								: params.riskTolerance === "aggressive"
									? "High"
									: "Medium");

						return dedent`
				${index + 1}. ${market.question}
				   🎯 Match Score: ${market.relevanceScore?.toFixed(2) || "N/A"} | Risk: ${riskLevel}
				   💰 Volume: $${market.volume24hr?.toLocaleString() || "N/A"} | Liquidity: $${market.liquidity?.toLocaleString() || "N/A"}
				   📅 ${market.endDate ? `Ends: ${new Date(market.endDate).toLocaleDateString()}` : "End date TBD"}
				   🏷️  ${market.category || market.eventTitle || "General"}
				   🆔 ID: ${market.id}
				   ${market.description ? `📝 ${market.description.slice(0, 120)}${market.description.length > 120 ? "..." : ""}` : ""}
				   ${market.matchReason ? `🔍 Why it matches: ${market.matchReason}` : ""}
			`;
					})
					.join("\n\n")}

				💡 Profile Settings: ${params.knowledgeLevel || "intermediate"} knowledge, ${params.riskTolerance || "moderate"} risk tolerance
			`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error finding markets for interests: ${error.message}`;
			}
			return "An unknown error occurred while finding markets for your interests";
		}
	},
} as const;

/**
 * Tool to get markets grouped by events (better organization)
 */
export const getMarketsByEventsTool = {
	name: "GET_POLYMARKET_EVENTS",
	description:
		"Get Polymarket markets organized by events (related markets grouped together)",
	parameters: getMarketsParams,
	execute: async (params: GetMarketsParams) => {
		const polymarketService = new PolymarketService();

		try {
			const eventGroups = await polymarketService.getMarketsByEvents(
				params.limit,
			);

			if (Object.keys(eventGroups).length === 0) {
				return "No events found.";
			}

			return dedent`
				Found ${Object.keys(eventGroups).length} Polymarket events with related markets:

				${Object.entries(eventGroups)
					.map(
						([eventTitle, markets]) => dedent`
					🎯 EVENT: ${eventTitle}
					${markets
						.map(
							(market, index) => dedent`
						   ${index + 1}. ${market.question}
						      ID: ${market.id}
						      ${market.description ? `Description: ${market.description}` : ""}
					`,
						)
						.join("\n")}
				`,
					)
					.join("\n\n")}
			`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error fetching events: ${error.message}`;
			}
			return "An unknown error occurred while fetching events";
		}
	},
} as const;

/**
 * Tool to get available Polymarket prediction markets
 */
// In your MCP tool file, change GET_POLYMARKET_MARKETS to use Gamma API:
export const getMarketsTool = {
	name: "GET_POLYMARKET_MARKETS",
	description: "Get a list of available Polymarket prediction markets",
	parameters: getMarketsParams,
	execute: async (params: GetMarketsParams) => {
		const polymarketService = new PolymarketService();

		try {
			// ✅ Use Gamma API instead of CLOB
			const markets = await polymarketService.searchMarketsEnhanced("", {
				limit: params.limit,
				useGammaAPI: true,
			});

			if (markets.length === 0) {
				return "No markets found. The Gamma API may be temporarily unavailable.";
			}

			return `Found ${markets.length} Polymarket prediction markets:\n\n${markets
				.map(
					(market, index) =>
						`${index + 1}. ${market.question}\n` +
						`   ID: ${market.id}\n` +
						`   Category: ${market.category || "Unknown"}\n` +
						`   End Date: ${market.endDate || "TBD"}`,
				)
				.join("\n\n")}`;
		} catch (error) {
			console.error("Error in getMarketsTool:", error);
			return `Error fetching markets: ${error instanceof Error ? error.message : "Unknown error"}`;
		}
	},
};

/**
 * Tool to get details for a specific Polymarket market
 */
export const getMarketTool = {
	name: "GET_POLYMARKET_MARKET",
	description: "Get detailed information about a specific Polymarket market",
	parameters: getMarketParams,
	execute: async (params: GetMarketParams) => {
		const polymarketService = new PolymarketService();

		try {
			const market = await polymarketService.getMarket(params.conditionId);

			return dedent`
				Market Details:

				Question: ${market.question}
				ID: ${market.id}
				${market.description ? `Description: ${market.description}` : ""}
				${market.endDate ? `End Date: ${market.endDate}` : ""}
				${market.outcomes ? `Outcomes: ${market.outcomes.join(", ")}` : ""}
			`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error fetching market: ${error.message}`;
			}
			return "An unknown error occurred while fetching market details";
		}
	},
} as const;

/**
 * Tool to get order book for a specific token
 */
export const getOrderBookTool = {
	name: "GET_POLYMARKET_ORDERBOOK",
	description:
		"Get the order book (bids and asks) for a specific Polymarket token",
	parameters: getOrderBookParams,
	execute: async (params: GetOrderBookParams) => {
		const polymarketService = new PolymarketService();

		try {
			const orderBook = await polymarketService.getOrderBook(params.tokenId);

			return dedent`
				Order Book for Token ${params.tokenId}:

				📈 ASKS (Sell Orders):
				${
					orderBook.asks.length > 0
						? orderBook.asks
								.slice(0, 5)
								.map((ask) => `   Price: ${ask.price} | Size: ${ask.size}`)
								.join("\n")
						: "   No asks available"
				}

				📉 BIDS (Buy Orders):
				${
					orderBook.bids.length > 0
						? orderBook.bids
								.slice(0, 5)
								.map((bid) => `   Price: ${bid.price} | Size: ${bid.size}`)
								.join("\n")
						: "   No bids available"
				}
			`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error fetching order book: ${error.message}`;
			}
			return "An unknown error occurred while fetching order book";
		}
	},
} as const;

/**
 * Tool to create a buy order
 */
export const createBuyOrderTool = {
	name: "CREATE_POLYMARKET_BUY_ORDER",
	description: "Create a buy order on Polymarket for a specific token",
	parameters: createOrderParams,
	execute: async (params: CreateOrderParams) => {
		const polymarketService = new PolymarketService();

		if (!polymarketService.isReadyForTrading()) {
			return "Error: Trading not available. Wallet or API credentials not configured.";
		}

		try {
			const result = await polymarketService.createBuyOrder(
				params.tokenId,
				params.price,
				params.size,
			);

			if (result.success) {
				return dedent`
					✅ Buy Order Created Successfully!

					Order ID: ${result.orderId}
					Token: ${params.tokenId}
					Price: ${params.price}
					Size: ${params.size} shares
					Side: BUY

					${result.message}
				`;
			}
			return `❌ Failed to create buy order: ${result.error}`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error creating buy order: ${error.message}`;
			}
			return "An unknown error occurred while creating buy order";
		}
	},
} as const;

/**
 * Tool to create a sell order
 */
export const createSellOrderTool = {
	name: "CREATE_POLYMARKET_SELL_ORDER",
	description: "Create a sell order on Polymarket for a specific token",
	parameters: createOrderParams,
	execute: async (params: CreateOrderParams) => {
		const polymarketService = new PolymarketService();

		if (!polymarketService.isReadyForTrading()) {
			return "Error: Trading not available. Wallet or API credentials not configured.";
		}

		try {
			const result = await polymarketService.createSellOrder(
				params.tokenId,
				params.price,
				params.size,
			);

			if (result.success) {
				return dedent`
					✅ Sell Order Created Successfully!

					Order ID: ${result.orderId}
					Token: ${params.tokenId}
					Price: ${params.price}
					Size: ${params.size} shares
					Side: SELL

					${result.message}
				`;
			}
			return `❌ Failed to create sell order: ${result.error}`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error creating sell order: ${error.message}`;
			}
			return "An unknown error occurred while creating sell order";
		}
	},
} as const;

/**
 * Tool to get user's orders
 */
export const getUserOrdersTool = {
	name: "GET_POLYMARKET_USER_ORDERS",
	description: "Get the current user's orders on Polymarket",
	parameters: z.object({}),
	execute: async () => {
		const polymarketService = new PolymarketService();

		if (!polymarketService.isReadyForTrading()) {
			return "Error: Trading not available. Wallet or API credentials not configured.";
		}

		try {
			const orders = await polymarketService.getUserOrders();

			if (orders.length === 0) {
				return dedent`
					📋 User Orders: No open orders found.
					
					Wallet Address: ${polymarketService.getWalletAddress()}
				`;
			}

			return dedent`
				📋 User Orders (${orders.length} found):
				
				${orders.map((order, index) => `${index + 1}. Order ID: ${order.orderId || "Unknown"}`).join("\n")}
				
				Wallet Address: ${polymarketService.getWalletAddress()}
			`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error fetching user orders: ${error.message}`;
			}
			return "An unknown error occurred while fetching user orders";
		}
	},
} as const;

/**
 * Tool to get user's positions and portfolio data
 */
export const getUserPositionsTool = {
	name: "GET_POLYMARKET_POSITIONS",
	description:
		"Get a user's current positions and portfolio data from Polymarket",
	parameters: getUserPositionsParams,
	execute: async (params: GetUserPositionsParams) => {
		const polymarketService = new PolymarketService();

		try {
			const positions = await polymarketService.getUserPositions(
				params.userAddress,
				{
					limit: params.limit,
					sizeThreshold: params.sizeThreshold,
					eventId: params.eventId,
					redeemable: params.redeemable,
					sortBy: params.sortBy,
				},
			);

			if (positions.length === 0) {
				return dedent`
					📊 Portfolio Analysis: No positions found for ${params.userAddress}
					
					This user either:
					- Has no current positions
					- All positions are below the size threshold (${params.sizeThreshold})
					- Is new to Polymarket
				`;
			}

			// Calculate portfolio summary
			let totalValue = 0;
			let totalPnl = 0;
			let winningPositions = 0;
			let redeemablePositions = 0;

			for (const position of positions as Array<{
				currentValue?: number;
				cashPnl?: number;
				redeemable?: boolean;
			}>) {
				totalValue += position.currentValue || 0;
				totalPnl += position.cashPnl || 0;
				if ((position.cashPnl || 0) > 0) winningPositions++;
				if (position.redeemable) redeemablePositions++;
			}

			return dedent`
				📊 Portfolio Analysis for ${params.userAddress}:

				💰 PORTFOLIO SUMMARY:
				   Total Portfolio Value: $${totalValue.toFixed(2)}
				   Total P&L: ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}
				   Winning Positions: ${winningPositions}/${positions.length}
				   Redeemable Positions: ${redeemablePositions}

				🎯 TOP POSITIONS:
				${positions
					.slice(0, 10)
					.map(
						(
							pos: {
								title?: string;
								size?: number;
								avgPrice?: number;
								currentValue?: number;
								cashPnl?: number;
								percentPnl?: number;
								redeemable?: boolean;
							},
							index: number,
						) => dedent`
				   ${index + 1}. ${pos.title}
				      Size: ${pos.size} shares @ $${pos.avgPrice?.toFixed(3) || "0.000"}
				      Current Value: $${pos.currentValue?.toFixed(2) || "0.00"}
				      P&L: ${(pos.cashPnl || 0) >= 0 ? "+" : ""}$${pos.cashPnl?.toFixed(2) || "0.00"} (${pos.percentPnl?.toFixed(1) || "0.0"}%)
				      ${pos.redeemable ? "✅ Redeemable" : "⏳ Active"}
				`,
					)
					.join("\n")}

				${positions.length > 10 ? `\n... and ${positions.length - 10} more positions` : ""}
			`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error fetching positions: ${error.message}`;
			}
			return "An unknown error occurred while fetching user positions";
		}
	},
} as const;

/**
 * Check buy order requirements (balance, max order size)
 */
export const checkBuyOrderTool = {
	name: "CHECK_BUY_ORDER_REQUIREMENTS",
	description: "Check balance and requirements before placing a buy order",
	parameters: z.object({
		orderValue: z
			.number()
			.min(0.01)
			.describe("Total value of the order (price × size)"),
	}),
	execute: async (params: { orderValue: number }) => {
		const polymarketService = new PolymarketService();

		if (!polymarketService.isReadyForTrading()) {
			return "Error: Trading not available. Wallet or API credentials not configured.";
		}

		try {
			const requirements = await polymarketService.checkBuyOrderRequirements(
				params.orderValue,
			);

			if (requirements.canPlace) {
				return dedent`
					✅ **Buy Order Requirements Check - PASSED**
					
					💰 **Your USDC Balance:** $${requirements.balance?.toFixed(2)}
					📊 **Requested Order Value:** $${params.orderValue.toFixed(2)}
					🎯 **Max Order Size:** $${requirements.maxOrderSize?.toFixed(2)}
					
					✨ You can place this buy order!
				`;
			}
			return dedent`
					❌ **Buy Order Requirements Check - FAILED**
					
					💰 **Your USDC Balance:** $${requirements.balance?.toFixed(2)}
					📊 **Requested Order Value:** $${params.orderValue.toFixed(2)}
					🎯 **Max Order Size:** $${requirements.maxOrderSize?.toFixed(2)}
					
					⚠️ **Error:** ${requirements.error}
					
					💡 **Suggestion:** Reduce your order size to $${requirements.maxOrderSize?.toFixed(2)} or less.
				`;
		} catch (error: unknown) {
			if (error instanceof Error) {
				return `Error checking buy order requirements: ${error.message}`;
			}
			return "An unknown error occurred while checking buy order requirements";
		}
	},
} as const;

/**
 * Check sell order requirements (token balance, max sell size)
 */
export const checkSellOrderTool = {
	name: "CHECK_SELL_ORDER_REQUIREMENTS",
	description:
		"Check token balance and requirements before placing a sell order",
	parameters: z.object({
		tokenId: z.string().describe("Token ID to sell"),
		size: z.number().min(0.01).describe("Number of tokens to sell"),
	}),
	execute: async (params: { tokenId: string; size: number }) => {
		const polymarketService = new PolymarketService();

		if (!polymarketService.isReadyForTrading()) {
			return "Error: Trading not available. Wallet or API credentials not configured.";
		}

		try {
			const requirements = await polymarketService.checkSellOrderRequirements(
				params.tokenId,
				params.size,
			);

			if (requirements.canPlace) {
				return dedent`
					✅ **Sell Order Requirements Check - PASSED**
					
					🎯 **Token Balance:** ${requirements.balance} tokens
					📊 **Requested Sell Size:** ${params.size} tokens
					📈 **Max Sell Size:** ${requirements.maxOrderSize} tokens
					
					✨ You can place this sell order!
				`;
			}
			return dedent`
					❌ **Sell Order Requirements Check - FAILED**
					
					🎯 **Token Balance:** ${requirements.balance} tokens
					📊 **Requested Sell Size:** ${params.size} tokens
					📈 **Max Sell Size:** ${requirements.maxOrderSize} tokens
					
					⚠️ **Error:** ${requirements.error}
					
					💡 **Suggestion:** Reduce your sell size to ${requirements.maxOrderSize} tokens or less.
				`;
		} catch (error: unknown) {
			if (error instanceof Error) {
				return `Error checking sell order requirements: ${error.message}`;
			}
			return "An unknown error occurred while checking sell order requirements";
		}
	},
} as const;

/**
 * Select and get detailed information about a specific market
 */
export const selectMarketTool = {
	name: "SELECT_MARKET_FOR_TRADING",
	description:
		"Get detailed information about a specific market to prepare for trading",
	parameters: z.object({
		marketId: z.string().describe("Market ID to analyze"),
	}),
	execute: async (params: { marketId: string }) => {
		console.log("🔍 SELECT_MARKET_FOR_TRADING called with:", params);
		console.log(
			`🔍 marketId: "${params.marketId}" (type: ${typeof params.marketId})`,
		);

		const polymarketService = new PolymarketService();

		try {
			// Try to get the market
			console.log(`📊 Calling getMarket with: "${params.marketId}"`);
			const market = await polymarketService.getMarket(params.marketId);

			console.log("✅ Market found:", market);

			// Get order book for the first token to show current prices
			let orderBookInfo = "";
			try {
				if (market.outcomes && market.outcomes.length > 0) {
					// For binary markets, get order book for the "Yes" outcome
					const yesTokenId =
						market.outcomes[0] === "Yes"
							? market.outcomes[0]
							: market.outcomes[1];
					const orderBook = await polymarketService.getOrderBook(yesTokenId);

					if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
						const bestBid = Number(orderBook.bids[0].price);
						const bestAsk = Number(orderBook.asks[0].price);
						orderBookInfo = `\n💰 Current Prices: Best Bid: $${bestBid.toFixed(3)}, Best Ask: $${bestAsk.toFixed(3)}`;
					}
				}
			} catch (orderBookError) {
				console.log("⚠️ Could not fetch order book:", orderBookError);
			}

			return `✅ **Market Details for Trading**
			
🎯 **Market**: ${market.question}
🆔 **Market ID**: ${market.id}
📅 **End Date**: ${market.endDate || "Not specified"}
🏷️ **Category**: ${market.category || "General"}

📊 **Outcomes**: ${market.outcomes.join(" | ")}
${orderBookInfo}

💡 **Next Steps**:
• Use PREPARE_ORDER_FOR_MARKET to check if you can place orders
• Use CREATE_POLYMARKET_BUY_ORDER to place buy orders
• Use CREATE_POLYMARKET_SELL_ORDER to place sell orders

🔗 **Market ID for trading**: ${market.id}`;
		} catch (error) {
			console.error("❌ getMarket failed:", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("❌ Error details:", {
				message: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
			});

			return `❌ Error fetching market ${params.marketId}: ${errorMessage}`;
		}
	},
};

/**
 * Quick order preparation tool
 */
export const prepareOrderTool = {
	name: "PREPARE_ORDER_FOR_MARKET",
	description:
		"Calculate order details and check requirements for a specific market",
	parameters: z.object({
		marketId: z.string().describe("Market ID to trade"),
		side: z.enum(["BUY", "SELL"]).describe("Order side - BUY or SELL"),
		price: z
			.number()
			.min(0.001)
			.max(0.999)
			.describe("Price per share (0.001 to 0.999)"),
		size: z.number().min(1).describe("Number of shares"),
		tokenId: z
			.string()
			.optional()
			.describe("Token ID (required for sell orders)"),
	}),
	execute: async (params: {
		marketId: string;
		side: "BUY" | "SELL";
		price: number;
		size: number;
		tokenId?: string;
	}) => {
		const polymarketService = new PolymarketService();

		if (!polymarketService.isReadyForTrading()) {
			return "Error: Trading not available. Wallet or API credentials not configured.";
		}

		try {
			const orderValue = params.price * params.size;

			if (params.side === "BUY") {
				const requirements =
					await polymarketService.checkBuyOrderRequirements(orderValue);

				return dedent`
					🛒 **Buy Order Preparation**
					
					📊 **Order Details:**
					🎯 Market: ${params.marketId}
					💰 Price: $${params.price.toFixed(3)} per share
					📈 Size: ${params.size} shares
					💵 Total Value: $${orderValue.toFixed(2)}
					
					💳 **Balance Check:**
					${requirements.canPlace ? "✅" : "❌"} **Can Place Order:** ${requirements.canPlace ? "YES" : "NO"}
					💰 **Your Balance:** $${requirements.balance?.toFixed(2)}
					🎯 **Max Order Size:** $${requirements.maxOrderSize?.toFixed(2)}
					
					${
						requirements.canPlace
							? "✨ **Ready to place!** Use CREATE_POLYMARKET_BUY_ORDER with these details."
							: `⚠️ **Cannot place:** ${requirements.error}\n💡 **Max you can spend:** $${requirements.maxOrderSize?.toFixed(2)}`
					}
				`;
			}
			// SELL order
			if (!params.tokenId) {
				return "❌ Token ID is required for sell orders. Please provide the tokenId parameter.";
			}

			const requirements = await polymarketService.checkSellOrderRequirements(
				params.tokenId,
				params.size,
			);

			return dedent`
					💎 **Sell Order Preparation**
					
					📊 **Order Details:**
					🎯 Market: ${params.marketId}
					🏷️ Token: ${params.tokenId}
					💰 Price: $${params.price.toFixed(3)} per share
					📉 Size: ${params.size} shares
					💵 Total Value: $${orderValue.toFixed(2)}
					
					🎯 **Token Balance Check:**
					${requirements.canPlace ? "✅" : "❌"} **Can Place Order:** ${requirements.canPlace ? "YES" : "NO"}
					💎 **Your Tokens:** ${requirements.balance}
					📈 **Max Sell Size:** ${requirements.maxOrderSize}
					
					${
						requirements.canPlace
							? "✨ **Ready to place!** Use CREATE_POLYMARKET_SELL_ORDER with these details."
							: `⚠️ **Cannot place:** ${requirements.error}\n💡 **Max you can sell:** ${requirements.maxOrderSize} tokens`
					}
				`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error preparing order: ${error.message}`;
			}
			return "An unknown error occurred while preparing the order";
		}
	},
} as const;
