import { AgentBuilder, type BaseTool } from "@iqai/adk";
import { env } from "../env";

/**
 * Trading Agent - REFACTORED
 *
 * SINGLE RESPONSIBILITY: Trading operations and market analysis ONLY
 * - Uses CLOB API for trading operations
 * - Validates trading requirements
 * - NO market discovery, NO user state management
 * - Requires explicit conditionId and context for all operations
 */

interface TradingRequest {
	conditionId: string;
	marketQuestion: string;
	action: string;
	availableOutcomes: string[];
}

interface TradingResponse {
	success: boolean;
	data?: any;
	error?: string;
	displayMessage: string;
	suggestedActions?: string[];
}

interface OrderRequest {
	conditionId: string;
	outcome: string;
	price: number;
	size: number;
	side: "BUY" | "SELL";
}

export async function createSelectMarketForTradingAgent(tools: BaseTool[]) {
	return createTradingAgent(tools);
}

export async function createTradingAgent(tools: BaseTool[]) {
	const { runner } = await AgentBuilder.create("trading_agent")
		.withDescription(
			"Executes trading operations on Polymarket with explicit context validation",
		)
		.withModel(env.LLM_MODEL)
		.withInstruction(`
			You are a Trading Specialist for Polymarket - PURE TRADING OPERATIONS.

			SINGLE RESPONSIBILITY: Execute trading operations with explicit context.

			CORE PRINCIPLES:
			1. NEVER guess market context - require explicit conditionId
			2. Validate all trading requirements before execution
			3. Provide clear error messages with actionable suggestions
			4. Use structured responses for programmatic handling

			AVAILABLE OPERATIONS:
			- SELECT_MARKET_FOR_TRADING: Get detailed market info by conditionId
			- GET_POLYMARKET_ORDERBOOK: Check current prices
			- PREPARE_ORDER_FOR_MARKET: Calculate order requirements
			- CHECK_BUY_ORDER_REQUIREMENTS: Validate balance for buy orders
			- CHECK_SELL_ORDER_REQUIREMENTS: Validate tokens for sell orders
			- CREATE_POLYMARKET_BUY_ORDER: Execute buy orders
			- CREATE_POLYMARKET_SELL_ORDER: Execute sell orders

			OPERATION FLOW:
			1. Validate conditionId is provided
			2. Get market details with SELECT_MARKET_FOR_TRADING
			3. For price checks: Use GET_POLYMARKET_ORDERBOOK
			4. For orders: Use PREPARE_ORDER_FOR_MARKET first, then CREATE_*_ORDER
			5. Always validate requirements before placing orders

			CONTEXT REQUIREMENTS:
			- conditionId: Required for all operations (0x... format)
			- marketQuestion: For user confirmation
			- availableOutcomes: Known valid trading outcomes
			- action: Specific trading intent

			ERROR HANDLING:
			- Missing conditionId → Request market selection
			- Invalid outcome → List available outcomes
			- Insufficient balance → Show current balance and max order size
			- Market not found → Suggest market search

			RESPONSE FORMAT:
			Always return structured data:
			{
				success: boolean,
				data?: any,
				error?: string,
				displayMessage: string,
				suggestedActions?: string[]
			}

			PERSONALITY: Professional trader, precise, safety-focused, clear about requirements.
		`)
		.withTools(...tools)
		.build();

	// Wrap runner with structured trading operations
	const wrappedRunner = {
		executeAction: async (
			request: TradingRequest,
		): Promise<TradingResponse> => {
			try {
				// Validate required context
				const validation = validateTradingRequest(request);
				if (!validation.valid) {
					return {
						success: false,
						error: validation.error,
						displayMessage: `❌ ${validation.error}`,
						suggestedActions: validation.suggestedActions,
					};
				}

				// Route to appropriate trading operation
				if (request.action.toLowerCase().includes("price")) {
					return await handlePriceCheck(request, runner);
				}

				if (request.action.toLowerCase().includes("buy")) {
					return await handleBuyOrder(request, runner);
				}

				if (request.action.toLowerCase().includes("sell")) {
					return await handleSellOrder(request, runner);
				}

				if (request.action.toLowerCase().includes("balance")) {
					return await handleBalanceCheck(request, runner);
				}

				// Default: Show trading options
				return await showTradingOptions(request, runner);
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
					displayMessage: "❌ Trading operation failed. Please try again.",
					suggestedActions: ["check_prices", "select_different_market"],
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
 * Validate trading request has all required context
 */
function validateTradingRequest(request: TradingRequest): {
	valid: boolean;
	error?: string;
	suggestedActions?: string[];
} {
	if (!request.conditionId) {
		return {
			valid: false,
			error: "No market selected for trading",
			suggestedActions: ["select_market_for_trading", "search_markets"],
		};
	}

	if (!request.conditionId.startsWith("0x")) {
		return {
			valid: false,
			error: "Invalid conditionId format - must start with 0x",
			suggestedActions: ["select_market_for_trading"],
		};
	}

	if (!request.availableOutcomes || request.availableOutcomes.length === 0) {
		return {
			valid: false,
			error: "No trading outcomes available",
			suggestedActions: ["select_market_for_trading"],
		};
	}

	return { valid: true };
}

/**
 * Handle price checking operations
 */
async function handlePriceCheck(
	request: TradingRequest,
	runner: any,
): Promise<TradingResponse> {
	try {
		const message =
			`Check current prices for market with conditionId: ${request.conditionId}. ` +
			`Use GET_POLYMARKET_ORDERBOOK for each outcome: ${request.availableOutcomes.join(", ")}.`;

		const response = await runner.ask(message);

		return {
			success: true,
			data: { conditionId: request.conditionId, priceCheck: true },
			displayMessage: response,
			suggestedActions: ["prepare_buy_order", "prepare_sell_order"],
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Price check failed",
			displayMessage:
				"❌ Failed to get current prices. Market may not be active.",
			suggestedActions: ["select_different_market"],
		};
	}
}

/**
 * Handle buy order operations
 */
async function handleBuyOrder(
	request: TradingRequest,
	runner: any,
): Promise<TradingResponse> {
	try {
		// Parse buy order details from action
		const orderDetails = parseBuyOrderAction(
			request.action,
			request.availableOutcomes,
		);

		if (!orderDetails.valid) {
			return {
				success: false,
				error: orderDetails.error,
				displayMessage: `❌ ${orderDetails.error}\n\nAvailable outcomes: ${request.availableOutcomes.join(", ")}`,
				suggestedActions: ["check_prices", "specify_complete_order"],
			};
		}

		// Prepare order first
		const prepareMessage = `Prepare buy order for market ${request.conditionId}. Use PREPARE_ORDER_FOR_MARKET with: marketId: ${request.conditionId}, side: BUY, outcome: ${orderDetails.outcome}, price: ${orderDetails.price}, size: ${orderDetails.size}.`;

		const response = await runner.ask(prepareMessage);

		return {
			success: true,
			data: {
				conditionId: request.conditionId,
				orderType: "buy",
				orderDetails,
			},
			displayMessage: response,
			suggestedActions: ["execute_buy_order", "check_balance", "modify_order"],
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Buy order preparation failed",
			displayMessage:
				"❌ Failed to prepare buy order. Please check your order details.",
			suggestedActions: ["check_prices", "check_balance"],
		};
	}
}

/**
 * Handle sell order operations
 */
async function handleSellOrder(
	request: TradingRequest,
	runner: any,
): Promise<TradingResponse> {
	try {
		// Parse sell order details from action
		const orderDetails = parseSellOrderAction(
			request.action,
			request.availableOutcomes,
		);

		if (!orderDetails.valid) {
			return {
				success: false,
				error: orderDetails.error,
				displayMessage: `❌ ${orderDetails.error}\n\nAvailable outcomes: ${request.availableOutcomes.join(", ")}`,
				suggestedActions: ["check_positions", "specify_complete_order"],
			};
		}

		// Prepare sell order
		const prepareMessage = `Prepare sell order for market ${request.conditionId}. Use PREPARE_ORDER_FOR_MARKET with: marketId: ${request.conditionId}, side: SELL, outcome: ${orderDetails.outcome}, price: ${orderDetails.price}, size: ${orderDetails.size}.`;

		const response = await runner.ask(prepareMessage);

		return {
			success: true,
			data: {
				conditionId: request.conditionId,
				orderType: "sell",
				orderDetails,
			},
			displayMessage: response,
			suggestedActions: [
				"execute_sell_order",
				"check_positions",
				"modify_order",
			],
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Sell order preparation failed",
			displayMessage:
				"❌ Failed to prepare sell order. Please check your token balance.",
			suggestedActions: ["check_positions", "check_prices"],
		};
	}
}

/**
 * Handle balance checking operations
 */
async function handleBalanceCheck(
	request: TradingRequest,
	runner: any,
): Promise<TradingResponse> {
	try {
		const message = `Check trading balance and requirements for market ${request.conditionId}. Use CHECK_BUY_ORDER_REQUIREMENTS for USDC balance and GET_POLYMARKET_POSITIONS for token holdings.`;

		const response = await runner.ask(message);

		return {
			success: true,
			data: { conditionId: request.conditionId, balanceCheck: true },
			displayMessage: response,
			suggestedActions: ["prepare_buy_order", "prepare_sell_order"],
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Balance check failed",
			displayMessage: "❌ Failed to check balance. Please try again.",
			suggestedActions: ["retry_balance_check"],
		};
	}
}

/**
 * Show available trading options for a market
 */
async function showTradingOptions(
	request: TradingRequest,
	runner: any,
): Promise<TradingResponse> {
	try {
		const message = `Show trading options for market: "${request.marketQuestion}" with conditionId: ${request.conditionId}. Use SELECT_MARKET_FOR_TRADING to get current prices and trading details.`;

		const response = await runner.ask(message);

		return {
			success: true,
			data: {
				conditionId: request.conditionId,
				tradingOptions: true,
				availableOutcomes: request.availableOutcomes,
			},
			displayMessage: response,
			suggestedActions: [
				"check_prices",
				"prepare_buy_order",
				"prepare_sell_order",
				"check_balance",
			],
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to load trading options",
			displayMessage:
				"❌ Failed to load trading options. Market may not be available.",
			suggestedActions: ["select_different_market"],
		};
	}
}

/**
 * Parse buy order details from user action
 */
function parseBuyOrderAction(
	action: string,
	availableOutcomes: string[],
): {
	valid: boolean;
	outcome?: string;
	price?: number;
	size?: number;
	error?: string;
} {
	const actionLower = action.toLowerCase();

	// Extract outcome
	const outcome = availableOutcomes.find((outcome) =>
		actionLower.includes(outcome.toLowerCase()),
	);

	if (!outcome) {
		return {
			valid: false,
			error: "No valid outcome specified in buy order",
		};
	}

	// Extract size (number of shares)
	const sizeMatch = action.match(/(\d+)\s*(?:shares?|units?)?/i);
	const size = sizeMatch ? Number.parseInt(sizeMatch[1]) : undefined;

	// Extract price
	const priceMatch = action.match(/(?:at\s*)?(?:\$)?(\d*\.?\d+)/);
	const price = priceMatch ? Number.parseFloat(priceMatch[1]) : undefined;

	// For basic "buy yes 50" format, use defaults
	if (!price && size) {
		return {
			valid: true,
			outcome,
			size,
			price: 0.5, // Default middle price
		};
	}

	if (!size) {
		return {
			valid: false,
			error: "No order size specified (number of shares)",
		};
	}

	return {
		valid: true,
		outcome,
		price: price || 0.5,
		size,
	};
}

/**
 * Parse sell order details from user action
 */
function parseSellOrderAction(
	action: string,
	availableOutcomes: string[],
): {
	valid: boolean;
	outcome?: string;
	price?: number;
	size?: number;
	error?: string;
} {
	const actionLower = action.toLowerCase();

	// Extract outcome
	const outcome = availableOutcomes.find((outcome) =>
		actionLower.includes(outcome.toLowerCase()),
	);

	if (!outcome) {
		return {
			valid: false,
			error: "No valid outcome specified in sell order",
		};
	}

	// Extract size (number of shares)
	const sizeMatch = action.match(/(\d+)\s*(?:shares?|units?)?/i);
	const size = sizeMatch ? Number.parseInt(sizeMatch[1]) : undefined;

	// Extract price
	const priceMatch = action.match(/(?:at\s*)?(?:\$)?(\d*\.?\d+)/);
	const price = priceMatch ? Number.parseFloat(priceMatch[1]) : undefined;

	if (!size) {
		return {
			valid: false,
			error: "No order size specified (number of shares to sell)",
		};
	}

	return {
		valid: true,
		outcome,
		price: price || 0.5, // Default middle price
		size,
	};
}
