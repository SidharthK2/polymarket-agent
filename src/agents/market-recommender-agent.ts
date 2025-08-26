import { AgentBuilder, type BaseTool } from "@iqai/adk";
import { env } from "../env";

export async function createMarketRecommenderAgent(
	polymarketTools: BaseTool[],
) {
	const { runner } = await AgentBuilder.create("market_recommender")
		.withDescription(
			"Finds Polymarket markets - now works great for niche topics!",
		)
		.withModel(env.LLM_MODEL)
		.withInstruction(`
			You are a Market Recommender for Polymarket.

			YOUR JOB: Find relevant markets using the available tools.

			TOOLS AVAILABLE:
			- SEARCH_POLYMARKET_MARKETS: Great for specific topics (crypto, ai, gaming, tech, sports)
			- SEARCH_POLYMARKET_BY_INTERESTS: Good for multiple interests
			- GET_POLYMARKET_MARKETS: Popular markets

			STRATEGY:
			1. For specific topics → Use SEARCH_POLYMARKET_MARKETS
			2. For multiple interests → Use SEARCH_POLYMARKET_BY_INTERESTS  
			3. For general browsing → Use GET_POLYMARKET_MARKETS

			IMPORTANT:
			- Always ensure markets have conditionIds for trading
			- Focus on markets with good volume/liquidity
			- Be clear about why markets are relevant

			KEEP RESPONSES CLEAN: Don't over-explain, just show the good markets.
		`)
		.withTools(...polymarketTools)
		.build();

	const wrappedRunner = {
		findMarkets: async (request: any): Promise<any> => {
			try {
				let searchMessage = `Find markets for: "${request.query}".`;

				if (request.userProfile?.interests?.length) {
					searchMessage += ` User interests: ${request.userProfile.interests.join(", ")}.`;
					searchMessage += " Use SEARCH_POLYMARKET_BY_INTERESTS.";
				} else {
					searchMessage += " Use SEARCH_POLYMARKET_MARKETS.";
				}

				searchMessage += ` Limit: ${request.limit || 8}.`;

				const response = await runner.ask(searchMessage);
				const markets = parseMarketsFromResponse(response);

				return {
					success: markets.length > 0,
					markets,
					searchQuery: request.query,
					totalFound: markets.length,
					displayMessage: response,
				};
			} catch (error) {
				return {
					success: false,
					markets: [],
					searchQuery: request.query,
					totalFound: 0,
					error: error instanceof Error ? error.message : "Unknown error",
					displayMessage: "❌ Search failed. Try different keywords.",
				};
			}
		},

		ask: async (message: string): Promise<string> => {
			return await runner.ask(message);
		},

		runAsync: async function* (params: any) {
			const result = await runner.ask(params.newMessage?.content || "");
			yield { type: "response", content: result };
		},
	};

	return wrappedRunner;
}

function parseMarketsFromResponse(response: string): any[] {
	const markets: any[] = [];

	// Look for numbered market entries
	const lines = response.split("\n");
	let currentMarket: any = {};

	for (const line of lines) {
		// New market (numbered entry)
		if (/^\d+\.\s+/.test(line)) {
			if (currentMarket.question) {
				markets.push(currentMarket);
			}
			currentMarket = {
				question: line.replace(/^\d+\.\s+/, "").trim(),
				outcomes: ["Yes", "No"],
			};
		}

		// Extract IDs
		if (line.includes("Market ID:")) {
			const idMatch = line.match(/Market ID:\s*([^\s]+)/);
			if (idMatch) currentMarket.id = idMatch[1];
		}

		if (line.includes("Condition ID:")) {
			const conditionMatch = line.match(/Condition ID:\s*([^\s]+)/);
			if (conditionMatch) currentMarket.conditionId = conditionMatch[1];
		}

		// Extract other fields
		if (line.includes("Volume:")) {
			const volMatch = line.match(/Volume:\s*\$?([\d,]+)/);
			if (volMatch)
				currentMarket.volume24hr = Number.parseInt(
					volMatch[1].replace(/,/g, ""),
				);
		}
	}

	// Add last market
	if (currentMarket.question) {
		markets.push(currentMarket);
	}

	return markets.filter((m) => m.conditionId?.startsWith("0x"));
}
