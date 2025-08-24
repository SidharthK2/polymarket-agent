#!/usr/bin/env node
import { FastMCP } from "fastmcp";
import {
	getMarketsByEventsTool,
	getMarketsTool,
	getMarketTool,
	getOrderBookTool,
	createBuyOrderTool,
	createSellOrderTool,
	createMarketBuyOrderTool,
	createMarketSellOrderTool,
	createGTDOrderTool,
	getUserOrdersTool,
	getUserPositionsTool,
	searchMarketsTool,
	searchMarketsByInterestsTool,
	checkBuyOrderTool,
	checkSellOrderTool,
	selectMarketTool,
	debugServiceLogicTool,
} from "./tools/polymarket.js";

/**
 * Initializes and starts the Polymarket MCP (Model Context Protocol) Server.
 *
 * This function sets up a FastMCP server that provides Polymarket-related tools
 * through the MCP protocol. The server communicates via stdio transport,
 * making it suitable for integration with MCP clients and AI agents.
 *
 * Available tools:
 * - SEARCH_POLYMARKET_MARKETS: Search markets by interests/keywords
 * - GET_POLYMARKET_EVENTS: Get markets organized by events (better structure)
 * - GET_POLYMARKET_MARKETS: Fetch available prediction markets
 * - GET_POLYMARKET_MARKET: Get details for a specific market
 * - GET_POLYMARKET_ORDERBOOK: Get order book for a token
 * - CREATE_POLYMARKET_BUY_ORDER: Place GTC buy orders
 * - CREATE_POLYMARKET_SELL_ORDER: Place GTC sell orders
 * - CREATE_POLYMARKET_MARKET_BUY_ORDER: Place FOK market buy orders
 * - CREATE_POLYMARKET_MARKET_SELL_ORDER: Place FOK market sell orders
 * - CREATE_POLYMARKET_GTD_ORDER: Place GTD orders with expiration
 * - GET_POLYMARKET_USER_ORDERS: Get user's current orders
 * - GET_POLYMARKET_POSITIONS: Get user's portfolio positions and P&L
 * - CHECK_BUY_ORDER_REQUIREMENTS: Validate buy order before placement
 * - CHECK_SELL_ORDER_REQUIREMENTS: Validate sell order before placement
 */
async function main() {
	console.log("Initializing Polymarket MCP Server...");

	const server = new FastMCP({
		name: "Polymarket MCP Server",
		version: "0.0.1",
	});

	// Add all Polymarket tools
	server.addTool(searchMarketsTool);
	server.addTool(searchMarketsByInterestsTool);
	server.addTool(getMarketsByEventsTool);
	server.addTool(getMarketsTool);
	server.addTool(getMarketTool);
	server.addTool(getOrderBookTool);
	server.addTool(createBuyOrderTool);
	server.addTool(createSellOrderTool);
	server.addTool(createMarketBuyOrderTool);
	server.addTool(createMarketSellOrderTool);
	server.addTool(createGTDOrderTool);
	server.addTool(getUserOrdersTool);
	server.addTool(getUserPositionsTool);
	server.addTool(checkBuyOrderTool);
	server.addTool(checkSellOrderTool);
	server.addTool(selectMarketTool);
	server.addTool(debugServiceLogicTool);

	try {
		await server.start({
			transportType: "stdio",
		});
	} catch (error) {
		console.error("❌ Failed to start Polymarket MCP Server:", error);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(
		"❌ An unexpected error occurred in the Polymarket MCP Server:",
		error,
	);
	process.exit(1);
});
