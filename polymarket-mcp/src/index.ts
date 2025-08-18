#!/usr/bin/env node
import { FastMCP } from "fastmcp";
import {
	getMarketsByEventsTool,
	getMarketsTool,
	getMarketTool,
	getOrderBookTool,
	createBuyOrderTool,
	createSellOrderTool,
	getUserOrdersTool,
	getUserPositionsTool,
	searchMarketsTool,
	searchMarketsByInterestsTool,
	checkBuyOrderTool,
	checkSellOrderTool,
	selectMarketTool,
	prepareOrderTool,
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
 * - CREATE_POLYMARKET_BUY_ORDER: Place buy orders
 * - CREATE_POLYMARKET_SELL_ORDER: Place sell orders
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
	server.addTool(getUserOrdersTool);
	server.addTool(getUserPositionsTool);
	server.addTool(checkBuyOrderTool);
	server.addTool(checkSellOrderTool);
	server.addTool(selectMarketTool);
	server.addTool(prepareOrderTool);

	try {
		await server.start({
			transportType: "stdio",
		});
		console.log("✅ Polymarket MCP Server started successfully over stdio.");
		console.log("   You can now connect to it using an MCP client.");
		console.log("   Available tools:");
		console.log(
			"   • SEARCH_POLYMARKET_MARKETS - Enhanced search with relevance scoring",
		);
		console.log(
			"   • SEARCH_POLYMARKET_BY_INTERESTS - Smart interest-based matching",
		);
		console.log(
			"   • GET_POLYMARKET_EVENTS - Get markets by events (better organization)",
		);
		console.log("   • GET_POLYMARKET_MARKETS - Fetch available markets");
		console.log("   • GET_POLYMARKET_MARKET - Get market details");
		console.log("   • GET_POLYMARKET_ORDERBOOK - Get order book");
		console.log("   • CREATE_POLYMARKET_BUY_ORDER - Place buy orders");
		console.log("   • CREATE_POLYMARKET_SELL_ORDER - Place sell orders");
		console.log("   • GET_POLYMARKET_USER_ORDERS - Get user orders");
		console.log("   • GET_POLYMARKET_POSITIONS - Get user portfolio & P&L");
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
