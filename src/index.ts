import { env } from "./env";
import { McpTelegram, McpToolset, createSamplingHandler } from "@iqai/adk";
import type { LlmRequest, McpConfig } from "@iqai/adk";
import * as dotenv from "dotenv";
import { createOnboardingCoordinator } from "./agents/onboarding-coordinator";
import { createInterestProfilerAgent } from "./agents/interest-profiler-agent";
import { createMarketRecommenderAgent } from "./agents/market-recommender-agent";
import { createTradingAgent } from "./agents/trading-agent";
import path from "node:path";
import fs from "node:fs";

dotenv.config();

/**
 * Telegram Bot with Multi-Agent Polymarket System - REFACTORED
 */

async function main() {
	console.log("🤖 Initializing Polymarket Multi-Agent System...");

	// Validate required environment variables
	if (!env.TELEGRAM_BOT_TOKEN) {
		console.error(
			"❌ TELEGRAM_BOT_TOKEN is required. Please set it in your .env file.",
		);
		process.exit(1);
	}

	try {
		// Initialize CoinGecko MCP server
		const cgConfig: McpConfig = {
			name: "CoinGecko MCP Client",
			description: "Client for CoinGecko API via MCP",
			debug: env.DEBUG === "true",
			retryOptions: { maxRetries: 3, initialDelay: 200 },
			cacheConfig: { enabled: true },
			transport: {
				mode: "stdio",
				command: "npx",
				args: [
					"-y",
					"@coingecko/coingecko-mcp",
					"--client=cursor",
					"--tools=dynamic",
				],
				env: {
					PATH: env.PATH || "",
					COINGECKO_DEMO_API_KEY: env.CG_API_KEY as string,
					COINGECKO_ENVIRONMENT: env.COINGECKO_ENVIRONMENT || "demo",
				},
			},
		};
		const cgToolset = new McpToolset(cgConfig);
		const cgTools = await cgToolset.getTools();

		// Initialize Polymarket MCP server
		const polymarketConfig: McpConfig = {
			name: "Polymarket MCP Client",
			description: "Client for Polymarket prediction markets via MCP",
			debug: env.DEBUG === "true",
			retryOptions: { maxRetries: 3, initialDelay: 200 },
			cacheConfig: { enabled: true },
			transport: {
				mode: "stdio",
				command: "node",
				args: [
					"/Users/sid/repos/side-stuff/intents-agent/polymarket-mcp/dist/index.js",
				],
				env: {
					PATH: env.PATH || "",
					PRIVATE_KEY: process.env.PRIVATE_KEY || "",
					CLOB_API_KEY: process.env.CLOB_API_KEY || "",
					CLOB_SECRET: process.env.CLOB_SECRET || "",
					CLOB_PASS_PHRASE: process.env.CLOB_PASS_PHRASE || "",
					CLOB_API_URL:
						process.env.CLOB_API_URL || "https://clob.polymarket.com",
					POLYGON_RPC_URL:
						process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
				},
			},
		};
		const polymarketToolset = new McpToolset(polymarketConfig);
		const polymarketTools = await polymarketToolset.getTools();

		// Separate tools by responsibility
		const discoveryTools = polymarketTools.filter((tool) =>
			[
				"SEARCH_POLYMARKET_MARKETS",
				"SEARCH_POLYMARKET_BY_INTERESTS",
				"GET_POLYMARKET_MARKETS",
				"GET_POLYMARKET_EVENTS",
			].includes(tool.name),
		);

		const tradingTools = polymarketTools.filter((tool) =>
			[
				"SELECT_MARKET_FOR_TRADING",
				"GET_POLYMARKET_MARKET",
				"GET_POLYMARKET_ORDERBOOK",
				"CREATE_POLYMARKET_BUY_ORDER",
				"CREATE_POLYMARKET_SELL_ORDER",
				"CHECK_BUY_ORDER_REQUIREMENTS",
				"CHECK_SELL_ORDER_REQUIREMENTS",
				"PREPARE_ORDER_FOR_MARKET",
				"GET_POLYMARKET_USER_ORDERS",
				"GET_POLYMARKET_POSITIONS",
			].includes(tool.name),
		);

		// Create specialized agents
		const interestProfiler = await createInterestProfilerAgent();
		const marketRecommender =
			await createMarketRecommenderAgent(discoveryTools);
		const tradingAgent = await createTradingAgent(tradingTools);

		// Create the main coordinator
		const coordinatorRunner = await createOnboardingCoordinator({
			interestProfiler,
			marketRecommender,
			selectMarketForTrading: tradingAgent,
		});

		// Wrap coordinator for Telegram integration
		const telegramSamplingHandler = createSamplingHandler(
			coordinatorRunner.ask,
		);

		// Initialize Telegram toolset
		const telegramToolset = McpTelegram({
			samplingHandler: telegramSamplingHandler,
			env: {
				TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
				PATH: env.PATH,
			},
		});

		await telegramToolset.getTools();

		console.log("🎉 POLYMARKET SYSTEM READY!");
		console.log(
			`📊 Tools loaded: Discovery(${discoveryTools.length}) Trading(${tradingTools.length})`,
		);
		console.log("🚀 Bot is running and ready for messages...");

		// Keep the process running
		await keepAlive(cgToolset, polymarketToolset);
	} catch (error) {
		console.error("❌ Failed to initialize:", error);
		process.exit(1);
	}
}

/**
 * Keep the process alive with graceful shutdown
 */
async function keepAlive(
	cgToolset?: { close: () => Promise<void> },
	polymarketToolset?: { close: () => Promise<void> },
) {
	// Graceful shutdown handler
	process.on("SIGINT", async () => {
		console.log("\n👋 Shutting down gracefully...");

		try {
			await Promise.all([
				cgToolset?.close().catch(() => {}),
				polymarketToolset?.close().catch(() => {}),
			]);
		} catch (error) {
			// Silent cleanup
		} finally {
			process.exit(0);
		}
	});

	// Minimal health check (only if DEBUG is enabled)
	if (env.DEBUG === "true") {
		setInterval(() => {
			const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
			if (memMB > 500) {
				console.warn(`⚠️ Memory: ${memMB}MB`);
			}
		}, 60000); // Check every minute
	}

	// Keep event loop active
	setInterval(() => {}, 5000);
}

/**
 * Utility function for SQLite connections
 */
function getSqliteConnectionString(dbName: string): string {
	const dbPath = path.join(__dirname, "data", `${dbName}.db`);
	if (!fs.existsSync(path.dirname(dbPath))) {
		fs.mkdirSync(path.dirname(dbPath), { recursive: true });
	}
	return `sqlite://${dbPath}`;
}

/**
 * Utility function to validate environment setup
 */
function validateEnvironment(): boolean {
	const required = ["TELEGRAM_BOT_TOKEN", "LLM_MODEL"];

	for (const envVar of required) {
		if (!process.env[envVar]) {
			console.error(`❌ Missing: ${envVar}`);
			return false;
		}
	}
	return true;
}

// Start the application
if (require.main === module) {
	if (!validateEnvironment()) {
		console.error("❌ Environment validation failed.");
		process.exit(1);
	}

	main().catch((error) => {
		console.error("💥 CRITICAL ERROR:");
		console.error(error.message || error);
		console.error(
			"\n📋 Check: env vars, dependencies, network, MCP server build",
		);
		process.exit(1);
	});
}

// Export main function for testing
export { main, validateEnvironment, getSqliteConnectionString };
