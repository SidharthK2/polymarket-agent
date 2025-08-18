import { ClobClient, Side } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { config } from "../lib/config.js";
import { z } from "zod";

/**
 * Zod schemas for validating Polymarket API responses
 */
const marketSchema = z.object({
	id: z.string(),
	question: z.string(),
	description: z.string().optional(),
	endDate: z.string().optional(),
	outcomes: z.array(z.string()).optional(),
	// Gamma structure fields
	eventId: z.string().optional(),
	eventTitle: z.string().optional(),
	category: z.string().optional(),
	conditionId: z.string().optional(),
});

const orderBookSchema = z.object({
	bids: z.array(
		z.object({
			price: z.string(),
			size: z.string(),
		}),
	),
	asks: z.array(
		z.object({
			price: z.string(),
			size: z.string(),
		}),
	),
});

type Market = z.infer<typeof marketSchema>;
type OrderBook = z.infer<typeof orderBookSchema>;

interface EnhancedMarket extends Market {
	relevanceScore: number;
	volume24hr: number;
	liquidity: number;
	popularityScore: number;
}

/**
 * Structured order data interface
 */
export interface OrderResponse {
	success: boolean;
	orderId?: string;
	message?: string;
	error?: string;
	validationDetails?: {
		orderValue?: number;
		requestedSize?: number;
		maxOrderSize?: number;
		balance?: number;
	};
	orderDetails?: {
		tokenId: string;
		price: number;
		size: number;
		side: string;
		totalValue: number;
	};
}

/**
 * Service class for interacting with the Polymarket CLOB API.
 *
 * Provides methods to fetch markets, place orders, and manage trading
 * operations on Polymarket prediction markets. Handles authentication,
 * wallet management, and proper error handling.
 */
export class PolymarketService {
	private clobClient: ClobClient | null = null;
	private wallet: Wallet | null = null;
	private isInitialized = false;

	constructor() {
		this.initializeClient();
	}

	/**
	 * Initialize the CLOB client and wallet according to Polymarket authentication docs
	 * https://docs.polymarket.com/developers/CLOB/authentication
	 */
	private async initializeClient(): Promise<void> {
		try {
			let credentials = undefined;

			if (!config.polymarket.walletPrivateKey) {
				console.log(
					"⚠️  No wallet private key provided - running in read-only mode",
				);
				// Still try to initialize CLOB client for read-only operations
			} else {
				// Create ethers wallet from private key (L1 Authentication)
				this.wallet = new Wallet(config.polymarket.walletPrivateKey);
				console.log(`🔑 Wallet initialized: ${this.wallet.address}`);

				// Initialize CLOB client credentials (L2 Authentication)
				if (
					config.polymarket.apiKey &&
					config.polymarket.secret &&
					config.polymarket.passphrase
				) {
					// Use existing API credentials
					credentials = {
						key: config.polymarket.apiKey,
						secret: config.polymarket.secret,
						passphrase: config.polymarket.passphrase,
					};
					console.log("🔐 Using existing API credentials");
				} else {
					console.log(
						"⚠️  No API credentials provided - will create/derive API key automatically",
					);
					// The ClobClient will handle API key creation/derivation automatically
				}
			}

			// Initialize CLOB client (with or without wallet for read-only access)
			this.clobClient = new ClobClient(
				config.polymarket.clobApiUrl,
				config.polymarket.chainId,
				this.wallet || undefined, // undefined for read-only mode
				credentials,
			);

			this.isInitialized = true;
			const mode = this.wallet
				? "with trading capabilities"
				: "in read-only mode";
			console.log(`✅ Polymarket CLOB client initialized ${mode}`);
		} catch (error) {
			console.error("❌ Failed to initialize Polymarket client:", error);
			this.isInitialized = true; // Mark as initialized even if failed
		}
	}

	/**
	 * Ensure client is initialized before operations
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.isInitialized) {
			await this.initializeClient();
		}
	}

	/**
	 * Get available markets from Polymarket
	 */
	async getMarkets(limit = 10): Promise<Market[]> {
		await this.ensureInitialized();

		if (!this.clobClient) {
			throw new Error("CLOB client not initialized");
		}

		try {
			console.log("🔍 Fetching markets from Polymarket...");
			const markets = await this.clobClient.getMarkets();
			console.log("📊 Raw markets response:", {
				type: typeof markets,
				isArray: Array.isArray(markets),
				length: Array.isArray(markets) ? markets.length : "N/A",
				dataLength: markets?.data?.length || "N/A",
				hasData: !!markets?.data,
				sample:
					Array.isArray(markets) && markets.length > 0
						? markets[0]
						: markets?.data?.[0] || "No sample available",
			});

			// Validate and transform the response
			// API returns { data: [], next_cursor: "", limit: 500, count: 500 }
			const marketData = Array.isArray(markets) ? markets : markets?.data || [];
			if (Array.isArray(marketData)) {
				const processedMarkets = marketData.slice(0, limit).map((market) => {
					try {
						return marketSchema.parse(market);
					} catch (error) {
						console.log("⚠️ Market validation failed, using fallback:", {
							market,
							error: error instanceof Error ? error.message : "Unknown error",
						});
						// Return basic structure if validation fails
						return {
							id: market.id || "unknown",
							question: market.question || "Unknown market",
							description: market.description,
							endDate: market.endDate,
							outcomes: market.outcomes,
						};
					}
				});
				console.log(`✅ Processed ${processedMarkets.length} markets`);
				return processedMarkets;
			}
			console.log("⚠️ Markets response is not an array, returning empty");
			return [];
		} catch (error) {
			console.error("❌ Error fetching markets:", error);
			throw error;
		}
	}

	/**
	 * Interest to category mapping for better market discovery
	 */
	private static readonly INTEREST_CATEGORY_MAP = {
		politics: [
			"politics",
			"election",
			"government",
			"policy",
			"vote",
			"candidate",
			"president",
			"congress",
			"senate",
		],
		sports: [
			"sports",
			"football",
			"basketball",
			"baseball",
			"soccer",
			"nfl",
			"nba",
			"mlb",
			"championship",
			"super bowl",
			"olympics",
		],
		crypto: [
			"crypto",
			"bitcoin",
			"ethereum",
			"blockchain",
			"defi",
			"nft",
			"web3",
			"btc",
			"eth",
			"cryptocurrency",
		],
		entertainment: [
			"entertainment",
			"movie",
			"film",
			"tv",
			"show",
			"netflix",
			"disney",
			"oscar",
			"emmy",
			"box office",
			"celebrity",
		],
		economics: [
			"economics",
			"economy",
			"inflation",
			"fed",
			"interest rates",
			"stock market",
			"recession",
			"gdp",
			"unemployment",
		],
		technology: [
			"technology",
			"tech",
			"ai",
			"artificial intelligence",
			"apple",
			"google",
			"microsoft",
			"tesla",
			"meta",
			"startup",
		],
		health: [
			"health",
			"medical",
			"covid",
			"vaccine",
			"pandemic",
			"drug",
			"fda",
			"healthcare",
			"medicine",
		],
		climate: [
			"climate",
			"weather",
			"environment",
			"global warming",
			"carbon",
			"renewable energy",
			"temperature",
		],
		geopolitics: [
			"war",
			"peace",
			"international",
			"ukraine",
			"russia",
			"china",
			"nato",
			"un",
			"diplomacy",
		],
		current_events: [
			"news",
			"current events",
			"trending",
			"viral",
			"social media",
			"twitter",
			"breaking news",
		],
	};

	/**
	 * Advanced semantic keywords for better matching
	 */
	private static readonly SEMANTIC_KEYWORDS = {
		election: [
			"election",
			"vote",
			"ballot",
			"primary",
			"candidate",
			"campaign",
			"polling",
			"electoral",
		],
		economy: [
			"economy",
			"market",
			"financial",
			"economic",
			"fiscal",
			"monetary",
			"trade",
			"commerce",
		],
		competition: [
			"win",
			"winner",
			"champion",
			"victory",
			"defeat",
			"compete",
			"tournament",
			"contest",
		],
		price: [
			"price",
			"value",
			"cost",
			"expensive",
			"cheap",
			"bull",
			"bear",
			"pump",
			"dump",
		],
		popularity: [
			"popular",
			"trending",
			"viral",
			"famous",
			"celebrity",
			"mainstream",
			"widespread",
		],
	};

	/**
	 * Search markets with intelligent interest matching
	 */
	async searchMarketsByInterests(
		interests: string[],
		options: {
			limit?: number;
			knowledgeLevel?: "beginner" | "intermediate" | "advanced";
			riskTolerance?: "conservative" | "moderate" | "aggressive";
			sortBy?: string;
		} = {},
	): Promise<Market[]> {
		const {
			limit = 10,
			knowledgeLevel = "intermediate",
			riskTolerance = "moderate",
			sortBy = "relevance",
		} = options;

		// Convert interests to search queries
		const searchQueries = this.generateSearchQueries(
			interests,
			knowledgeLevel,
			riskTolerance,
		);

		console.log(
			`🎯 Searching for interests: [${interests.join(", ")}] with ${searchQueries.length} queries`,
		);

		// Collect results from all queries
		const allResults: (Market & { relevanceScore: number })[] = [];

		for (const query of searchQueries) {
			try {
				const results = await this.searchMarketsEnhanced(query, {
					limit: Math.min(limit * 2, 50), // Capped over-fetching
					sortBy,
					useGammaAPI: true, // Use the working Gamma API
					minLiquidity:
						riskTolerance === "conservative"
							? 1000
							: riskTolerance === "moderate"
								? 500
								: 100,
				});
				allResults.push(
					...results.map((r) => ({
						...r,
						relevanceScore: (r as any).relevanceScore || 0,
					})),
				);
			} catch (error) {
				console.log(`⚠️ Query failed: ${query}`);
			}
		}

		// Deduplicate and re-rank
		const uniqueResults = this.deduplicateMarkets(allResults);
		const rankedResults = this.rankByUserProfile(uniqueResults, {
			knowledgeLevel,
			riskTolerance,
			interests,
		});

		console.log(
			`✅ Found ${rankedResults.length} unique markets across all interests`,
		);

		return rankedResults.slice(0, limit);
	}

	/**
	 * Generate smart search queries from user interests
	 */
	private generateSearchQueries(
		interests: string[],
		knowledgeLevel: string,
		riskTolerance: string,
	): string[] {
		const queries: string[] = [];

		for (const interest of interests) {
			const interestLower = interest.toLowerCase();

			// Direct interest query
			queries.push(interestLower);

			// Add related keywords from our mapping
			for (const [category, keywords] of Object.entries(
				PolymarketService.INTEREST_CATEGORY_MAP,
			)) {
				if (
					keywords.some(
						(keyword) =>
							interestLower.includes(keyword) ||
							keyword.includes(interestLower),
					)
				) {
					// Add high-value keywords from this category
					queries.push(...keywords.slice(0, 3));
					break;
				}
			}
		}

		// Filter for knowledge level
		if (knowledgeLevel === "beginner") {
			// Focus on mainstream, clear topics
			return queries
				.filter((q) =>
					["election", "bitcoin", "sports", "movie", "weather", "stock"].some(
						(simple) => q.includes(simple),
					),
				)
				.slice(0, 5);
		}

		return [...new Set(queries)].slice(0, 8); // Dedupe and limit
	}

	/**
	 * Remove duplicate markets and combine scores
	 */
	private deduplicateMarkets(
		markets: (Market & { relevanceScore: number })[],
	): (Market & { relevanceScore: number })[] {
		const seen = new Map<string, Market & { relevanceScore: number }>();

		for (const market of markets) {
			const key = market.id;
			const existing = seen.get(key);

			if (!existing || market.relevanceScore > existing.relevanceScore) {
				seen.set(key, market);
			}
		}

		return Array.from(seen.values());
	}

	/**
	 * Rank markets based on user profile
	 */
	private rankByUserProfile(
		markets: (Market & { relevanceScore: number })[],
		profile: {
			knowledgeLevel: string;
			riskTolerance: string;
			interests: string[];
		},
	): (Market & { relevanceScore: number })[] {
		return markets.sort((a, b) => {
			let aScore = a.relevanceScore;
			let bScore = b.relevanceScore;

			// Knowledge level adjustments
			if (profile.knowledgeLevel === "beginner") {
				// Boost simpler, mainstream markets
				if (this.isBeginnerFriendly(a)) aScore += 0.5;
				if (this.isBeginnerFriendly(b)) bScore += 0.5;
			}

			// Risk tolerance adjustments
			if (profile.riskTolerance === "conservative") {
				// Prefer longer-term, established markets
				if (this.isLowerRisk(a)) aScore += 0.3;
				if (this.isLowerRisk(b)) bScore += 0.3;
			}

			return bScore - aScore;
		});
	}

	/**
	 * Check if market is beginner-friendly
	 */
	private isBeginnerFriendly(market: Market): boolean {
		const text = `${market.question} ${market.description || ""}`.toLowerCase();
		const beginnerTopics = [
			"election",
			"sports",
			"movie",
			"weather",
			"bitcoin price",
			"stock market",
		];
		return beginnerTopics.some((topic) => text.includes(topic));
	}

	/**
	 * Check if market is lower risk
	 */
	private isLowerRisk(market: Market): boolean {
		// Markets with later end dates tend to be less volatile
		if (market.endDate) {
			const endDate = new Date(market.endDate);
			const monthsOut =
				(endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
			if (monthsOut > 2) return true;
		}

		// Established categories tend to be less risky
		const establishedCategories = ["Politics", "Sports", "Economics"];
		return establishedCategories.includes(market.category || "");
	}

	/**
	 * Search markets by keywords/interests with advanced relevance scoring
	 */
	async searchMarkets(
		query: string,
		options: {
			limit?: number;
			category?: string;
			sortBy?: string;
			minRelevanceScore?: number;
		} = {},
	): Promise<Market[]> {
		await this.ensureInitialized();

		if (!this.clobClient) {
			throw new Error("CLOB client not initialized");
		}

		try {
			const {
				limit = 10,
				category,
				sortBy = "relevance",
				minRelevanceScore = 0.1,
			} = options;
			console.log(
				`🔍 Advanced search for: "${query}"${category ? ` in ${category}` : ""} (sortBy: ${sortBy})`,
			);

			// Fetch more markets for better filtering
			const allMarkets = await this.getMarkets(Math.min(limit * 3, 150)); // Much more efficient: 3x instead of 10x

			// Calculate relevance scores for each market
			const scoredMarkets = allMarkets.map((market) => ({
				...market,
				relevanceScore: this.calculateRelevanceScore(market, query, category),
			}));

			// Filter by minimum relevance score
			const relevantMarkets = scoredMarkets.filter(
				(market) => market.relevanceScore >= minRelevanceScore,
			);

			// Sort by relevance score
			relevantMarkets.sort((a, b) => b.relevanceScore - a.relevanceScore);

			const results = relevantMarkets.slice(0, limit);

			console.log(
				`✅ Found ${results.length} relevant markets (${relevantMarkets.length} total above threshold)`,
			);

			// Log top scores for debugging
			if (results.length > 0) {
				console.log(
					`📊 Top relevance scores: ${results
						.slice(0, 3)
						.map((m) => m.relevanceScore.toFixed(3))
						.join(", ")}`,
				);
			}

			return results;
		} catch (error) {
			console.error("❌ Error in advanced market search:", error);
			throw error;
		}
	}

	/**
	 * Calculate advanced relevance score for a market
	 */
	private calculateRelevanceScore(
		market: Market,
		query: string,
		category?: string,
	): number {
		let score = 0;
		const queryLower = query.toLowerCase();
		const words = queryLower.split(" ").filter((w) => w.length > 2);

		// Title matching (highest weight)
		const title = market.question?.toLowerCase() || "";
		for (const word of words) {
			if (title.includes(word)) {
				score += word.length >= 5 ? 1.0 : 0.7; // Longer words more valuable

				// Boost for exact phrase matches
				if (title.includes(queryLower)) {
					score += 0.5;
				}
			}
		}

		// Description matching (medium weight)
		const description = market.description?.toLowerCase() || "";
		for (const word of words) {
			if (description.includes(word)) {
				score += word.length >= 5 ? 0.5 : 0.3;
			}
		}

		// Event/Category matching (medium weight)
		const eventTitle = market.eventTitle?.toLowerCase() || "";
		const marketCategory = market.category?.toLowerCase() || "";
		for (const word of words) {
			if (eventTitle.includes(word) || marketCategory.includes(word)) {
				score += 0.4;
			}
		}

		// Semantic keyword matching
		score += this.calculateSemanticScore(`${title} ${description}`, queryLower);

		// Interest category matching
		score += this.calculateInterestCategoryScore(market, queryLower);

		// Category filter boost
		if (category) {
			const categoryLower = category.toLowerCase();
			if (
				marketCategory.includes(categoryLower) ||
				eventTitle.includes(categoryLower)
			) {
				score += 0.3;
			}
		}

		// Recency boost (prefer markets that haven't ended)
		if (market.endDate) {
			const endDate = new Date(market.endDate);
			const now = new Date();
			if (endDate > now) {
				score += 0.2; // Active markets get boost
			}
		}

		return Math.min(score, 10); // Cap at 10 to prevent runaway scores
	}

	/**
	 * Calculate semantic similarity score
	 */
	private calculateSemanticScore(text: string, query: string): number {
		let semanticScore = 0;

		for (const [concept, keywords] of Object.entries(
			PolymarketService.SEMANTIC_KEYWORDS,
		)) {
			if (query.includes(concept)) {
				for (const keyword of keywords) {
					if (text.includes(keyword)) {
						semanticScore += 0.1;
					}
				}
			}
		}

		return Math.min(semanticScore, 1.0);
	}

	/**
	 * Calculate interest category relevance score
	 */
	private calculateInterestCategoryScore(
		market: Market,
		query: string,
	): number {
		let categoryScore = 0;
		const text = [
			market.question?.toLowerCase(),
			market.description?.toLowerCase(),
			market.eventTitle?.toLowerCase(),
			market.category?.toLowerCase(),
		]
			.filter(Boolean)
			.join(" ");

		for (const [interest, keywords] of Object.entries(
			PolymarketService.INTEREST_CATEGORY_MAP,
		)) {
			// Check if user query matches this interest category
			const queryMatchesInterest = keywords.some(
				(keyword) => query.includes(keyword) || keyword.includes(query),
			);

			if (queryMatchesInterest) {
				// Check if market content matches this interest category
				const marketMatchesInterest = keywords.some((keyword) =>
					text.includes(keyword),
				);

				if (marketMatchesInterest) {
					categoryScore += 0.5;
				}
			}
		}

		return Math.min(categoryScore, 1.5);
	}

	/**
	 * Sort markets by different strategies
	 */
	private sortMarketsByStrategy(
		markets: (Market & { relevanceScore: number })[],
		strategy: string,
	): (Market & { relevanceScore: number })[] {
		switch (strategy) {
			case "relevance":
				return markets.sort((a, b) => b.relevanceScore - a.relevanceScore);

			case "popularity":
				// TODO: Integrate with Gamma API for volume data
				// For now, combine relevance with market signals
				return markets.sort((a, b) => {
					const aPopScore = this.estimatePopularityScore(a);
					const bPopScore = this.estimatePopularityScore(b);
					return (
						b.relevanceScore * 0.7 +
						bPopScore * 0.3 -
						(a.relevanceScore * 0.7 + aPopScore * 0.3)
					);
				});

			case "recent":
				return markets.sort((a, b) => {
					const aTime = a.endDate ? new Date(a.endDate).getTime() : 0;
					const bTime = b.endDate ? new Date(b.endDate).getTime() : 0;
					return (
						b.relevanceScore * 0.5 +
						(bTime > Date.now() ? 1 : 0) * 0.5 -
						(a.relevanceScore * 0.5 + (aTime > Date.now() ? 1 : 0) * 0.5)
					);
				});

			default:
				return markets.sort((a, b) => b.relevanceScore - a.relevanceScore);
		}
	}

	/**
	 * Estimate popularity score based on available market data
	 */
	private estimatePopularityScore(market: Market): number {
		let popScore = 0;

		// Markets with descriptions tend to be more developed
		if (market.description && market.description.length > 50) {
			popScore += 0.2;
		}

		// Markets with clear outcomes tend to be more liquid
		if (market.outcomes && market.outcomes.length >= 2) {
			popScore += 0.3;
		}

		// Markets with event grouping tend to be more popular
		if (market.eventTitle && market.eventTitle.length > 0) {
			popScore += 0.2;
		}

		// Markets with clear categories tend to be more mainstream
		if (
			market.category &&
			["Politics", "Sports", "Crypto"].includes(market.category)
		) {
			popScore += 0.3;
		}

		return popScore;
	}

	/**
	 * Get markets grouped by events for better organization
	 */
	async getMarketsByEvents(
		limit = 10,
	): Promise<{ [eventTitle: string]: Market[] }> {
		await this.ensureInitialized();

		if (!this.clobClient) {
			throw new Error("CLOB client not initialized");
		}

		try {
			console.log("🔍 Fetching markets grouped by events...");
			const markets = await this.getMarkets(limit * 3); // Get more to have good event groupings

			// Group markets by event
			const eventGroups: { [eventTitle: string]: Market[] } = {};

			for (const market of markets) {
				const eventKey =
					market.eventTitle || market.category || "Other Markets";
				if (!eventGroups[eventKey]) {
					eventGroups[eventKey] = [];
				}
				eventGroups[eventKey].push(market);
			}

			// Limit to requested number of events
			const limitedEvents = Object.keys(eventGroups)
				.slice(0, limit)
				.reduce(
					(result, key) => {
						result[key] = eventGroups[key];
						return result;
					},
					{} as { [eventTitle: string]: Market[] },
				);

			console.log(
				`✅ Grouped markets into ${Object.keys(limitedEvents).length} events`,
			);
			return limitedEvents;
		} catch (error) {
			console.error("❌ Error fetching markets by events:", error);
			throw error;
		}
	}

	/**
	 * Get specific market by condition ID
	 */
	async getMarket(conditionId: string): Promise<Market> {
		await this.ensureInitialized();

		if (!this.clobClient) {
			throw new Error("CLOB client not initialized");
		}

		try {
			const market = await this.clobClient.getMarket(conditionId);
			return marketSchema.parse(market);
		} catch (error) {
			console.error("Error fetching market:", error);
			throw error;
		}
	}

	/**
	 * Get order book for a specific token
	 */
	async getOrderBook(tokenId: string): Promise<OrderBook> {
		await this.ensureInitialized();

		if (!this.clobClient) {
			throw new Error("CLOB client not initialized");
		}

		try {
			const orderBook = await this.clobClient.getOrderBook(tokenId);
			return orderBookSchema.parse(orderBook);
		} catch (error) {
			console.error("Error fetching order book:", error);
			throw error;
		}
	}

	/**
	 * Check USDC balance and allowances for buy orders
	 */
	async checkBuyOrderRequirements(orderValue: number): Promise<{
		canPlace: boolean;
		balance?: number;
		allowance?: number;
		maxOrderSize?: number;
		error?: string;
	}> {
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet) {
			return {
				canPlace: false,
				error: "CLOB client or wallet not initialized",
			};
		}

		try {
			// Get current USDC balance and allowance
			const balanceResponse = await this.clobClient.getBalanceAllowance();
			const usdcBalance = Number(balanceResponse.balance || 0);

			// Get existing unfilled orders to calculate available balance
			const orders = await this.clobClient.getOpenOrders();
			const unfilledBuyValue = orders
				.filter((order: any) => order.side === "BUY" && order.status === "OPEN")
				.reduce(
					(sum: number, order: any) =>
						sum + Number(order.size) * Number(order.price),
					0,
				);

			const availableBalance = usdcBalance - unfilledBuyValue;
			const maxOrderSize = Math.max(0, availableBalance);

			return {
				canPlace: orderValue <= maxOrderSize,
				balance: usdcBalance,
				maxOrderSize,
				error:
					orderValue > maxOrderSize
						? `Insufficient available balance. Max order size: $${maxOrderSize.toFixed(2)}`
						: undefined,
			};
		} catch (error) {
			return {
				canPlace: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to check requirements",
			};
		}
	}

	/**
	 * Check conditional token balance for sell orders
	 */
	async checkSellOrderRequirements(
		tokenId: string,
		size: number,
	): Promise<{
		canPlace: boolean;
		balance?: number;
		maxOrderSize?: number;
		error?: string;
	}> {
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet) {
			return {
				canPlace: false,
				error: "CLOB client or wallet not initialized",
			};
		}

		try {
			// Get user positions - for now, use a simplified approach
			// Note: We'll need to implement position tracking separately
			// as the CLOB client doesn't have a direct getPositions method
			const tokenBalance = 0; // Placeholder - implement position tracking

			// Get existing unfilled sell orders for this token
			const orders = await this.clobClient.getOpenOrders();
			const unfilledSellSize = orders
				.filter(
					(order: any) =>
						order.side === "SELL" &&
						order.status === "OPEN" &&
						order.asset_id === tokenId,
				)
				.reduce((sum: number, order: any) => sum + Number(order.size), 0);

			const availableTokens = tokenBalance - unfilledSellSize;
			const maxOrderSize = Math.max(0, availableTokens);

			return {
				canPlace: size <= maxOrderSize,
				balance: tokenBalance,
				maxOrderSize,
				error:
					size > maxOrderSize
						? `Insufficient token balance. Max sell size: ${maxOrderSize}`
						: undefined,
			};
		} catch (error) {
			return {
				canPlace: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to check requirements",
			};
		}
	}

	/**
	 * Create a buy order with enhanced validation
	 */
	async createBuyOrder(
		tokenId: string,
		price: number,
		size: number,
		options: { skipValidation?: boolean } = {},
	): Promise<OrderResponse> {
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet) {
			throw new Error("CLOB client or wallet not initialized");
		}

		// Enhanced validation unless explicitly skipped
		if (!options.skipValidation) {
			const orderValue = price * size;
			const requirements = await this.checkBuyOrderRequirements(orderValue);

			if (!requirements.canPlace) {
				return {
					success: false,
					error: requirements.error || "Order validation failed",
					validationDetails: {
						orderValue,
						maxOrderSize: requirements.maxOrderSize,
						balance: requirements.balance,
					},
				};
			}
		}

		try {
			const order = await this.clobClient.createOrder({
				tokenID: tokenId,
				price,
				side: Side.BUY,
				size,
				feeRateBps: 0,
			});

			const response = await this.clobClient.postOrder(order);
			return {
				success: true,
				orderId: response.orderID || response.id,
				message: "Buy order created successfully",
				orderDetails: {
					tokenId,
					price,
					size,
					side: "BUY",
					totalValue: price * size,
				},
			};
		} catch (error) {
			console.error("Error creating buy order:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Create a sell order with enhanced validation
	 */
	async createSellOrder(
		tokenId: string,
		price: number,
		size: number,
		options: { skipValidation?: boolean } = {},
	): Promise<OrderResponse> {
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet) {
			throw new Error("CLOB client or wallet not initialized");
		}

		// Enhanced validation unless explicitly skipped
		if (!options.skipValidation) {
			const requirements = await this.checkSellOrderRequirements(tokenId, size);

			if (!requirements.canPlace) {
				return {
					success: false,
					error: requirements.error || "Sell order validation failed",
					validationDetails: {
						requestedSize: size,
						maxOrderSize: requirements.maxOrderSize,
						balance: requirements.balance,
					},
				};
			}
		}

		try {
			const order = await this.clobClient.createOrder({
				tokenID: tokenId,
				price,
				side: Side.SELL,
				size,
				feeRateBps: 0,
			});

			const response = await this.clobClient.postOrder(order);
			return {
				success: true,
				orderId: response.orderID || response.id,
				message: "Sell order created successfully",
				orderDetails: {
					tokenId,
					price,
					size,
					side: "SELL",
					totalValue: price * size,
				},
			};
		} catch (error) {
			console.error("Error creating sell order:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Get user's orders (placeholder implementation)
	 */
	async getUserOrders(): Promise<OrderResponse[]> {
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet) {
			throw new Error("CLOB client or wallet not initialized");
		}

		// Placeholder - actual implementation depends on CLOB client API
		return [];
	}

	/**
	 * Check if client is ready for trading
	 */
	isReadyForTrading(): boolean {
		return !!(this.clobClient && this.wallet && this.isInitialized);
	}

	/**
	 * Get user positions from Polymarket Data API
	 * This uses the REST API, not CLOB, so works without authentication
	 */
	async getUserPositions(
		userAddress: string,
		options: {
			limit?: number;
			sizeThreshold?: number;
			eventId?: string;
			market?: string;
			redeemable?: boolean;
			sortBy?:
				| "TOKENS"
				| "CURRENT"
				| "INITIAL"
				| "CASHPNL"
				| "PERCENTPNL"
				| "TITLE"
				| "RESOLVING"
				| "PRICE";
			sortDirection?: "ASC" | "DESC";
		} = {},
	) {
		try {
			const {
				limit = 50,
				sizeThreshold = 1,
				eventId,
				market,
				redeemable,
				sortBy = "CURRENT",
				sortDirection = "DESC",
			} = options;

			const params = new URLSearchParams({
				user: userAddress,
				limit: limit.toString(),
				sizeThreshold: sizeThreshold.toString(),
				sortBy,
				sortDirection,
			});

			if (eventId) params.append("eventId", eventId);
			if (market) params.append("market", market);
			if (redeemable !== undefined)
				params.append("redeemable", redeemable.toString());

			const url = `https://data-api.polymarket.com/positions?${params}`;
			console.log(`🔍 Fetching user positions from: ${url}`);

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const positions = await response.json();
			console.log(`✅ Fetched ${positions.length} positions for user`);

			return positions;
		} catch (error) {
			console.error("❌ Error fetching user positions:", error);
			throw error;
		}
	}

	/**
	 * Get wallet address
	 */
	getWalletAddress(): string | null {
		return this.wallet?.address || null;
	}

	/**
	 * Fetch markets from Gamma API with enhanced metadata
	 */
	async getMarketsFromGamma(
		options: {
			limit?: number;
			offset?: number;
			active?: boolean;
			closed?: boolean;
			order?: "volume24hr" | "liquidity" | "newest" | "ending_soonest";
			min_liquidity?: number;
			tags?: string[];
		} = {},
	): Promise<Record<string, unknown>[]> {
		try {
			const {
				limit = 20,
				offset = 0,
				active = true,
				order = "volume24hr",
				min_liquidity = 100,
				tags = [],
			} = options;

			const params = new URLSearchParams({
				limit: limit.toString(),
				offset: offset.toString(),
				active: active.toString(),
				closed: "false", // Only get open markets
				order,
				min_liquidity: min_liquidity.toString(),
			});

			// Use a date from a few months ago to get current markets
			// This filters for markets that started recently and are still active
			const threeMonthsAgo = new Date();
			threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 1);
			params.append("start_date_min", threeMonthsAgo.toISOString());
			console.log(
				`📅 Using start_date_min filter: ${threeMonthsAgo.toISOString()}`,
			);

			if (tags.length > 0) {
				params.append("tags", tags.join(","));
			}

			const url = `https://gamma-api.polymarket.com/markets?${params}`;
			console.log(`🌟 Fetching enhanced markets from Gamma API: ${url}`);

			const response = await fetch(url);
			if (!response.ok) {
				console.warn(`⚠️ Gamma API request failed: ${response.status}`);
				return [];
			}

			const data = await response.json();
			const markets = data.data || data || [];

			console.log(
				`✅ Fetched ${markets.length} markets from Gamma API with enhanced metadata`,
			);
			return markets;
		} catch (error) {
			console.error("❌ Error fetching from Gamma API:", error);
			return [];
		}
	}

	/**
	 * Extract relevant tags from search query for better API filtering
	 */
	private extractTagsFromQuery(query: string): string[] {
		const queryLower = query.toLowerCase();
		const tags: string[] = [];

		// Map query terms to broad, reliable categories
		const tagMappings: { [key: string]: string[] } = {
			politics: ["Politics"],
			election: ["Politics"],
			president: ["Politics"],
			biden: ["Politics"],
			trump: ["Politics"],
			sports: ["Sports"],
			nba: ["Sports"],
			basketball: ["Sports"],
			football: ["Sports"],
			nfl: ["Sports"],
			soccer: ["Sports"],
			crypto: ["Crypto"],
			bitcoin: ["Crypto"],
			ethereum: ["Crypto"],
			tech: ["Tech"],
			ai: ["Tech"],
			technology: ["Tech"],
		};

		for (const [term, associatedTags] of Object.entries(tagMappings)) {
			if (queryLower.includes(term)) {
				tags.push(...associatedTags);
			}
		}

		return [...new Set(tags)]; // Remove duplicates
	}

	/**
	 * Enhanced market search that combines CLOB + Gamma API data
	 */
	async searchMarketsEnhanced(
		query: string,
		options: {
			limit?: number;
			category?: string;
			sortBy?: string;
			minLiquidity?: number;
			useGammaAPI?: boolean;
		} = {},
	): Promise<Market[]> {
		const {
			limit = 10,
			category,
			sortBy = "relevance",
			minLiquidity = 500,
			useGammaAPI = true,
		} = options;

		try {
			let enhancedMarkets: Record<string, unknown>[] = [];

			// Try Gamma API first for enhanced data
			if (useGammaAPI) {
				const tags = this.extractTagsFromQuery(query);
				console.log(`🏷️ Using tags for better filtering: ${tags.join(", ")}`);

				const gammaMarkets = await this.getMarketsFromGamma({
					limit: Math.min(limit * 2, 50), // Reduced over-fetching
					order: sortBy === "popularity" ? "volume24hr" : "newest",
					min_liquidity: minLiquidity,
					active: true,
					tags, // Smart tag filtering
				});

				enhancedMarkets = gammaMarkets;
			}

			// Fallback to CLOB API if Gamma fails or is disabled
			if (enhancedMarkets.length === 0) {
				console.log("📡 Using CLOB API as fallback");
				enhancedMarkets = await this.getMarkets(Math.min(limit * 2, 100)); // Reduced over-fetching
			}

			// Apply relevance scoring
			const scoredMarkets: EnhancedMarket[] = enhancedMarkets.map((market) => {
				const normalizedMarket = this.normalizeMarketData(market);
				return {
					...normalizedMarket,
					relevanceScore: this.calculateRelevanceScore(
						normalizedMarket,
						query,
						category,
					),
					volume24hr: Number(market.volume24hr || 0),
					liquidity: Number(market.liquidity || 0),
					popularityScore: this.calculatePopularityScore(market),
				};
			});

			// Filter by relevance threshold (very permissive for debugging)
			const relevantMarkets = scoredMarkets.filter(
				(market) =>
					market.relevanceScore >= 0.01 && // Very low threshold
					(market.liquidity || 0) >= 0, // Accept any liquidity
			);

			console.log(
				`🎯 Found ${scoredMarkets.length} scored markets, ${relevantMarkets.length} passed filters`,
			);

			// Sort by strategy
			const sortedMarkets = this.sortEnhancedMarkets(relevantMarkets, sortBy);

			console.log(
				`🎯 Enhanced search found ${sortedMarkets.length} relevant markets`,
			);
			return sortedMarkets.slice(0, limit);
		} catch (error) {
			console.error(
				"❌ Enhanced search failed, falling back to basic search:",
				error,
			);
			return this.searchMarkets(query, { limit, category, sortBy });
		}
	}

	/**
	 * Normalize market data from different API sources
	 */
	private normalizeMarketData(market: Record<string, unknown>): Market {
		const outcomes = market.outcomes as string[] | undefined;
		const outcomePrices = market.outcome_prices as
			| Array<{ outcome: string }>
			| undefined;
		const event = market.event as { title?: string } | undefined;
		const tags = market.tags as string[] | undefined;

		return {
			id: String(
				market.condition_id || market.id || market.question_id || "unknown",
			),
			question: String(market.question || market.title || "Unknown market"),
			description: String(market.description || market.description_text || ""),
			endDate: String(
				market.end_date_iso || market.endDate || market.end_time || "",
			),
			outcomes: outcomes || outcomePrices?.map((p) => p.outcome) || [],
			eventId: String(market.event_id || market.eventId || ""),
			eventTitle: String(
				event?.title || market.eventTitle || market.event_name || "",
			),
			category: String(
				market.category || tags?.[0] || market.market_type || "",
			),
			conditionId: String(
				market.condition_id || market.conditionId || market.id || "",
			),
		};
	}

	/**
	 * Calculate popularity score from enhanced market data
	 */
	private calculatePopularityScore(market: Record<string, unknown>): number {
		let score = 0;

		// Volume-based scoring
		const volume24hr = Number(market.volume24hr || market.volume || 0);
		if (volume24hr > 10000) score += 2.0;
		else if (volume24hr > 1000) score += 1.0;
		else if (volume24hr > 100) score += 0.5;

		// Liquidity-based scoring
		const liquidity = Number(market.liquidity || 0);
		if (liquidity > 5000) score += 1.5;
		else if (liquidity > 1000) score += 1.0;
		else if (liquidity > 500) score += 0.5;

		// Activity indicators
		const commentCount = Number(market.new_comment_count || 0);
		const participantCount = Number(market.participant_count || 0);
		if (commentCount > 10) score += 0.5;
		if (participantCount > 100) score += 0.5;

		// Trending indicators
		const tags = market.tags as string[] | undefined;
		if (tags?.includes("trending")) score += 1.0;
		if (market.featured) score += 0.5;

		return Math.min(score, 5.0);
	}

	/**
	 * Sort enhanced markets with popularity data
	 */
	private sortEnhancedMarkets(
		markets: EnhancedMarket[],
		strategy: string,
	): EnhancedMarket[] {
		switch (strategy) {
			case "relevance":
				return markets.sort((a, b) => b.relevanceScore - a.relevanceScore);

			case "popularity":
				return markets.sort((a, b) => {
					const aScore = a.relevanceScore * 0.4 + a.popularityScore * 0.6;
					const bScore = b.relevanceScore * 0.4 + b.popularityScore * 0.6;
					return bScore - aScore;
				});

			case "recent":
				return markets.sort((a, b) => {
					const aTime = a.endDate ? new Date(a.endDate).getTime() : 0;
					const bTime = b.endDate ? new Date(b.endDate).getTime() : 0;
					return bTime - aTime;
				});

			default:
				return markets.sort((a, b) => b.relevanceScore - a.relevanceScore);
		}
	}
}
