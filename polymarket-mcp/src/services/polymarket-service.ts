import { Chain, ClobClient, Side } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { z } from "zod";

// Types and schemas
// Token schema for CLOB API
const tokenSchema = z.object({
	token_id: z.string(),
	outcome: z.string(),
});

// Rewards schema for CLOB API
const rewardsSchema = z.object({
	min_size: z.number(),
	max_spread: z.number(),
	event_start_date: z.string().optional(),
	event_end_date: z.string().optional(),
	in_game_multiplier: z.number().optional(),
	reward_epoch: z.number().optional(),
});

// Market schema matching actual CLOB API response
const marketSchema = z.object({
	condition_id: z.string(), // Primary market ID
	question_id: z.string().optional(),
	question: z.string(),
	tokens: z.array(tokenSchema),
	rewards: rewardsSchema.optional(),
	minimum_order_size: z.union([z.string(), z.number()]).optional(), // Can be string or number
	minimum_tick_size: z.union([z.string(), z.number()]).optional(), // Can be string or number
	category: z.string().optional(),
	end_date_iso: z.string().optional(),
	game_start_time: z.union([z.string(), z.null()]).optional(), // Can be string or null
	market_slug: z.string().optional(),
	min_incentive_size: z.string().optional(),
	max_incentive_spread: z.string().optional(),
	active: z.boolean().optional(),
	closed: z.boolean().optional(),
	seconds_delay: z.number().optional(),
	icon: z.string().optional(),
	fpmm: z.string().optional(),
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

export interface Market {
	id: string;
	question: string;
	description?: string;
	endDate?: string;
	outcomes: string[];
	eventId?: string;
	eventTitle?: string;
	category?: string;
	conditionId?: string;
}

export interface OrderBook {
	bids: Array<{ price: string; size: string }>;
	asks: Array<{ price: string; size: string }>;
}

export interface OrderResponse {
	success: boolean;
	orderId?: string;
	error?: string;
	message?: string;
	orderDetails?: {
		tokenId: string;
		price: number;
		size: number;
		side: string;
		totalValue: number;
	};
	validationDetails?: {
		orderValue?: number;
		requestedSize?: number;
		maxOrderSize?: number;
		balance?: number;
	};
}

export interface OrderRequirements {
	canPlace: boolean;
	balance?: number;
	allowance?: number;
	maxOrderSize?: number;
	error?: string;
}

type RawMarket = z.infer<typeof marketSchema>;

interface EnhancedMarket extends Market {
	relevanceScore: number;
	volume24hr?: number;
	liquidity?: number;
	popularityScore?: number;
}

export class PolymarketService {
	private clobClient: ClobClient | null = null;
	private wallet: Wallet | null = null;
	private isInitialized = false;

	/**
	 * Category mappings for better market organization
	 */
	private static readonly CATEGORY_MAPPINGS = {
		politics: [
			"election",
			"vote",
			"president",
			"congress",
			"senate",
			"candidate",
			"political",
			"policy",
			"government",
			"biden",
			"trump",
		],
		sports: [
			"nfl",
			"nba",
			"mlb",
			"soccer",
			"football",
			"basketball",
			"baseball",
			"olympics",
			"championship",
			"playoff",
			"tournament",
		],
		crypto: [
			"bitcoin",
			"ethereum",
			"crypto",
			"blockchain",
			"defi",
			"nft",
			"token",
			"coin",
			"btc",
			"eth",
			"trading",
		],
		tech: [
			"ai",
			"artificial intelligence",
			"technology",
			"tech",
			"startup",
			"ipo",
			"stock",
			"tesla",
			"apple",
			"google",
			"meta",
		],
		entertainment: [
			"movie",
			"film",
			"tv",
			"celebrity",
			"awards",
			"oscar",
			"emmy",
			"music",
			"album",
			"box office",
		],
		current_events: [
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

	constructor() {
		// Initialize in constructor
		this.initializeClient();
	}

	/**
	 * Initialize the Polymarket CLOB client
	 */
	private async initializeClient(): Promise<void> {
		try {
			const privateKey = process.env.PRIVATE_KEY;
			if (!privateKey) {
				console.warn(
					"⚠️ No PRIVATE_KEY provided - CLOB client will be read-only",
				);
				this.isInitialized = true;
				return;
			}

			// Create wallet
			this.wallet = new Wallet(privateKey);
			console.log(`🔑 Wallet address: ${this.wallet.address}`);

			// Initialize CLOB client
			this.clobClient = new ClobClient(
				process.env.CLOB_API_URL || "https://clob.polymarket.com",
				Chain.POLYGON,
				this.wallet,
			);

			this.isInitialized = true;
			const mode = this.canTrade()
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
	 * Get available markets from Polymarket CLOB (only used for specific market details now)
	 */
	async getMarkets(limit = 10): Promise<Market[]> {
		await this.ensureInitialized();

		if (!this.clobClient) {
			throw new Error("CLOB client not initialized");
		}

		try {
			console.log("📊 Fetching markets from Polymarket CLOB...");
			const markets = await this.clobClient.getMarkets();

			const marketData = Array.isArray(markets) ? markets : markets?.data || [];
			if (Array.isArray(marketData)) {
				// Filter for recent markets only
				const cutoffDate = new Date();
				cutoffDate.setDate(cutoffDate.getDate() - 60);

				const recentMarkets = marketData.filter((market: any) => {
					const endDate = market.end_date_iso || market.endDate;
					if (!endDate) return false;

					const marketEndDate = new Date(endDate);
					const isRecent = marketEndDate > cutoffDate;
					const isActive = market.active !== false;

					return isRecent && isActive;
				});

				console.log(
					`📊 Filtered from ${marketData.length} to ${recentMarkets.length} recent active markets`,
				);

				const processedMarkets = recentMarkets.slice(0, limit).map((market) => {
					try {
						const rawMarket = marketSchema.parse(market);
						return {
							id: rawMarket.condition_id,
							question: rawMarket.question,
							description: "",
							endDate: rawMarket.end_date_iso || "",
							outcomes: rawMarket.tokens.map((t) => t.outcome),
							eventId: rawMarket.question_id || "",
							eventTitle: "",
							category: "",
							conditionId: rawMarket.condition_id,
						};
					} catch (error) {
						console.log("⚠️ Market validation failed, using fallback");
						return this.createFallbackMarket(market);
					}
				});

				return processedMarkets;
			}

			console.log("⚠️ No market data found in response");
			return [];
		} catch (error) {
			console.error("❌ Error fetching markets from CLOB:", error);
			throw error;
		}
	}

	/**
	 * Get markets grouped by events (uses CLOB)
	 */
	async getMarketsByEvents(
		limit = 5,
	): Promise<{ [eventTitle: string]: Market[] }> {
		await this.ensureInitialized();

		if (!this.clobClient) {
			throw new Error("CLOB client not initialized");
		}

		try {
			console.log("📊 Fetching markets grouped by events...");
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
	 * Fetch markets from Gamma API with enhanced metadata
	 */
	async getMarketsFromGamma(
		options: {
			limit?: number;
			offset?: number;
			active?: boolean;
			closed?: boolean;
			order?: "volume24hr" | "liquidity" | "volume";
			min_liquidity?: number;
			tags?: string[];
			maxRetries?: number;
			retryDelay?: number;
		} = {},
	): Promise<Record<string, unknown>[]> {
		const {
			limit = 20,
			offset = 0,
			active = true,
			order = "volume24hr",
			min_liquidity = 100,
			tags = [],
			maxRetries = 2,
			retryDelay = 1000,
		} = options;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const params = new URLSearchParams({
					limit: limit.toString(),
					offset: offset.toString(),
					active: active.toString(),
					closed: "false", // Only get open markets
					order,
					min_liquidity: min_liquidity.toString(),
				});

				// Enhanced date filtering for current markets
				const recentDate = new Date();
				recentDate.setDate(recentDate.getDate() - 30);
				params.append("start_date_min", recentDate.toISOString());

				if (tags.length > 0) {
					params.append("tags", tags.join(","));
				}

				const url = `https://gamma-api.polymarket.com/markets?${params}`;
				console.log(
					`🌟 Fetching markets from Gamma API (attempt ${attempt + 1}): ${url}`,
				);

				const response = await fetch(url, {
					headers: {
						Accept: "application/json",
						"User-Agent": "PolymarketMCP/1.0",
					},
				});

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const data = await response.json();
				const markets = Array.isArray(data) ? data : [];

				console.log(
					`✅ Fetched ${markets.length} markets from Gamma API with enhanced metadata`,
				);

				return markets;
			} catch (error) {
				console.warn(`⚠️ Gamma API attempt ${attempt + 1} failed:`, error);

				if (attempt < maxRetries) {
					console.log(`🔄 Retrying in ${retryDelay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, retryDelay));
					continue;
				}

				console.error("❌ All Gamma API attempts failed:", error);
				return [];
			}
		}

		return [];
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
	 * Enhanced market search using ONLY Gamma API
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

			// Use Gamma API only for enhanced data
			if (useGammaAPI) {
				const tags = this.extractTagsFromQuery(query);
				console.log(`🏷️ Using tags for better filtering: ${tags.join(", ")}`);

				const gammaMarkets = await this.getMarketsFromGamma({
					limit: Math.min(limit * 2, 50),
					order: sortBy === "popularity" ? "volume24hr" : "volume",
					min_liquidity: minLiquidity,
					active: true,
					tags,
				});

				enhancedMarkets = gammaMarkets;
			}

			// Gamma API only - no CLOB fallback
			if (enhancedMarkets.length === 0) {
				console.log(
					"⚠️ No markets found from Gamma API - returning empty results",
				);
				return [];
			}

			// Apply relevance scoring directly on Gamma API data
			const scoredMarkets: EnhancedMarket[] = enhancedMarkets.map((market) => {
				const marketAny = market as Record<string, unknown>;
				return {
					id: (marketAny.conditionId as string) || "",
					question: (marketAny.question as string) || "Unknown Market",
					description: (marketAny.description as string) || "",
					endDate: (marketAny.endDate as string) || "",
					outcomes: (marketAny.outcomes as string[]) || ["Yes", "No"],
					eventId: (marketAny.questionID as string) || "",
					eventTitle: (marketAny.eventTitle as string) || "",
					category: (marketAny.category as string) || "",
					conditionId: (marketAny.conditionId as string) || "",
					relevanceScore: this.calculateRelevanceScore(
						{
							id: (marketAny.conditionId as string) || "",
							question: (marketAny.question as string) || "Unknown Market",
							description: (marketAny.description as string) || "",
							endDate: (marketAny.endDate as string) || "",
							outcomes: (marketAny.outcomes as string[]) || ["Yes", "No"],
							eventId: (marketAny.questionID as string) || "",
							eventTitle: (marketAny.eventTitle as string) || "",
							category: (marketAny.category as string) || "",
							conditionId: (marketAny.conditionId as string) || "",
						},
						query,
						category,
					),
					volume24hr: Number(marketAny.volume24hr || 0),
					liquidity: Number(marketAny.liquidityNum || marketAny.liquidity || 0),
					popularityScore: this.calculatePopularityScore(market),
				};
			});

			// Filter by relevance threshold (temporarily disabled for testing)
			const relevantMarkets = scoredMarkets.filter(
				(market) => (market.liquidity || 0) >= 0, // Only filter by liquidity
			);

			console.log(
				`🎯 Found ${scoredMarkets.length} scored markets, ${relevantMarkets.length} passed filters`,
			);

			// Sort by strategy
			const sortedMarkets = this.sortEnhancedMarkets(relevantMarkets, sortBy);

			console.log(
				`🎯 Enhanced search found ${sortedMarkets.length} relevant markets`,
			);

			// Convert to final Market format
			const finalMarkets: Market[] = sortedMarkets
				.slice(0, limit)
				.map((market) => ({
					id: market.id,
					question: market.question,
					description: market.description,
					endDate: market.endDate,
					outcomes: market.outcomes,
					eventId: market.eventId,
					eventTitle: market.eventTitle,
					category: market.category,
					conditionId: market.conditionId,
				}));

			return finalMarkets;
		} catch (error) {
			// ❌ REMOVED: CLOB fallback
			// ✅ NEW: Gamma API only - return empty on error
			console.error("❌ Gamma API search failed:", error);
			console.log(
				"📋 No fallback configured - market discovery requires Gamma API",
			);
			return [];
		}
	}

	/**
	 * Search markets by interests using ONLY Gamma API
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
					limit: Math.min(limit * 2, 50),
					sortBy,
					useGammaAPI: true, // ✅ Gamma API only - no fallback
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
				console.warn(`⚠️ Query "${query}" failed (Gamma API only):`, error);
				// Continue with other queries - no CLOB fallback
			}
		}

		// Remove duplicates and sort by relevance
		const uniqueResults = Array.from(
			new Map(allResults.map((r) => [r.id, r])).values(),
		);

		const sortedResults = uniqueResults
			.sort((a, b) => b.relevanceScore - a.relevanceScore)
			.slice(0, limit);

		console.log(
			`✅ Interest-based search returned ${sortedResults.length} unique markets from Gamma API`,
		);

		return sortedResults;
	}

	/**
	 * Basic search (fallback for CLOB when needed for specific operations)
	 */
	async searchMarkets(
		query: string,
		options: {
			limit?: number;
			category?: string;
			sortBy?: string;
		} = {},
	): Promise<Market[]> {
		const { limit = 10 } = options;

		try {
			// Get all markets from CLOB
			const allMarkets = await this.getMarkets(50);

			// Simple text matching
			const queryLower = query.toLowerCase();
			const matchingMarkets = allMarkets.filter(
				(market) =>
					market.question.toLowerCase().includes(queryLower) ||
					market.description?.toLowerCase().includes(queryLower) ||
					market.category?.toLowerCase().includes(queryLower),
			);

			return matchingMarkets.slice(0, limit);
		} catch (error) {
			console.error("❌ Basic search failed:", error);
			return [];
		}
	}

	/**
	 * Generate search queries from interests
	 */
	private generateSearchQueries(
		interests: string[],
		knowledgeLevel: string,
		riskTolerance: string,
	): string[] {
		const queries: string[] = [];

		// Direct interest queries
		queries.push(...interests);

		// Add related terms based on knowledge level
		if (knowledgeLevel === "advanced") {
			queries.push(...interests.map((i) => `${i} analysis`));
		}

		return [...new Set(queries)]; // Remove duplicates
	}

	/**
	 * Calculate relevance score for a market
	 */
	private calculateRelevanceScore(
		market: Market,
		query: string,
		category?: string,
	): number {
		let score = 0;
		const queryLower = query.toLowerCase();
		const questionLower = market.question.toLowerCase();

		// Exact matches get highest score
		if (questionLower.includes(queryLower)) {
			score += 0.8;
		}

		// Category match
		if (category && market.category?.toLowerCase() === category.toLowerCase()) {
			score += 0.3;
		}

		// Word matches
		const queryWords = queryLower.split(" ");
		const questionWords = questionLower.split(" ");
		const matchingWords = queryWords.filter((word) =>
			questionWords.some((qw) => qw.includes(word)),
		);
		score += (matchingWords.length / queryWords.length) * 0.5;

		return Math.min(score, 1.0);
	}

	/**
	 * Calculate popularity score
	 */
	private calculatePopularityScore(market: Record<string, unknown>): number {
		const volume = Number(market.volume24hr || 0);
		const liquidity = Number(market.liquidity || 0);

		// Normalize scores (simplified)
		return volume / 10000 + liquidity / 5000;
	}

	/**
	 * Sort enhanced markets by strategy
	 */
	private sortEnhancedMarkets(
		markets: EnhancedMarket[],
		sortBy: string,
	): EnhancedMarket[] {
		switch (sortBy) {
			case "popularity":
				return markets.sort(
					(a, b) => (b.popularityScore || 0) - (a.popularityScore || 0),
				);
			case "volume":
				return markets.sort(
					(a, b) => (b.volume24hr || 0) - (a.volume24hr || 0),
				);
			case "liquidity":
				return markets.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
			default:
				return markets.sort((a, b) => b.relevanceScore - a.relevanceScore);
		}
	}

	/**
	 * Create fallback market data when parsing fails
	 */
	private createFallbackMarket(market: any): Market {
		return {
			id: market.id || "unknown",
			question: market.question || market.title || "Unknown Market",
			description: market.description || "",
			endDate: market.endDate || market.end_date_iso || "",
			outcomes: market.outcomes || ["Yes", "No"],
			eventId: market.eventId || "",
			eventTitle: market.eventTitle || "",
			category: market.category || "",
			conditionId: market.conditionId || market.condition_id || "",
		};
	}

	/**
	 * Get specific market by condition ID (uses CLOB for detailed data)
	 */
	async getMarket(conditionId: string): Promise<Market> {
		await this.ensureInitialized();

		if (!this.clobClient) {
			throw new Error("CLOB client not initialized");
		}

		try {
			const market = await this.clobClient.getMarket(conditionId);
			const rawMarket = marketSchema.parse(market);
			// Convert CLOB API response to Market format
			return {
				id: rawMarket.condition_id,
				question: rawMarket.question,
				description: "",
				endDate: rawMarket.end_date_iso || "",
				outcomes: rawMarket.tokens.map((t) => t.outcome),
				eventId: rawMarket.question_id || "",
				eventTitle: "",
				category: "",
				conditionId: rawMarket.condition_id,
			};
		} catch (error) {
			console.error("Error fetching market:", error);
			throw error;
		}
	}

	/**
	 * Get raw market data including token IDs (uses CLOB)
	 */
	async getRawMarket(conditionId: string): Promise<{
		market: Market;
		tokens: Array<{ token_id: string; outcome: string }>;
	}> {
		await this.ensureInitialized();

		if (!this.clobClient) {
			throw new Error("CLOB client not initialized");
		}

		try {
			const market = await this.clobClient.getMarket(conditionId);
			const rawMarket = marketSchema.parse(market);

			// Convert CLOB API response to Market format
			const processedMarket = {
				id: rawMarket.condition_id,
				question: rawMarket.question,
				description: "",
				endDate: rawMarket.end_date_iso || "",
				outcomes: rawMarket.tokens.map((t) => t.outcome),
				eventId: rawMarket.question_id || "",
				eventTitle: "",
				category: "",
				conditionId: rawMarket.condition_id,
			};

			return {
				market: processedMarket,
				tokens: rawMarket.tokens,
			};
		} catch (error) {
			console.error("Error fetching raw market:", error);
			throw error;
		}
	}

	/**
	 * Get order book for a specific token (uses CLOB)
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
	async checkBuyOrderRequirements(
		orderValue: number,
	): Promise<OrderRequirements> {
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet) {
			return {
				canPlace: false,
				error: "CLOB client or wallet not initialized",
			};
		}

		try {
			// Get USDC balance
			const balance = await this.clobClient.getBalanceAllowance();
			const usdcBalance = Number(balance) || 0; // Assuming balance is in USDC

			// Check if balance is sufficient
			const canPlace = usdcBalance >= orderValue;
			const maxOrderSize = Math.min(usdcBalance, orderValue);

			return {
				canPlace,
				balance: usdcBalance,
				maxOrderSize,
				error: canPlace
					? undefined
					: `Insufficient USDC balance. Balance: ${usdcBalance}, Required: ${orderValue}`,
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
	 * Check token balance for sell orders
	 */
	async checkSellOrderRequirements(
		tokenId: string,
		size: number,
	): Promise<OrderRequirements> {
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet) {
			return {
				canPlace: false,
				error: "CLOB client or wallet not initialized",
			};
		}

		try {
			// Get token balance (placeholder - actual implementation depends on CLOB client API)
			const balance = 0; // await this.clobClient.getTokenBalance(tokenId);
			const tokenBalance = Number(balance);

			// Check if balance is sufficient
			const canPlace = tokenBalance >= size;
			const maxOrderSize = Math.min(tokenBalance, size);

			return {
				canPlace,
				balance: tokenBalance,
				maxOrderSize,
				error: canPlace
					? undefined
					: `Insufficient token balance. Max sell size: ${maxOrderSize}`,
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
	 * Check if trading is available
	 */
	canTrade(): boolean {
		return !!(this.clobClient && this.wallet && this.isInitialized);
	}

	/**
	 * Get wallet address
	 */
	getWalletAddress(): string | null {
		return this.wallet?.address || null;
	}

	/**
	 * Get token holders from Polymarket Data API
	 * This uses the REST API, not CLOB, so works without authentication
	 */
	async getTokenHolders(tokenId: string) {
		try {
			const url = `https://data-api.polymarket.com/holders?token=${tokenId}`;
			console.log(`🔍 Fetching token holders from: ${url}`);

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			console.log(`✅ Fetched token holders data`);

			return data;
		} catch (error) {
			console.error("❌ Error fetching token holders:", error);
			throw error;
		}
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
}
