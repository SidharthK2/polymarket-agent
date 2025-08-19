import { AgentBuilder, type BaseTool } from "@iqai/adk";
import { env } from "../env";

/**
 * Market Recommender Agent - REFACTORED
 *
 * SINGLE RESPONSIBILITY: Market discovery and relevance scoring ONLY
 * - Uses Gamma API for enhanced market data
 * - Calculates relevance scores based on user interests
 * - NO state management, NO selection logic
 * - Returns markets with conditionIds for trading handoff
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
	conditionId: string; // Required for trading
	volume24hr?: number;
	liquidity?: number;
	relevanceScore?: number;
}

interface UserProfile {
	interests: string[];
	knowledgeLevel: "beginner" | "intermediate" | "advanced";
	riskTolerance: "conservative" | "moderate" | "aggressive";
}

interface MarketRequest {
	query: string;
	userProfile?: UserProfile;
	limit?: number;
	includeConditionIds: boolean;
}

interface MarketResponse {
	success: boolean;
	markets: Market[];
	searchQuery: string;
	totalFound: number;
	error?: string;
	displayMessage: string;
}

export async function createMarketRecommenderAgent(
	polymarketTools: BaseTool[],
) {
	const { runner } = await AgentBuilder.create("market_recommender")
		.withDescription(
			"Finds and recommends Polymarket markets with relevance scoring - PURE DISCOVERY",
		)
		.withModel(env.LLM_MODEL)
		.withInstruction(`
			You are a Market Recommender for Polymarket - PURE DISCOVERY AGENT.

			SINGLE RESPONSIBILITY: Find and score markets based on user interests.

			CORE FUNCTION:
			1. Extract search intent from user query and profile
			2. Use SEARCH_POLYMARKET_BY_INTERESTS for interest-based queries
			3. Use SEARCH_POLYMARKET_MARKETS for general searches
			4. ALWAYS ensure conditionIds are present in results
			5. Score markets by relevance to user interests
			6. Return structured market list with trading-ready data

			SEARCH STRATEGY:
			- User interests provided → SEARCH_POLYMARKET_BY_INTERESTS(interests)
			- General query → SEARCH_POLYMARKET_MARKETS(query)
			- Always use volume-based sorting for quality results
			- Filter out markets without conditionIds (not tradeable)

			CRITICAL REQUIREMENTS:
			- Every returned market MUST have a conditionId for trading
			- Include relevance scores for ranking
			- Provide rich metadata (volume, liquidity, end date)
			- Format clearly for user display

			RESPONSE FORMAT:
			Present top markets with:
			🆔 Market ID: [Id]
			Condition ID: [conditionId]
			**Question:** [market question]
			**End Date:** [end date]
			**Category:** [category]
			**Why relevant:** [brief explanation]

			DATA VALIDATION:
			- Verify conditionId exists (starts with 0x)
			- Check market is active and tradeable
			- Ensure outcomes are clearly defined

			NEVER:
			- Store user state (stateless)
			- Handle market selection
			- Perform trading operations
			- Make assumptions about user preferences without data

			PERSONALITY: Focused market researcher, data-driven, clear about relevance.
		`)
		.withTools(...polymarketTools)
		.build();

	// Wrap runner with structured response handling
	const wrappedRunner = {
		findMarkets: async (request: MarketRequest): Promise<MarketResponse> => {
			try {
				// Construct search message based on request
				let searchMessage = `Find markets for query: "${request.query}".`;

				if (request.userProfile?.interests?.length) {
					searchMessage += ` User interests: ${request.userProfile.interests.join(", ")}.`;
					searchMessage += ` Use SEARCH_POLYMARKET_BY_INTERESTS with interests: ${JSON.stringify(request.userProfile.interests)}.`;
				} else {
					searchMessage += " Use SEARCH_POLYMARKET_MARKETS for general search.";
				}

				searchMessage += ` Limit: ${request.limit || 8}.`;
				searchMessage +=
					" CRITICAL: Only return markets with conditionIds for trading.";
				searchMessage += " Sort by volume for quality results.";

				const response = await runner.ask(searchMessage);

				// Parse markets from response
				const markets = parseMarketsFromResponse(response);

				// Validate all markets have conditionIds
				const tradeableMarkets = markets.filter((m) =>
					m.conditionId?.startsWith("0x"),
				);

				if (tradeableMarkets.length === 0) {
					return {
						success: false,
						markets: [],
						searchQuery: request.query,
						totalFound: 0,
						error: "No tradeable markets found",
						displayMessage:
							"🔍 No tradeable markets found for your search. Try different keywords or broader interests.",
					};
				}

				// Calculate relevance scores
				const scoredMarkets = tradeableMarkets.map((market) => ({
					...market,
					relevanceScore: calculateRelevanceScore(market, request),
				}));

				// Sort by relevance score
				scoredMarkets.sort(
					(a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0),
				);

				return {
					success: true,
					markets: scoredMarkets.slice(0, request.limit || 8),
					searchQuery: request.query,
					totalFound: scoredMarkets.length,
					displayMessage: response,
				};
			} catch (error) {
				return {
					success: false,
					markets: [],
					searchQuery: request.query,
					totalFound: 0,
					error: error instanceof Error ? error.message : "Unknown error",
					displayMessage:
						"❌ Failed to search markets. Please try again with different keywords.",
				};
			}
		},

		// Legacy ask method for backward compatibility
		ask: async (message: string): Promise<string> => {
			return await runner.ask(message);
		},

		// Add runAsync for compatibility
		runAsync: async function* (params: any) {
			const result = await runner.ask(params.newMessage?.content || "");
			yield { type: "response", content: result };
		},
	};

	return wrappedRunner;
}

/**
 * Parse markets from agent response
 * This is a simplified parser - real implementation would be more robust
 */
function parseMarketsFromResponse(response: string): Market[] {
	const markets: Market[] = [];

	// Split by market entries (look for numbered lists)
	const marketBlocks = response.split(/\n\d+\.\s+/);

	for (const block of marketBlocks) {
		if (!block.trim()) continue;

		try {
			// Extract market ID (conditionId)
			const idMatch = block.match(/(?:Market ID|ID):\s*([0-9a-fx]+)/i);
			const conditionId = idMatch?.[1]?.trim() || "";

			// Extract question
			const questionMatch = block.match(/(?:Question):\s*([^\n]+)/i);
			const question = questionMatch?.[1]?.trim() || "";

			// Extract end date
			const endDateMatch = block.match(/(?:End Date|Ends):\s*([^\n]+)/i);
			const endDate = endDateMatch?.[1]?.trim() || "";

			// Extract category
			const categoryMatch = block.match(/(?:Category):\s*([^\n]+)/i);
			const category = categoryMatch?.[1]?.trim() || "";

			// Extract volume
			const volumeMatch = block.match(/Volume:\s*\$?([\d,]+)/i);
			const volume24hr = volumeMatch
				? Number.parseInt(volumeMatch[1].replace(/,/g, ""))
				: 0;

			if (conditionId && question) {
				markets.push({
					id: conditionId,
					question,
					conditionId,
					outcomes: ["Yes", "No"], // Default - could be parsed more sophisticatedly
					endDate,
					category,
					volume24hr,
				});
			}
		} catch (parseError) {
			console.warn("Failed to parse market block:", block.substring(0, 100));
		}
	}

	return markets;
}

/**
 * Calculate relevance score based on user query and profile
 */
function calculateRelevanceScore(
	market: Market,
	request: MarketRequest,
): number {
	let score = 0;
	const queryLower = request.query.toLowerCase();
	const questionLower = market.question.toLowerCase();

	// Exact query match in question
	if (questionLower.includes(queryLower)) {
		score += 0.8;
	}

	// Word overlap between query and question
	const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 3);
	const questionWords = questionLower.split(/\s+/);
	const matchingWords = queryWords.filter((word) =>
		questionWords.some((qw) => qw.includes(word)),
	);
	score += (matchingWords.length / Math.max(queryWords.length, 1)) * 0.5;

	// User interest matching
	if (request.userProfile?.interests) {
		for (const interest of request.userProfile.interests) {
			if (questionLower.includes(interest.toLowerCase())) {
				score += 0.4;
			}
		}
	}

	// Category preference (basic implementation)
	if (
		request.userProfile?.interests?.some((interest) =>
			market.category?.toLowerCase().includes(interest.toLowerCase()),
		)
	) {
		score += 0.3;
	}

	// Volume bonus (higher volume = more reliable)
	if (market.volume24hr && market.volume24hr > 1000) {
		score += 0.1;
	}

	// Risk tolerance adjustment
	if (
		request.userProfile?.riskTolerance === "conservative" &&
		market.volume24hr &&
		market.volume24hr > 5000
	) {
		score += 0.2; // Prefer high-volume markets for conservative users
	}

	return Math.min(score, 1.0); // Cap at 1.0
}
