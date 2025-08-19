// Fixed version of onboarding-coordinator.ts with proper ADK schemas
import { AgentBuilder, createTool } from "@iqai/adk";
import { z } from "zod";
import { env } from "../env";

// Import the parseMarketsFromResponse function
function parseMarketsFromResponse(response: string): Market[] {
	const markets: Market[] = [];

	// Split by market entries (look for 🆔 Market ID: pattern)
	const marketBlocks = response.split(/(?=🆔 Market ID:)/);

	for (const block of marketBlocks) {
		if (!block.trim()) continue;

		try {
			// Extract market ID (conditionId)
			const idMatch = block.match(/(?:Market ID|ID):\s*([0-9a-fx]+)/i);
			const id = idMatch?.[1]?.trim() || "";

			// Extract conditionId (look for IMPORTANT: Condition ID: pattern)
			const conditionIdMatch = block.match(
				/IMPORTANT:\s*Condition ID:\s*([0-9a-fx]+)/i,
			);
			const conditionId = conditionIdMatch?.[1]?.trim() || "";

			// Extract question (look for **Question:** pattern)
			const questionMatch = block.match(/\*\*Question:\*\*\s*([^\n]+)/i);
			const question = questionMatch?.[1]?.trim() || "";

			// Extract end date (look for **End Date:** pattern)
			const endDateMatch = block.match(/\*\*End Date:\*\*\s*([^\n]+)/i);
			const endDate = endDateMatch?.[1]?.trim() || "";

			// Extract category (look for **Category:** pattern)
			const categoryMatch = block.match(/\*\*Category:\*\*\s*([^\n]+)/i);
			const category = categoryMatch?.[1]?.trim() || "";

			// Extract volume
			const volumeMatch = block.match(/Volume:\s*\$?([\d,]+)/i);
			const volume24hr = volumeMatch
				? Number.parseInt(volumeMatch[1].replace(/,/g, ""))
				: 0;

			if (conditionId && question) {
				markets.push({
					id: id,
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
 * FIXED: ADK createTool Implementation with Proper Schemas
 *
 * The build errors demonstrate a critical framework tradeoff:
 * - ADK requires explicit Zod schemas for typed tool parameters
 * - This provides runtime type safety but increases verbosity
 * - Breaking changes between framework versions impact developer experience
 */

type AgentRunner = {
	ask: (message: string) => Promise<string>;
};

interface Market {
	id: string;
	question: string;
	description?: string;
	endDate?: string;
	outcomes: string[];
	eventId?: string;
	eventTitle?: string;
	category?: string;
	conditionId: string;
	volume24hr?: number;
	liquidity?: number;
	relevanceScore?: number;
}

interface UserProfile {
	interests: string[];
	knowledgeLevel: "beginner" | "intermediate" | "advanced";
	riskTolerance: "conservative" | "moderate" | "aggressive";
}

export async function createOnboardingCoordinator(subAgents: {
	interestProfiler: AgentRunner;
	marketRecommender: AgentRunner;
	selectMarketForTrading: AgentRunner;
}) {
	// FIXED: Added explicit Zod schema for userInput parameter
	const profileUserInterestsTool = createTool({
		name: "profile_user_interests",
		description:
			"Discover and analyze user interests for personalized market recommendations",
		// ✅ REQUIRED: Explicit schema for typed parameters
		schema: z.object({
			userInput: z
				.string()
				.describe("The user's message about their interests"),
		}),
		fn: async (args: { userInput: string }, context) => {
			try {
				const response = await subAgents.interestProfiler.ask(
					`Analyze user interests from: "${args.userInput}". Extract interests as a simple array.`,
				);

				// Parse interests from response
				const interestMatch = response.match(/\[(.*?)\]/);
				if (interestMatch) {
					const interests = interestMatch[1]
						.split(",")
						.map((i: string) => i.trim().replace(/['"]/g, ""))
						.filter((i) => i.length > 0);

					// Store user profile in ADK session state
					const userProfile: UserProfile = {
						interests,
						knowledgeLevel: "intermediate",
						riskTolerance: "moderate",
					};

					context.state.set("profile", userProfile);
					context.state.set("interests", interests);

					console.log("✅ Stored user profile:", userProfile);
				}

				return response;
			} catch (error) {
				console.error("❌ Error in profile_user_interests:", error);
				return "Sorry, I had trouble understanding your interests. Please try again.";
			}
		},
	});

	const recommendMarketsTool = createTool({
		name: "recommend_markets",
		description: "Find and recommend relevant markets based on user interests",
		schema: z.object({
			query: z.string().optional().describe("Search query or topic"),
		}),
		fn: async (args: { query?: string }, context) => {
			try {
				// Get user profile from ADK state
				const userProfile = (await context.state.get("profile")) as UserProfile;
				const searchQuery =
					args.query || userProfile?.interests?.join(" ") || "popular markets";

				// Get the response from market recommender
				const response = await subAgents.marketRecommender.ask(
					`Find markets for query: "${searchQuery}". User profile: ${JSON.stringify(userProfile)}. Limit: 8. Ensure conditionIds are included.`,
				);

				console.log("response", response);

				// Parse markets from the response and store them
				const markets = parseMarketsFromResponse(response);
				console.log("parsed markets", markets);
				context.state.set("availableMarkets", markets);
				context.state.set("lastSearchQuery", searchQuery);

				return response;
			} catch (error) {
				console.error("❌ Error in recommend_markets:", error);
				return "Sorry, I couldn't find any markets right now. Please try again.";
			}
		},
	});

	const selectMarketForTradingTool = createTool({
		name: "select_market_for_trading",
		description: "Select a specific market and prepare it for trading",
		schema: z.object({
			//use refine to clean any leading and trailing spaces and double stars
			conditionId: z
				.string()
				.describe("Condition ID to select")
				.refine((id) => {
					return id
						.trim()
						.replace(/^\*\*\s*/, "")
						.replace(/\s*\*\*$/, "");
				}),
		}),
		fn: async (args: { conditionId: string }, context) => {
			try {
				// Get available markets from ADK state
				const availableMarkets = (await context.state.get(
					"availableMarkets",
				)) as Market[];

				console.debug("args", args);
				console.debug("availableMarkets from state", availableMarkets);

				// Check if markets are available
				if (!Array.isArray(availableMarkets)) {
					return "❌ No markets available. Please search for markets first using 'recommend markets'.";
				}

				const market = availableMarkets.find(
					(m) =>
						m.conditionId === args.conditionId ||
						m.conditionId === `** ${args.conditionId}` ||
						m.conditionId.replace(/^\*\*\s*/, "") === args.conditionId,
				);

				if (!market) {
					return "❌ Market not found. Please search for markets first or select from the recommended list.";
				}

				// Get detailed trading information
				const response = await subAgents.selectMarketForTrading.ask(
					`Get trading details for market with conditionId: ${market.conditionId}. ` +
						`Market question: "${market.question}". ` +
						`Available outcomes: ${market.outcomes.join(", ")}.`,
				);
				console.log(" selected market response", response);

				// Store selected market in ADK state
				context.state.set("selectedMarket", market);

				console.log("✅ Selected market for trading:", market.question);

				return response;
			} catch (error) {
				console.error("❌ Error in select_market_for_trading:", error);
				return "❌ Failed to prepare market for trading. Please try again.";
			}
		},
	});

	/// FIXED: Added explicit Zod schema for action parameter
	const executeTradingActionTool = createTool({
		name: "execute_trading_action",
		description: "Execute trading operations on the selected market",
		// ✅ REQUIRED: Explicit schema for action
		schema: z.object({
			action: z.string().describe("Trading action to perform"),
		}),
		fn: async (args: { action: string }, context) => {
			try {
				// Get selected market from ADK state (not availableMarkets)
				const selectedMarket = (await context.state.get(
					"selectedMarket",
				)) as Market;

				if (!selectedMarket) {
					return "❌ No market selected. Please choose a market first.";
				}

				if (!selectedMarket.conditionId) {
					return "❌ Selected market not available for trading.";
				}

				// Execute trading action
				const response = await subAgents.selectMarketForTrading.ask(
					`Execute trading action: "${args.action}" ` +
						`on market: "${selectedMarket.question}" ` +
						`with conditionId: ${selectedMarket.conditionId}. ` +
						`Available outcomes: ${selectedMarket.outcomes.join(", ")}.`,
				);

				console.log(`✅ Executed trading action: ${args.action}`);

				return response;
			} catch (error) {
				console.error("❌ Error in execute_trading_action:", error);
				return "❌ Trading action failed. Please try again.";
			}
		},
	});

	// Create the main coordinator agent with fixed ADK tools
	const { runner } = await AgentBuilder.create("onboarding_coordinator")
		.withDescription(
			"Guides users through personalized Polymarket onboarding with state management",
		)
		.withModel(env.LLM_MODEL)
		.withInstruction(`
			You are the Onboarding Coordinator for Polymarket.

			YOUR GOAL: Guide users through a smooth onboarding experience using available tools.

			AVAILABLE TOOLS:
			1. profile_user_interests - Analyze what users are interested in
			2. recommend_markets - Find and explore relevant markets based on interests
			3. select_market_for_trading - Prepare a specific market for trading
			4. execute_trading_action - Handle trading operations

			CONVERSATION FLOW:
			1. When users mention interests → Use profile_user_interests
			2. When users want to find or explore markets → Use recommend_markets  
			3. When users select a market → Use select_market_for_trading
			4. When users want to trade → Use execute_trading_action

			CONTEXT AWARENESS:
			- Remember user interests and preferences
			- Keep track of available markets from searches
			- Maintain selected market for trading
			- Provide helpful next steps

			PERSONALITY: 
			- Friendly and helpful guide
			- Educational but not pushy
			- Clear about next steps
			- Handle errors gracefully

			Always use the appropriate tool for each user request and provide clear guidance.
		`)
		.withTools(
			profileUserInterestsTool,
			recommendMarketsTool,
			selectMarketForTradingTool,
			executeTradingActionTool,
		)
		.build();

	return runner;
}
