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
    - "Market ID: 578103"  
    - "market ID: 578156"
    - Any number after "Market ID"

    WHEN YOU SEE A MARKET ID:
    1. IMMEDIATELY use SELECT_MARKET_FOR_TRADING tool with that marketId
    2. DO NOT ask the user to provide the Market ID again
    3. Extract the number and use it directly

    EXAMPLE: If you see "Market ID: 578156" in the conversation:
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
