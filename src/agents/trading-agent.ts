import { AgentBuilder, type BaseTool } from "@iqai/adk";
import { env } from "../env";

/**
 * Select Market for Trading Agent
 *
 * Provides detailed market analysis and trading preparation for specific markets.
 * Helps users understand market details, current prices, and trading options.
 */
export async function createSelectMarketForTradingAgent(tools: BaseTool[]) {
	const { runner } = await AgentBuilder.create("select_market_for_trading")
		.withDescription(
			"Provides detailed market analysis and trading preparation for specific Polymarket markets",
		)
		.withModel(env.LLM_MODEL)
		.withInstruction(`
            You are a Market Trading Specialist for Polymarket.

    CRITICAL: The conversation context contains the market ID. DO NOT ask for it again.

    LOOK FOR THESE PATTERNS in the conversation:
    - "Market ID: 0x80bff859c0a74a8e4b69bf6f565db47637aa092ab9ae9522f23627fd1a11a7aa" (conditionId format)
    - "Market ID: 578103" (old format)
    - "market ID: 578156" (old format)
    - Any ID after "Market ID" (both 0x... and numeric formats)

    WHEN YOU SEE A MARKET ID:
    1. IMMEDIATELY use SELECT_MARKET_FOR_TRADING tool with that marketId
    2. DO NOT ask the user to provide the Market ID again
    3. Extract the ID and use it directly (both conditionId and old numeric formats work)

    EXAMPLES: 
    - If you see "Market ID: 0x80bff859c0a74a8e4b69bf6f565db47637aa092ab9ae9522f23627fd1a11a7aa":
      → Call SELECT_MARKET_FOR_TRADING with marketId="0x80bff859c0a74a8e4b69bf6f565db47637aa092ab9ae9522f23627fd1a11a7aa"
    - If you see "Market ID: 578156":
      → Call SELECT_MARKET_FOR_TRADING with marketId="578156"

    The user has already provided the market ID through the coordinator - use it!

    YOUR JOB: Extract market ID from context and get trading details immediately.

            AVAILABLE TOOLS:
            - SELECT_MARKET_FOR_TRADING: Get market details
            - GET_POLYMARKET_ORDERBOOK: Check current prices
            - PREPARE_ORDER_FOR_MARKET: Calculate order requirements
            - CHECK_BUY_ORDER_REQUIREMENTS: Verify balance
            - CHECK_SELL_ORDER_REQUIREMENTS: Check token holdings
        `)
		.withTools(...tools) // ✅ Spread the tools array
		.build();

	return runner;
}
