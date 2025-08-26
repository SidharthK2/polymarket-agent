import { env } from "../env";
import { AgentBuilder, type BaseTool } from "@iqai/adk";

export async function createTradingAgent(tools: BaseTool[]) {
	const { runner } = await AgentBuilder.create("trading_agent")
		.withDescription(
			"Executes trading operations on Polymarket - COMPLETES ALL ACTIONS",
		)
		.withModel(env.LLM_MODEL)
		.withInstruction(`
		You are a Trading Specialist for Polymarket. 
  
		CRITICAL MANDATE: COMPLETE ALL TRADING ACTIONS - DO NOT STOP HALFWAY!
  
		COMPLETE BUY ORDER FLOW (MUST EXECUTE ALL STEPS):
		1. Parse user request: outcome (Yes/No), quantity, price
		2. Call SELECT_MARKET_FOR_TRADING to get token IDs  
		3. Call CHECK_BUY_ORDER_REQUIREMENTS with orderValue
		4. IF balance check passes → IMMEDIATELY call CREATE_POLYMARKET_BUY_ORDER
		5. IF balance check fails → Show exact balance and suggest smaller order
  
		COMPLETE SELL ORDER FLOW (MUST EXECUTE ALL STEPS):
		1. Parse user request: outcome, quantity, price
		2. Call SELECT_MARKET_FOR_TRADING to get token IDs
		3. Call CHECK_SELL_ORDER_REQUIREMENTS  
		4. IF position check passes → IMMEDIATELY call CREATE_POLYMARKET_SELL_ORDER
		5. IF no positions → Show current positions and explain
  
		CRITICAL RULES:
		- NEVER stop after balance/position checks - ALWAYS proceed to order creation if checks pass
		- NEVER give generic "API credential" errors - use actual tool results
		- ALWAYS show specific error messages from tool responses
		- COMPLETE the full trading flow in one response
  
		PARSING EXAMPLES:
		- "buy 10 shares of Yes at 0.3" → outcome: "Yes", size: 10, price: 0.3
		- "buy 10 yes" → outcome: "Yes", size: 10, price: ask user or use current market price
		- "sell 5 no at 0.7" → outcome: "No", size: 5, price: 0.7

		FORMATTING RULE:
		Use only plain text formatting. Never use **bold**, *italic*, backticks, or HTML tags in responses. Use emojis and spacing for visual hierarchy instead.

		Example:
		BEFORE: "**Market Ready for Trading**\n*Price: $0.65*"
		AFTER: "🎯 Market Ready for Trading\nPrice: $0.65"
  
		ERROR HANDLING:
		- If balance insufficient → Show exact balance and max possible order
		- If no positions to sell → Show current positions  
		- If market not tradeable → Explain why and suggest alternatives
		- If price invalid → Show current market prices and valid range
  
		MANDATORY: Always use tool results to give specific, helpful responses. Never use generic error messages.
	  `)
		.withTools(...tools)
		.build();

	return {
		executeAction: async (request: any): Promise<any> => {
			try {
				// Parse the trading action first
				const action = request.action.toLowerCase();

				let message = "";

				if (action.includes("buy")) {
					// Parse buy order details
					const qtyMatch = request.action.match(/(\d+)\s*(?:shares?)?/i);
					const outcomeMatch = request.action.match(/\b(yes|no)\b/i);
					const priceMatch = request.action.match(
						/(?:at\s*)?(?:\$)?(\d*\.?\d+)/,
					);

					const quantity = qtyMatch ? Number.parseInt(qtyMatch[1]) : 0;
					const outcome = outcomeMatch ? outcomeMatch[1] : "";
					const price = priceMatch ? Number.parseFloat(priceMatch[1]) : 0;

					if (!quantity || !outcome || !price) {
						message = `Parse the buy order "${request.action}" and ask for missing details. Available outcomes: ${request.availableOutcomes.join(", ")}`;
					} else {
						message = `EXECUTE COMPLETE BUY ORDER FLOW:
  
  1. Call SELECT_MARKET_FOR_TRADING with marketId: ${request.conditionId}
  2. Calculate orderValue: ${quantity} × ${price} = ${(quantity * price).toFixed(2)}
  3. Call CHECK_BUY_ORDER_REQUIREMENTS with orderValue: ${(quantity * price).toFixed(2)}
  4. IF balance sufficient → IMMEDIATELY call CREATE_POLYMARKET_BUY_ORDER with:
	 - conditionId: ${request.conditionId}
	 - outcome: ${outcome}
	 - price: ${price}
	 - size: ${quantity}
  
  COMPLETE ALL STEPS NOW! Do not stop after balance check.`;
					}
				} else if (action.includes("sell")) {
					message = `EXECUTE COMPLETE SELL ORDER FLOW for "${request.action}" on market ${request.conditionId}. Parse details and proceed through CHECK_SELL_ORDER_REQUIREMENTS then CREATE_POLYMARKET_SELL_ORDER.`;
				} else {
					message = `Get trading details for market ${request.conditionId}. Use SELECT_MARKET_FOR_TRADING then GET_POLYMARKET_ORDERBOOK to show current prices and trading options.`;
				}

				console.log("🚀 Sending complete trading instruction");
				const response = await runner.ask(message);

				return {
					success: true,
					displayMessage: response,
					data: { conditionId: request.conditionId },
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
					displayMessage: "❌ Trading operation failed.",
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
}
