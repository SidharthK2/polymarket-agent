import { env } from "./env";
import { McpTelegram, McpToolset, createSamplingHandler } from "@iqai/adk";
import type { McpConfig } from "@iqai/adk";
import * as dotenv from "dotenv";
import { createOnboardingCoordinator } from "./agents/onboarding-coordinator";
import { createInterestProfilerAgent } from "./agents/interest-profiler-agent";
import { createMarketRecommenderAgent } from "./agents/market-recommender-agent";
import { createSelectMarketForTradingAgent } from "./agents/trading-agent";
import path from "node:path";
import fs from "node:fs";

dotenv.config();

/**
 * Telegram Bot with AI Agent
 *
 * A Telegram bot powered by ADK that can engage with users in channels and direct messages.
 * Customize the persona and instructions below to create your own unique bot.
 */

async function main() {
	console.log("🤖 Initializing Telegram bot agent...");

	// Validate required environment variables
	if (!env.TELEGRAM_BOT_TOKEN) {
		console.error(
			"❌ TELEGRAM_BOT_TOKEN is required. Please set it in your .env file.",
		);
		process.exit(1);
	}

	// Start CoinGecko MCP server via npx with demo environment using McpToolset
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

	const polymarketConfig: McpConfig = {
		name: "Polymarket MCP Client",
		description: "Client for Polymarket prediction markets via MCP",
		debug: env.DEBUG === "true",
		retryOptions: { maxRetries: 3, initialDelay: 200 },
		cacheConfig: { enabled: true },
		transport: {
			mode: "stdio",
			command: "node",
			args: ["./polymarket-mcp/dist/index.js"],
			env: {
				PATH: env.PATH || "",
				// Polymarket authentication (pass through from main environment)
				PRIVATE_KEY: process.env.PRIVATE_KEY || "",
				CLOB_API_KEY: process.env.CLOB_API_KEY || "",
				CLOB_SECRET: process.env.CLOB_SECRET || "",
				CLOB_PASS_PHRASE: process.env.CLOB_PASS_PHRASE || "",
				CLOB_API_URL: process.env.CLOB_API_URL || "https://clob.polymarket.com",
				POLYGON_RPC_URL:
					process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
			},
		},
	};
	const polymarketToolset = new McpToolset(polymarketConfig);
	const polymarketTools = await polymarketToolset.getTools();

	try {
		// Create specialized agents
		const interestProfiler = await createInterestProfilerAgent();
		const marketRecommender =
			await createMarketRecommenderAgent(polymarketTools);
		const selectMarketForTrading =
			await createSelectMarketForTradingAgent(polymarketTools);

		// Create the main coordinator agent
		const coordinatorRunner = await createOnboardingCoordinator({
			interestProfiler,
			marketRecommender,
			selectMarketForTrading,
		});

		// Create sampling handler for the Telegram MCP
		const samplingHandler = createSamplingHandler(coordinatorRunner.ask);

		// Initialize Telegram toolset
		const telegramToolset = McpTelegram({
			samplingHandler,
			env: {
				TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
				PATH: env.PATH,
			},
		});

		// Get available tools
		await telegramToolset.getTools();

		console.log("✅ Telegram bot agent initialized successfully!");
		console.log("🚀 Bot is now running and ready to receive messages...");

		// Keep the process running
		await keepAlive(cgToolset, polymarketToolset);
	} catch (error) {
		console.error("❌ Failed to initialize Telegram bot:", error);
		process.exit(1);
	}
}

/**
 * Keep the process alive
 */
async function keepAlive(
	cgToolset?: { close: () => Promise<void> },
	polymarketToolset?: { close: () => Promise<void> },
) {
	// Keep the process running
	process.on("SIGINT", () => {
		console.log("\n👋 Shutting down Telegram bot gracefully...");
		Promise.resolve()
			.then(() => Promise.all([cgToolset?.close(), polymarketToolset?.close()]))
			.finally(() => process.exit(0));
	});

	// Prevent the process from exiting
	setInterval(() => {
		// This keeps the event loop active
	}, 1000);
}
function getSqliteConnectionString(dbName: string): string {
	const dbPath = path.join(__dirname, "data", `${dbName}.db`);
	if (!fs.existsSync(path.dirname(dbPath))) {
		fs.mkdirSync(path.dirname(dbPath), { recursive: true });
	}
	return `sqlite://${dbPath}`;
}

main().catch(console.error);
