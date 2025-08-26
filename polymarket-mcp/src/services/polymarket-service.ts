import {
	type ApiKeyCreds,
	Chain,
	ClobClient,
	Side,
	AssetType,
	OrderType,
} from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { z } from "zod";

// Types and schemas
const tokenSchema = z.object({
	token_id: z.string(),
	outcome: z.string(),
});

const marketSchema = z.object({
	condition_id: z.string(),
	question_id: z.string().optional(),
	question: z.string(),
	description: z.string().optional(),
	tokens: z.array(tokenSchema),
	rewards: z
		.object({
			rates: z.array(z.any()).nullable().optional(),
			min_size: z.number().optional(),
			max_spread: z.number().optional(),
		})
		.optional(),
	minimum_order_size: z.union([z.string(), z.number()]).optional(),
	minimum_tick_size: z.union([z.string(), z.number()]).optional(),
	end_date_iso: z.string().optional(),
	game_start_time: z.union([z.string(), z.null()]).optional(),
	market_slug: z.string().optional(),
	enable_order_book: z.boolean().optional(),
	active: z.boolean().optional(),
	closed: z.boolean().optional(),
	archived: z.boolean().optional(),
	accepting_orders: z.boolean().optional(),
	accepting_order_timestamp: z.string().optional(),
	seconds_delay: z.number().optional(),
	icon: z.string().optional(),
	image: z.string().optional(),
	fpmm: z.string().optional(),
	maker_base_fee: z.number().optional(),
	taker_base_fee: z.number().optional(),
	notifications_enabled: z.boolean().optional(),
	neg_risk: z.boolean().optional(),
	neg_risk_market_id: z.string().optional(),
	neg_risk_request_id: z.string().optional(),
	is_50_50_outcome: z.boolean().optional(),
	tags: z.array(z.string()).optional(),
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
	conditionId: string;
	question: string;
	description?: string;
	endDate?: string;
	outcomes: string[];
	eventId?: string;
	eventTitle?: string;
	category?: string;
	volume24hr?: number;
	liquidity?: number;
	relevanceScore?: number;
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

export class PolymarketService {
	private clobClient: ClobClient | null = null;
	private wallet: Wallet | null = null;
	private isInitialized = false;
	private apiKeyCreds: ApiKeyCreds | null = null;

	private static readonly TAG_MAP = {
		crypto: 21,
		bitcoin: 21,
		ethereum: 21,
		defi: 21,
		btc: 21,
		eth: 21,
		ai: 22,
		gpt: 22,
		chatgpt: 22,
		openai: 22,
		tech: 7,
		technology: 7,
		meta: 7,
		gaming: 3,
		"video games": 3,
		game: 3,
		metacritic: 3,
		gta: 4,
		"grand theft auto": 4,
		soccer: 1,
		football: 1,
		"champions league": 1,
		"premier league": 1,
		nfl: 10,
		"american football": 10,
		basketball: 28,
		nba: 28,
		politics: 2,
		election: 2,
		trump: 2,
		biden: 2,
		emmys: 18,
		awards: 18,
		entertainment: 18,
	} as const;

	constructor() {
		this.initializeClient();
	}

	// Simple tag lookup
	private getTag(query: string): number | null {
		const q = query.toLowerCase();
		for (const [word, tag] of Object.entries(PolymarketService.TAG_MAP)) {
			if (q.includes(word)) {
				console.log(`🏷️ Matched "${word}" → tag ${tag} for query: ${query}`);
				return tag;
			}
		}
		return null;
	}

	private async initializeClient(): Promise<void> {
		try {
			const privateKey = process.env.PRIVATE_KEY;
			if (!privateKey) {
				console.warn("⚠️ No PRIVATE_KEY - read-only mode");
				this.isInitialized = true;
				return;
			}

			console.log("🔑 Initializing wallet...");
			this.wallet = new Wallet(privateKey);
			console.log(`✅ Wallet address: ${this.wallet.address}`);

			const clobApiUrl =
				process.env.CLOB_API_URL || "https://clob.polymarket.com";
			console.log(`🔗 Using CLOB API URL: ${clobApiUrl}`);

			console.log("🔐 Creating/deriving API key...");
			const tempClient = new ClobClient(clobApiUrl, Chain.POLYGON, this.wallet);

			try {
				this.apiKeyCreds = await tempClient.createOrDeriveApiKey();
				console.log("✅ API key created/derived successfully");
				console.log("🔑 API key ID:", this.apiKeyCreds?.key || "N/A");
			} catch (apiKeyError) {
				console.error("❌ Failed to create/derive API key:", apiKeyError);
				console.error("This might be due to:");
				console.error("  - Invalid private key format");
				console.error("  - Network connectivity issues");
				console.error("  - Polymarket API service issues");
				console.error("  - Rate limiting");
				throw apiKeyError;
			}

			console.log("🔗 Creating authenticated CLOB client...");
			this.clobClient = new ClobClient(
				clobApiUrl,
				Chain.POLYGON,
				this.wallet,
				this.apiKeyCreds,
				0, // signatureType: 0 for private key
				"", // funder address (empty for now)
			);

			this.isInitialized = true;
			console.log(
				"✅ Polymarket client fully initialized with API credentials",
			);

			// Test the connection with a simple balance check
			try {
				console.log("🧪 Testing connection with balance check...");
				const testBalance = await this.clobClient.getBalanceAllowance({
					asset_type: AssetType.COLLATERAL,
				});
				console.log(
					`✅ Connection test successful - Balance: $${testBalance.balance}`,
				);
			} catch (balanceError) {
				console.warn(
					"⚠️ Balance check failed (but client is initialized):",
					balanceError instanceof Error ? balanceError.message : balanceError,
				);
				console.warn("💡 This might be normal if the wallet has no balance");
			}
		} catch (error) {
			console.error("❌ Failed to initialize client:", error);
			console.error(
				"Stack:",
				error instanceof Error ? error.stack : "No stack",
			);

			// Set initialization flag to prevent infinite retries
			this.isInitialized = true;

			// Provide helpful error information
			if (error instanceof Error) {
				if (error.message.includes("Could not create api key")) {
					console.error("💡 API Key Creation Failed - Possible solutions:");
					console.error(
						"  1. Check your PRIVATE_KEY format (should be 0x... hex string)",
					);
					console.error(
						"  2. Ensure your wallet has sufficient MATIC for gas fees",
					);
					console.error("  3. Check network connectivity to Polymarket");
					console.error("  4. Try again later (rate limiting)");
				}
			}
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.isInitialized) {
			await this.initializeClient();
		}
		// Wait a bit more to ensure all async operations complete
		if (!this.clobClient || !this.apiKeyCreds) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	// SIMPLIFIED: Get markets from Gamma API
	async getMarketsFromGamma(
		options: {
			limit?: number;
			tag_id?: number;
			volume_num_min?: number;
		} = {},
	): Promise<Record<string, unknown>[]> {
		const { limit = 20, tag_id, volume_num_min } = options;

		try {
			const params = new URLSearchParams({
				limit: limit.toString(),
				order: "volume",
				ascending: "false",
				active: "true",
				closed: "false",
			});

			// Add tag if specified
			if (tag_id) {
				params.append("tag_id", tag_id.toString());
				console.log(`🏷️ Using tag_id=${tag_id}`);
			}

			if (volume_num_min !== undefined) {
				params.append("volume_num_min", volume_num_min.toString());
			}

			const url = `https://gamma-api.polymarket.com/markets?${params}`;
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

			console.log(`✅ Gamma API: ${markets.length} markets`);
			return markets;
		} catch (error) {
			console.error("❌ Gamma API failed:", error);
			return [];
		}
	}

	// ULTRA SIMPLE: Main search method
	async searchMarketsEnhanced(
		query: string,
		options: {
			limit?: number;
			category?: string;
			sortBy?: string;
			minLiquidity?: number;
			minVolume?: number;
		} = {},
	): Promise<Market[]> {
		const { limit = 8 } = options;

		try {
			console.log(`🔍 Searching: "${query}" (limit: ${limit})`);

			// Step 1: Try tag-based search
			const tagId = this.getTag(query);
			if (tagId) {
				const tagResults = await this.getMarketsFromGamma({
					tag_id: tagId,
					limit: limit,
				});

				if (tagResults.length > 0) {
					console.log(`✅ Tag search found ${tagResults.length} markets`);
					return this.convertToMarkets(tagResults).slice(0, limit);
				}
			}

			// Step 2: Fallback to general search with text filter
			console.log(`📊 Fallback search for: "${query}"`);
			const allResults = await this.getMarketsFromGamma({
				limit: limit * 3,
				volume_num_min: 0.1,
			});

			// Simple text filtering
			let filtered = allResults;
			if (query && query.toLowerCase() !== "market") {
				const queryLower = query.toLowerCase();
				filtered = allResults.filter((market) => {
					const text = `${market.question} ${market.description || ""} ${
						Array.isArray((market as any).events) && (market as any).events[0]
							? (market as any).events[0].title || ""
							: ""
					}`.toLowerCase();
				});
			}

			console.log(`✅ Found ${filtered.length} relevant markets`);
			return this.convertToMarkets(filtered).slice(0, limit);
		} catch (error) {
			console.error("❌ Search failed:", error);
			return [];
		}
	}

	// Helper: Convert gamma results to Market format
	private convertToMarkets(results: any[]): Market[] {
		return results
			.map((market) => ({
				id: market.id || "",
				question: market.question || "",
				description: market.description || "",
				conditionId: market.conditionId || "",
				outcomes: Array.isArray(market.outcomes)
					? market.outcomes
					: typeof market.outcomes === "string"
						? JSON.parse(market.outcomes || '["Yes", "No"]')
						: ["Yes", "No"],
				endDate: market.endDate || market.endDateIso || "",
				eventId: market.questionID || market.id || "",
				eventTitle:
					Array.isArray(market.events) && market.events[0]
						? market.events[0].title || ""
						: "",
				category:
					Array.isArray(market.events) && market.events[0]
						? market.events[0].ticker || market.category || ""
						: market.category || "",
				volume24hr: Number(market.volume24hr || 0),
				liquidity: Number(market.liquidity || market.liquidityNum || 0),
			}))
			.filter((m) => m.question); // Filter out empty questions
	}

	// SIMPLIFIED: Search by interests
	async searchMarketsByInterests(
		interests: string[],
		options: {
			limit?: number;
			knowledgeLevel?: "beginner" | "intermediate" | "advanced";
			riskTolerance?: "conservative" | "moderate" | "aggressive";
		} = {},
	): Promise<Market[]> {
		const { limit = 8 } = options;
		const allResults: Market[] = [];

		// Search each interest
		for (const interest of interests) {
			const results = await this.searchMarketsEnhanced(interest, { limit: 5 });
			allResults.push(...results);
		}

		// Remove duplicates and sort by volume
		const unique = Array.from(
			new Map(allResults.map((m) => [m.id, m])).values(),
		);
		unique.sort((a, b) => (b.volume24hr || 0) - (a.volume24hr || 0));

		return unique.slice(0, limit);
	}

	// CLOB API methods (unchanged)
	async getMarkets(limit = 10): Promise<Market[]> {
		await this.ensureInitialized();
		if (!this.clobClient) throw new Error("CLOB client not initialized");

		try {
			const markets = await this.clobClient.getMarkets();
			const marketData = Array.isArray(markets) ? markets : markets?.data || [];

			const processedMarkets: Market[] = [];
			for (const market of marketData.slice(0, limit)) {
				try {
					const rawMarket = marketSchema.parse(market);
					processedMarkets.push({
						id: rawMarket.condition_id,
						conditionId: rawMarket.condition_id,
						question: rawMarket.question,
						endDate: rawMarket.end_date_iso || "",
						outcomes: rawMarket.tokens.map((t) => t.outcome),
						eventId: rawMarket.question_id || "",
						eventTitle: "",
						category: "",
					});
				} catch (error) {
					// Skip invalid markets
				}
			}
			return processedMarkets;
		} catch (error) {
			console.error("❌ Error fetching CLOB markets:", error);
			throw error;
		}
	}

	async getMarketsByEvents(
		limit = 5,
	): Promise<{ [eventTitle: string]: Market[] }> {
		const markets = await this.getMarkets(limit * 3);
		const eventGroups: { [eventTitle: string]: Market[] } = {};

		for (const market of markets) {
			const eventKey = market.eventTitle || market.category || "Other Markets";
			if (!eventGroups[eventKey]) eventGroups[eventKey] = [];
			eventGroups[eventKey].push(market);
		}

		return Object.keys(eventGroups)
			.slice(0, limit)
			.reduce(
				(result, key) => {
					result[key] = eventGroups[key];
					return result;
				},
				{} as { [eventTitle: string]: Market[] },
			);
	}

	async getMarket(conditionId: string): Promise<Market> {
		await this.ensureInitialized();
		if (!this.clobClient) throw new Error("CLOB client not initialized");

		try {
			const market = await this.clobClient.getMarket(conditionId);
			if (market && typeof market === "object" && "error" in market) {
				throw new Error(`Market not found: ${conditionId}`);
			}

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
			console.error("Error fetching market:", error);
			throw error;
		}
	}

	async getRawMarket(conditionId: string): Promise<{
		market: Market;
		tokens: Array<{ token_id: string; outcome: string }>;
	}> {
		await this.ensureInitialized();
		if (!this.clobClient) throw new Error("CLOB client not initialized");

		try {
			const market = await this.clobClient.getMarket(conditionId);
			if (market && typeof market === "object" && "error" in market) {
				throw new Error(`Market not found: ${conditionId}`);
			}

			const rawMarket = marketSchema.parse(market);
			const processedMarket = {
				id: rawMarket.condition_id,
				question: rawMarket.question,
				description: rawMarket.description || "",
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

	async getOrderBook(tokenId: string): Promise<OrderBook> {
		await this.ensureInitialized();
		if (!this.clobClient) throw new Error("CLOB client not initialized");

		try {
			const orderBook = await this.clobClient.getOrderBook(tokenId);
			return orderBookSchema.parse(orderBook);
		} catch (error) {
			console.error("Error fetching order book:", error);
			throw error;
		}
	}

	// Trading methods
	async checkBuyOrderRequirements(
		orderValue: number,
	): Promise<OrderRequirements> {
		if (process.env.DEMO === "true") {
			return {
				canPlace: true,
				balance: 1000,
				allowance: 1000,
				maxOrderSize: 1000,
				error: undefined,
			};
		}
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet || !this.apiKeyCreds) {
			return {
				canPlace: false,
				error:
					"CLOB client, wallet, or API credentials not properly initialized",
			};
		}

		try {
			console.log(`💰 Checking balance for order value: $${orderValue}`);

			const balanceResponse = await this.clobClient.getBalanceAllowance({
				asset_type: AssetType.COLLATERAL,
			});

			const usdcBalance = Number(balanceResponse.balance) || 0;

			// Handle the allowances object structure (the actual response has allowances, not allowance)
			let allowance = 0;
			if (
				"allowances" in balanceResponse &&
				balanceResponse.allowances &&
				typeof balanceResponse.allowances === "object"
			) {
				// Sum up all allowances
				allowance = Object.values(balanceResponse.allowances).reduce(
					(sum: number, val: unknown) => {
						return sum + (Number(val) || 0);
					},
					0,
				);
			} else if ("allowance" in balanceResponse && balanceResponse.allowance) {
				allowance = Number(balanceResponse.allowance) || 0;
			}

			console.log(`✅ Current balance: $${usdcBalance}`);
			console.log(`✅ Current allowance: $${allowance}`);

			const canPlace = usdcBalance >= orderValue && allowance >= orderValue;
			const maxOrderSize = Math.min(usdcBalance, allowance, orderValue);

			return {
				canPlace,
				balance: usdcBalance,
				allowance,
				maxOrderSize,
				error: canPlace
					? undefined
					: `Insufficient balance/allowance: Balance $${usdcBalance}, Allowance $${allowance} < $${orderValue}`,
			};
		} catch (error) {
			console.error("❌ Balance check error:", error);
			return {
				canPlace: false,
				error: `Balance check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	}
	async checkSellOrderRequirements(
		tokenId: string,
		size: number,
	): Promise<OrderRequirements> {
		if (process.env.DEMO === "true") {
			return {
				canPlace: true,
				balance: 1000,
				allowance: 1000,
				maxOrderSize: 1000,
				error: undefined,
			};
		}
		await this.ensureInitialized();
		if (!this.clobClient || !this.wallet) {
			return {
				canPlace: false,
				error: "CLOB client or wallet not initialized",
			};
		}

		// Placeholder - actual implementation depends on CLOB client API
		return {
			canPlace: false,
			error: "Token balance checking not implemented",
		};
	}

	// ✅ MARKET ORDER METHODS (following official docs)
	async createMarketBuyOrder(
		tokenId: string,
		amount: number, // Amount in USD
		options: { skipValidation?: boolean } = {},
	): Promise<OrderResponse> {
		if (process.env.DEMO === "true") {
			await new Promise((resolve) => setTimeout(resolve, 1000)); // Realistic delay
			return {
				success: true,
				orderId: `DEMO_${Date.now()}`,
				message: "Demo order created successfully!",
				orderDetails: {
					tokenId,
					price: 0.5,
					size: amount,
					side: "BUY",
					totalValue: amount,
				},
			};
		}
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet || !this.apiKeyCreds) {
			throw new Error(
				"CLOB client, wallet, or API credentials not properly initialized",
			);
		}

		// Validation
		if (!options.skipValidation) {
			console.log("🔍 Validating market buy order requirements...");
			const requirements = await this.checkBuyOrderRequirements(amount);
			if (!requirements.canPlace) {
				return {
					success: false,
					error: requirements.error || "Order validation failed",
				};
			}
			console.log("✅ Validation passed");
		}

		try {
			console.log(`📝 Creating market buy order: $${amount} USD`);

			const marketOrder = await this.clobClient.createMarketBuyOrder({
				tokenID: tokenId,
				amount, // Amount in USD
				feeRateBps: 0,
				nonce: Date.now(),
				price: 0.5, // Default price, will be filled at market
			});

			console.log("📤 Posting FOK market buy order to exchange...");
			const response = await this.clobClient.postOrder(
				marketOrder,
				OrderType.FOK,
			);

			console.log("✅ Market buy order created successfully!");

			return {
				success: true,
				orderId: response.orderID || response.id,
				message: "Market buy order created successfully",
				orderDetails: {
					tokenId,
					price: 0.5, // Market price
					size: amount, // Amount in USD
					side: "BUY",
					totalValue: amount,
				},
			};
		} catch (error) {
			console.error("❌ Market buy order failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async createMarketSellOrder(
		tokenId: string,
		shares: number, // Number of shares to sell
		options: { skipValidation?: boolean } = {},
	): Promise<OrderResponse> {
		if (process.env.DEMO === "true") {
			return {
				success: true,
				orderId: `DEMO_${Date.now()}`,
				message: "Demo order created successfully!",
			};
		}
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet || !this.apiKeyCreds) {
			throw new Error(
				"CLOB client, wallet, or API credentials not properly initialized",
			);
		}

		try {
			console.log(`📝 Creating market sell order: ${shares} shares`);

			// For market sell orders, we need to use regular createOrder with market price
			// and then post as FOK (Fill or Kill)
			const order = await this.clobClient.createOrder({
				tokenID: tokenId,
				price: 0.01, // Use minimum price for market sell
				side: Side.SELL,
				size: shares,
				feeRateBps: 0,
				nonce: Date.now(),
			});

			console.log("📤 Posting FOK market sell order to exchange...");
			const response = await this.clobClient.postOrder(order, OrderType.FOK);

			console.log("✅ Market sell order created successfully!");

			return {
				success: true,
				orderId: response.orderID || response.id,
				message: "Market sell order created successfully",
				orderDetails: {
					tokenId,
					price: 0.01, // Market price
					size: shares,
					side: "SELL",
					totalValue: shares * 0.01, // Approximate value
				},
			};
		} catch (error) {
			console.error("❌ Market sell order failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	// ✅ GTD ORDER METHOD (Good Till Date)
	async createGTDOrder(
		tokenId: string,
		price: number,
		size: number,
		side: Side,
		expirationMinutes = 1,
		options: { skipValidation?: boolean } = {},
	): Promise<OrderResponse> {
		if (process.env.DEMO === "true") {
			await new Promise((resolve) => setTimeout(resolve, 2000)); // Realistic delay
			return {
				success: true,
				orderId: `DEMO_${Date.now()}`,
				message: "Demo order created successfully!",
				orderDetails: {
					tokenId,
					price,
					size,
					side: side.toString(),
					totalValue: price * size,
				},
			};
		}
		await this.ensureInitialized();

		if (!this.clobClient || !this.wallet || !this.apiKeyCreds) {
			throw new Error(
				"CLOB client, wallet, or API credentials not properly initialized",
			);
		}

		// Validation
		if (!options.skipValidation && side === Side.BUY) {
			console.log("🔍 Validating GTD buy order requirements...");
			const requirements = await this.checkBuyOrderRequirements(price * size);
			if (!requirements.canPlace) {
				return {
					success: false,
					error: requirements.error || "Order validation failed",
				};
			}
			console.log("✅ Validation passed");
		}

		try {
			// Calculate expiration (following docs pattern)
			const oneMinute = 60 * 1000;
			const additionalSeconds = expirationMinutes * 60 * 1000;
			const expiration = Number.parseInt(
				(
					(new Date().getTime() + oneMinute + additionalSeconds) /
					1000
				).toString(),
			);

			console.log(
				`📝 Creating GTD ${side} order: ${size} shares at $${price} (expires in ${expirationMinutes} minutes)`,
			);

			const order = await this.clobClient.createOrder({
				tokenID: tokenId,
				price,
				side,
				size,
				feeRateBps: 0,
				nonce: Date.now(),
				expiration,
			});

			console.log("📤 Posting GTD order to exchange...");
			const response = await this.clobClient.postOrder(order, OrderType.GTD);

			console.log("✅ GTD order created successfully!");

			return {
				success: true,
				orderId: response.orderID || response.id,
				message: `GTD ${side} order created successfully`,
				orderDetails: {
					tokenId,
					price,
					size,
					side: side.toString(),
					totalValue: price * size,
				},
			};
		} catch (error) {
			console.error("❌ GTD order failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async getUserOrders(): Promise<OrderResponse[]> {
		await this.ensureInitialized();
		if (!this.clobClient || !this.wallet) {
			throw new Error("CLOB client or wallet not initialized");
		}
		return []; // Placeholder
	}

	canTrade(): boolean {
		return !!(
			this.clobClient &&
			this.wallet &&
			this.apiKeyCreds &&
			this.isInitialized
		);
	}
	getWalletAddress(): string | null {
		return this.wallet?.address || null;
	}

	// ✅ DEBUG: Get initialization status
	getInitializationStatus(): {
		isInitialized: boolean;
		hasWallet: boolean;
		hasApiKey: boolean;
		hasClient: boolean;
		walletAddress: string | null;
		apiKeyId: string | null;
	} {
		return {
			isInitialized: this.isInitialized,
			hasWallet: !!this.wallet,
			hasApiKey: !!this.apiKeyCreds,
			hasClient: !!this.clobClient,
			walletAddress: this.wallet?.address || null,
			apiKeyId: this.apiKeyCreds?.key || null,
		};
	}

	async getUserPositions(
		userAddress: string,
		options: {
			limit?: number;
			sizeThreshold?: number;
			eventId?: string;
			market?: string;
			redeemable?: boolean;
			sortBy?: string;
			sortDirection?: string;
		} = {},
	) {
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
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		return await response.json();
	}
}
