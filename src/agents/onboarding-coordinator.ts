import {
	AgentBuilder,
	createTool,
	createDatabaseSessionService,
} from "@iqai/adk";
import { z } from "zod";
import { env } from "../env";
import { getSqliteConnectionString } from "..";

function parseMarketsFromResponse(response: string): Market[] {
	const markets: Market[] = [];
	console.log("🔍 Parsing response for markets...");

	const lines = response.split("\n");
	let currentMarket: Market | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		if (/^\d+\.\s+\*\*(.+?)\*\*/.test(line) && !line.includes("*   ")) {
			if (currentMarket?.conditionId && currentMarket?.question) {
				markets.push(currentMarket);
				console.log(
					`✅ Added market: ${currentMarket.question.substring(0, 30)}...`,
				);
			}

			// Start new market
			const questionMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*/);
			currentMarket = {
				question: questionMatch?.[1]?.trim() || "",
				outcomes: ["Yes", "No"],
				id: "",
				conditionId: "",
			};
			console.log(`🆕 Started parsing: ${currentMarket.question}`);
		}

		// Parse bullet point lines starting with "*"
		if (line.startsWith("*") && currentMarket) {
			// Volume line: "*   Volume: $98,649.223 | Liquidity: $2,490.914"
			if (line.includes("Volume:")) {
				const volumeMatch = line.match(/Volume:\s*\$?([\d,]+(?:\.\d+)?)/);
				if (volumeMatch) {
					currentMarket.volume24hr = Number.parseFloat(
						volumeMatch[1].replace(/,/g, ""),
					);
					console.log(`💰 Found Volume: ${currentMarket.volume24hr}`);
				}
			}

			// End date line: "*   Ends: 9/30/2025"
			if (line.includes("Ends:")) {
				const endMatch = line.match(/Ends:\s*([^\n]+)/);
				if (endMatch) {
					currentMarket.endDate = endMatch[1].trim();
					console.log(`📅 Found End Date: ${currentMarket.endDate}`);
				}
			}

			// Condition ID line: "*   Condition ID: `0x...`"
			if (line.includes("Condition ID:")) {
				// Handle backticks: `0x...` or just 0x...
				const conditionMatch = line.match(
					/Condition ID:\s*`?(0x[a-fA-F0-9]+)`?/,
				);
				if (conditionMatch) {
					currentMarket.conditionId = conditionMatch[1];
					console.log(`🔗 Found Condition ID: ${currentMarket.conditionId}`);
				}
			}

			// Market ID line: "*   Market ID: 547685"
			if (line.includes("Market ID:")) {
				const idMatch = line.match(/Market ID:\s*(\d+)/);
				if (idMatch) {
					currentMarket.id = idMatch[1];
					console.log(`📊 Found Market ID: ${currentMarket.id}`);
				}
			}
		}

		// Handle "End date TBD" format
		if (line.includes("End date TBD") && currentMarket) {
			currentMarket.endDate = "TBD";
		}
	}

	// Don't forget the last market
	if (currentMarket?.conditionId && currentMarket?.question) {
		markets.push(currentMarket);
		console.log(
			`✅ Added final market: ${currentMarket.question.substring(0, 30)}...`,
		);
	}

	console.log(`🎯 TOTAL PARSED: ${markets.length} markets`);

	// Debug output with more detail
	markets.forEach((m, i) => {
		console.log(`  ${i + 1}. "${m.question.substring(0, 40)}..."`);
		console.log(`     📊 ID: ${m.id || "N/A"}`);
		console.log(`     🔗 ConditionID: ${m.conditionId}`);
		console.log(`     💰 Volume: ${m.volume24hr || "N/A"}`);
	});

	return markets;
}
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
	tradingAgent: AgentRunner;
}) {
	const profileUserInterestsTool = createTool({
		name: "profile_user_interests",
		description:
			"Discover and analyze user interests for personalized market recommendations",
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

				const interestMatch = response.match(/\[(.*?)\]/);
				if (interestMatch) {
					const interests = interestMatch[1]
						.split(",")
						.map((i: string) => i.trim().replace(/['"]/g, ""))
						.filter((i) => i.length > 0);

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
				const userProfile = (await context.state.get("profile")) as UserProfile;
				const searchQuery =
					args.query || userProfile?.interests?.join(" ") || "popular markets";

				console.log(`🔍 Searching for: "${searchQuery}"`);

				const response = await subAgents.marketRecommender.ask(
					`Find markets for query: "${searchQuery}". User profile: ${JSON.stringify(userProfile)}. Limit: 8. Ensure conditionIds are included.`,
				);

				console.log(
					"📝 Market recommender response:",
					`${response.substring(0, 300)}...`,
				);

				const markets = parseMarketsFromResponse(response);
				console.log("📊 Parsed markets count:", markets.length);
				console.log(
					"📊 First market:",
					markets[0]
						? {
								id: markets[0].id,
								conditionId: markets[0].conditionId,
								question: `${markets[0].question.substring(0, 50)}...`,
							}
						: "No markets parsed",
				);

				// Store in ADK state
				context.state.set("availableMarkets", markets);
				context.state.set("lastSearchQuery", searchQuery);

				console.log(
					"💾 Stored in state - availableMarkets count:",
					markets.length,
				);

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
			conditionId: z.string().describe("Condition ID to select (0x... format)"),
		}),
		fn: async (args: { conditionId: string }, context) => {
			try {
				console.log("🎯 Selecting market with conditionId:", args.conditionId);

				// Get available markets from ADK state
				const availableMarkets = (await context.state.get(
					"availableMarkets",
				)) as Market[];
				console.log(
					"📊 Available markets from state:",
					availableMarkets?.length || 0,
				);

				// Enhanced market finding logic
				let market: Market | undefined;

				if (Array.isArray(availableMarkets) && availableMarkets.length > 0) {
					// Try exact conditionId match
					market = availableMarkets.find(
						(m) => m.conditionId === args.conditionId,
					);

					// Try cleaned conditionId match (remove formatting)
					if (!market) {
						const cleanConditionId = args.conditionId
							.replace(/^\*\*\s*/, "")
							.replace(/\s*\*\*$/, "")
							.trim();
						market = availableMarkets.find(
							(m) => m.conditionId === cleanConditionId,
						);
					}

					// Try finding by ID if conditionId doesn't work
					if (!market) {
						market = availableMarkets.find((m) => m.id === args.conditionId);
					}

					console.log(
						"🔍 Market search result:",
						market ? "Found" : "Not found",
					);
					if (market) {
						console.log("✅ Found market:", {
							id: market.id,
							conditionId: market.conditionId,
							question: `${market.question.substring(0, 50)}...`,
						});
					}
				}

				if (!market) {
					// Fallback: Try to get market directly from trading agent
					console.log("🔄 Fallback: Getting market details directly");

					const directResponse = await subAgents.tradingAgent.ask(
						`Get market details directly using SELECT_MARKET_FOR_TRADING with marketId: ${args.conditionId}. This is a direct lookup, not from stored markets.`,
					);

					// Create a basic market object for state storage
					const fallbackMarket: Market = {
						id: args.conditionId,
						conditionId: args.conditionId,
						question: "Selected Market", // Will be updated by trading agent response
						outcomes: ["Yes", "No"],
					};

					context.state.set("selectedMarket", fallbackMarket);
					console.log("💾 Stored fallback market in selectedMarket state");

					return directResponse;
				}

				// Get detailed trading information
				const response = await subAgents.tradingAgent.ask(
					`Get trading details for market with conditionId: ${market.conditionId}. ` +
						`Market question: "${market.question}". ` +
						`Available outcomes: ${market.outcomes.join(", ")}.`,
				);

				console.log(
					"📈 Trading agent response preview:",
					`${response.substring(0, 200)}...`,
				);

				// Store selected market in ADK state
				context.state.set("selectedMarket", market);
				console.log(
					"✅ Selected market for trading:",
					`${market.question.substring(0, 50)}...`,
				);

				return response;
			} catch (error) {
				console.error("❌ Error in select_market_for_trading:", error);
				return "❌ Failed to prepare market for trading. Please try again or search for markets first.";
			}
		},
	});

	const executeTradingActionTool = createTool({
		name: "execute_trading_action",
		description: "Execute trading operations on the selected market",
		schema: z.object({
			action: z.string().describe("Trading action to perform"),
		}),
		fn: async (args: { action: string }, context) => {
			try {
				console.log("⚡ Executing trading action:", args.action);

				const selectedMarket = (await context.state.get(
					"selectedMarket",
				)) as Market;
				console.log(
					"📊 Selected market from state:",
					selectedMarket ? "Found" : "Not found",
				);

				if (!selectedMarket) {
					return "❌ No market selected. Please choose a market first using a condition ID.";
				}

				if (!selectedMarket.conditionId) {
					return "❌ Selected market not available for trading (missing conditionId).";
				}

				console.log("🎯 Trading on market:", {
					conditionId: selectedMarket.conditionId,
					question: `${selectedMarket.question.substring(0, 50)}...`,
				});

				const response = await subAgents.tradingAgent.ask(
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

	// Enhanced coordinator with better debugging
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
      3. select_market_for_trading - Prepare a specific market for trading (use the CONDITION ID from market results)
      4. execute_trading_action - Handle trading operations

      CRITICAL WORKFLOW:
      1. When users mention interests → Use profile_user_interests
      2. When users want markets → Use recommend_markets first to populate available markets
      3. When users want to select a market → Use select_market_for_trading with the CONDITION ID (0x...)
      4. When users want to trade → Use execute_trading_action

      IMPORTANT NOTES:
      - ALWAYS use the CONDITION ID (starts with 0x) for select_market_for_trading, not the Market ID
      - Markets must be found via recommend_markets first before selection
      - Handle errors gracefully and suggest next steps
      - Keep responses clear and actionable
	  
🚨 CRITICAL FORMATTING RULE:
			 Use only plain text formatting. Never use **bold**, *italic*, backticks, or HTML tags in responses. Use emojis and spacing for visual hierarchy instead.

Example:
BEFORE: "**Market Ready for Trading**\n*Price: $0.65*"
AFTER: "🎯 Market Ready for Trading\nPrice: $0.65"

Apply this rule consistently across all agent instructions to ensure clean Telegram message display.

      DEBUGGING:
      - If market selection fails, recommend searching for markets first
      - If trading fails, suggest checking market selection first
      - Provide helpful error messages with clear next steps

      PERSONALITY: Friendly, helpful, and clear about next steps. Handle errors gracefully.
    `)
		.withTools(
			profileUserInterestsTool,
			recommendMarketsTool,
			selectMarketForTradingTool,
			executeTradingActionTool,
		)
		.withSessionService(
			createDatabaseSessionService(getSqliteConnectionString("agent-database")),
		)
		.build();

	return runner;
}

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
