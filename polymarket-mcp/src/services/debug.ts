#!/usr/bin/env node
/**
 * Polymarket CLOB Client Debug Script
 * Tests initialization logic, balance checking, and trading readiness
 */

import { PolymarketService } from "./polymarket-service";
import { AssetType } from "@polymarket/clob-client";
import * as dotenv from "dotenv";

dotenv.config();

interface DebugResult {
	initialization: {
		success: boolean;
		walletAddress?: string;
		hasApiCredentials: boolean;
		clobClientReady: boolean;
		errors: string[];
	};
	balance: {
		canCheck: boolean;
		balance?: number;
		allowance?: number;
		maxOrderSize?: number;
		error?: string;
	};
	trading: {
		ready: boolean;
		canTrade: boolean;
		requirements?: {
			canPlace: boolean;
			balance?: number;
			maxOrderSize?: number;
			error?: string;
		};
		errors: string[];
	};
	positions: {
		canFetch: boolean;
		count?: number;
		error?: string;
	};
}

class PolymarketDebugger {
	private service: PolymarketService;

	constructor() {
		this.service = new PolymarketService();
	}

	/**
	 * Test CLOB client initialization
	 */
	async testInitialization(): Promise<DebugResult["initialization"]> {
		console.log("\n🔧 TESTING CLOB CLIENT INITIALIZATION");
		console.log("=".repeat(60));

		const result: DebugResult["initialization"] = {
			success: false,
			hasApiCredentials: false,
			clobClientReady: false,
			errors: [],
		};

		try {
			// Wait for initialization to complete
			console.log("⏳ Waiting for service initialization...");
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Check wallet
			const walletAddress = this.service.getWalletAddress();
			if (walletAddress) {
				result.walletAddress = walletAddress;
				console.log(`✅ Wallet Address: ${walletAddress}`);
			} else {
				result.errors.push("No wallet address found");
				console.log("❌ No wallet address");
			}

			// Check trading readiness
			const isReady = this.service.isReadyForTrading();
			const canTrade = this.service.canTrade();

			result.clobClientReady = isReady;
			result.success = isReady && canTrade;

			console.log(`📊 Trading Ready: ${isReady ? "✅" : "❌"}`);
			console.log(`📊 Can Trade: ${canTrade ? "✅" : "❌"}`);

			if (isReady) {
				console.log("✅ CLOB client initialized successfully");
			} else {
				result.errors.push("CLOB client not ready for trading");
				console.log("❌ CLOB client not ready");
			}

			// Check if we have API credentials (this is inferred from readiness)
			result.hasApiCredentials = isReady;

			// Test API key creation specifically
			console.log("\n🔑 Testing API key creation...");
			try {
				const apiKeyCreds = this.service["apiKeyCreds"];
				if (apiKeyCreds) {
					console.log("✅ API credentials found:");
					console.log(`   Key: ${apiKeyCreds.key}`);
					console.log(
						`   Secret: ${apiKeyCreds.secret ? "***" + apiKeyCreds.secret.slice(-4) : "None"}`,
					);
					console.log(
						`   Passphrase: ${apiKeyCreds.passphrase ? "***" + apiKeyCreds.passphrase.slice(-4) : "None"}`,
					);
				} else {
					console.log("❌ No API credentials found");
					result.errors.push("API credentials not available");
				}
			} catch (error) {
				console.log("❌ Could not access API credentials");
				result.errors.push("Could not access API credentials");
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			result.errors.push(`Initialization error: ${errorMsg}`);
			console.log(`❌ Initialization failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Test balance checking functionality
	 */
	async testBalanceChecking(): Promise<DebugResult["balance"]> {
		console.log("\n💰 TESTING BALANCE CHECKING");
		console.log("=".repeat(60));

		const result: DebugResult["balance"] = {
			canCheck: false,
		};

		try {
			// Test both asset types to understand the correct usage
			console.log("\n🔍 Testing balance methods with different asset types...");

			// Test COLLATERAL asset type
			console.log("\n💰 Testing COLLATERAL asset type...");
			try {
				const collateralBalance = await this.service[
					"clobClient"
				]?.getBalanceAllowance({
					asset_type: AssetType.COLLATERAL,
				});
				console.log(
					"📊 COLLATERAL balance response:",
					JSON.stringify(collateralBalance, null, 2),
				);

				if (
					collateralBalance &&
					typeof collateralBalance === "object" &&
					"balance" in collateralBalance
				) {
					console.log("✅ COLLATERAL balance retrieved successfully");
					console.log(`   Balance: $${collateralBalance.balance}`);

					// Handle allowances object structure
					if (
						"allowances" in collateralBalance &&
						collateralBalance.allowances &&
						typeof collateralBalance.allowances === "object"
					) {
						const totalAllowance = Object.values(
							collateralBalance.allowances,
						).reduce((sum: number, val: unknown) => {
							return sum + (Number(val) || 0);
						}, 0);
						console.log(`   Total Allowance: $${totalAllowance}`);
						console.log(
							"   Allowance Details:",
							JSON.stringify(collateralBalance.allowances, null, 2),
						);
					} else if ("allowance" in collateralBalance) {
						console.log(`   Allowance: $${collateralBalance.allowance}`);
					}
				}
			} catch (collateralError) {
				console.log(
					"❌ COLLATERAL balance check failed:",
					collateralError instanceof Error
						? collateralError.message
						: collateralError,
				);
			}

			// Test CONDITIONAL asset type
			console.log("\n🎯 Testing CONDITIONAL asset type...");
			try {
				const conditionalBalance = await this.service[
					"clobClient"
				]?.getBalanceAllowance({
					asset_type: AssetType.CONDITIONAL,
				});
				console.log(
					"📊 CONDITIONAL balance response:",
					JSON.stringify(conditionalBalance, null, 2),
				);

				if (
					conditionalBalance &&
					typeof conditionalBalance === "object" &&
					"balance" in conditionalBalance
				) {
					console.log("✅ CONDITIONAL balance retrieved successfully");
					console.log(`   Balance: $${conditionalBalance.balance}`);
					console.log(`   Allowance: $${conditionalBalance.allowance}`);
				}
			} catch (conditionalError) {
				console.log(
					"❌ CONDITIONAL balance check failed:",
					conditionalError instanceof Error
						? conditionalError.message
						: conditionalError,
				);
			}

			// Test with a specific token ID for conditional assets
			console.log("\n🎯 Testing CONDITIONAL asset type with specific token...");
			try {
				// Use a token ID from the test market
				const testTokenId =
					"101410438042880105804033540589453177468854550892309199490181616480645383203160";
				const tokenBalance = await this.service[
					"clobClient"
				]?.getBalanceAllowance({
					asset_type: AssetType.CONDITIONAL,
					token_id: testTokenId,
				});
				console.log(
					"📊 Token-specific balance response:",
					JSON.stringify(tokenBalance, null, 2),
				);

				if (
					tokenBalance &&
					typeof tokenBalance === "object" &&
					"balance" in tokenBalance
				) {
					console.log("✅ Token-specific balance retrieved successfully");
					console.log(`   Token ID: ${testTokenId}`);
					console.log(`   Balance: $${tokenBalance.balance}`);
					console.log(`   Allowance: $${tokenBalance.allowance}`);
				}
			} catch (tokenError) {
				console.log(
					"❌ Token-specific balance check failed:",
					tokenError instanceof Error ? tokenError.message : tokenError,
				);
			}

			// Test different order values with better error handling
			const testValues = [10, 100, 1000];

			for (const value of testValues) {
				console.log(`\n🔍 Testing balance check for $${value} order...`);

				try {
					const requirements =
						await this.service.checkBuyOrderRequirements(value);

					console.log(`   Can Place: ${requirements.canPlace ? "✅" : "❌"}`);
					console.log(`   Balance: $${requirements.balance || "Unknown"}`);
					console.log(
						`   Max Order Size: $${requirements.maxOrderSize || "Unknown"}`,
					);

					if (requirements.error) {
						console.log(`   Error: ${requirements.error}`);
					}

					// Use the first successful check as our result
					if (!result.canCheck && requirements.balance !== undefined) {
						result.canCheck = true;
						result.balance = requirements.balance;
						result.maxOrderSize = requirements.maxOrderSize;
					}
				} catch (error) {
					const errorMsg =
						error instanceof Error ? error.message : "Unknown error";
					console.log(`   ❌ Balance check failed: ${errorMsg}`);

					if (!result.error) {
						result.error = errorMsg;
					}
				}
			}

			// Test alternative balance methods if available
			console.log("\n🔍 Testing alternative balance methods...");
			try {
				// Try to access other potential balance methods
				const clobClient = this.service["clobClient"];
				if (clobClient) {
					console.log("📋 Available methods on CLOB client:");
					const methods = Object.getOwnPropertyNames(
						Object.getPrototypeOf(clobClient),
					).filter(
						(name) =>
							name.toLowerCase().includes("balance") ||
							name.toLowerCase().includes("allowance"),
					);

					if (methods.length > 0) {
						methods.forEach((method) => {
							console.log(`   - ${method}`);
						});
					} else {
						console.log("   No balance-related methods found");
					}
				}
			} catch (error) {
				console.log("❌ Could not inspect CLOB client methods");
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			result.error = `Balance testing failed: ${errorMsg}`;
			console.log(`❌ Balance testing failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Test trading functionality
	 */
	async testTradingReadiness(): Promise<DebugResult["trading"]> {
		console.log("\n📈 TESTING TRADING READINESS");
		console.log("=".repeat(60));

		const result: DebugResult["trading"] = {
			ready: false,
			canTrade: false,
			errors: [],
		};

		try {
			// Check basic readiness
			result.ready = this.service.isReadyForTrading();
			result.canTrade = this.service.canTrade();

			console.log(`📊 Service Ready: ${result.ready ? "✅" : "❌"}`);
			console.log(`📊 Can Trade: ${result.canTrade ? "✅" : "❌"}`);

			if (!result.ready) {
				result.errors.push("Service not ready for trading");
			}

			// Test with a small order requirement
			if (result.ready) {
				console.log("\n🧪 Testing order requirements...");
				const requirements = await this.service.checkBuyOrderRequirements(1); // $1 test
				result.requirements = requirements;

				console.log(
					`   Can Place $1 Order: ${requirements.canPlace ? "✅" : "❌"}`,
				);
				console.log(`   Balance: $${requirements.balance || "Unknown"}`);

				if (requirements.error) {
					console.log(`   Error: ${requirements.error}`);
					result.errors.push(requirements.error);
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			result.errors.push(`Trading test failed: ${errorMsg}`);
			console.log(`❌ Trading test failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Test position fetching
	 */
	async testPositionFetching(): Promise<DebugResult["positions"]> {
		console.log("\n📊 TESTING POSITION FETCHING");
		console.log("=".repeat(60));

		const result: DebugResult["positions"] = {
			canFetch: false,
		};

		try {
			const walletAddress = this.service.getWalletAddress();

			if (!walletAddress) {
				result.error = "No wallet address available";
				console.log("❌ No wallet address for position testing");
				return result;
			}

			console.log(`🔍 Fetching positions for ${walletAddress}...`);

			const positions = await this.service.getUserPositions(walletAddress, {
				limit: 5,
				sizeThreshold: 0.1,
			});

			if (Array.isArray(positions)) {
				result.canFetch = true;
				result.count = positions.length;
				console.log(`✅ Successfully fetched ${positions.length} positions`);

				if (positions.length > 0) {
					console.log("📋 Sample positions:");
					positions
						.slice(0, 3)
						.forEach((pos: Record<string, unknown>, i: number) => {
							const market = pos.market as Record<string, unknown> | undefined;
							console.log(
								`   ${i + 1}. ${market?.question || "Unknown market"}`,
							);
							console.log(
								`      Size: ${pos.size} | Value: ${pos.value || "N/A"}`,
							);
						});
				}
			} else {
				result.error = "Invalid positions response";
				console.log("❌ Invalid positions response format");
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			result.error = `Position fetching failed: ${errorMsg}`;
			console.log(`❌ Position fetching failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Run comprehensive debug test
	 */
	async runComprehensiveTest(): Promise<DebugResult> {
		console.log("🚀 POLYMARKET CLOB CLIENT DEBUG SCRIPT");
		console.log("=".repeat(60));

		const result: DebugResult = {
			initialization: await this.testInitialization(),
			balance: await this.testBalanceChecking(),
			trading: await this.testTradingReadiness(),
			positions: await this.testPositionFetching(),
		};

		// Summary
		console.log("\n📋 DEBUG SUMMARY");
		console.log("=".repeat(60));

		console.log(
			`🔧 Initialization: ${result.initialization.success ? "✅" : "❌"}`,
		);
		console.log(`💰 Balance Check: ${result.balance.canCheck ? "✅" : "❌"}`);
		console.log(`📈 Trading Ready: ${result.trading.ready ? "✅" : "❌"}`);
		console.log(
			`📊 Position Fetch: ${result.positions.canFetch ? "✅" : "❌"}`,
		);

		if (result.initialization.walletAddress) {
			console.log(`👤 Wallet: ${result.initialization.walletAddress}`);
		}

		if (result.balance.balance !== undefined) {
			console.log(`💰 Balance: $${result.balance.balance}`);
		}

		if (result.positions.count !== undefined) {
			console.log(`📊 Positions: ${result.positions.count}`);
		}

		// Error summary
		const allErrors = [
			...result.initialization.errors,
			...result.trading.errors,
			...(result.balance.error ? [result.balance.error] : []),
			...(result.positions.error ? [result.positions.error] : []),
		];

		if (allErrors.length > 0) {
			console.log("\n⚠️ ERRORS FOUND:");
			allErrors.forEach((error, i) => {
				console.log(`   ${i + 1}. ${error}`);
			});
		}

		return result;
	}

	/**
	 * Test specific market interaction
	 */
	async testMarketInteraction(conditionId: string): Promise<void> {
		console.log(`\n🎯 TESTING MARKET INTERACTION: ${conditionId}`);
		console.log("=".repeat(60));

		try {
			// Test getting market data
			console.log("📊 Getting market data...");
			const rawMarket = await this.service.getRawMarket(conditionId);
			console.log(`✅ Market: ${rawMarket.market.question}`);
			console.log(`📊 Tokens: ${rawMarket.tokens.length}`);

			// Test order book for first token
			if (rawMarket.tokens.length > 0) {
				const firstToken = rawMarket.tokens[0];
				console.log(`\n📈 Testing order book for ${firstToken.outcome}...`);

				const orderBook = await this.service.getOrderBook(firstToken.token_id);
				console.log("✅ Order book retrieved:");
				console.log(`   Bids: ${orderBook.bids.length} orders`);
				console.log(`   Asks: ${orderBook.asks.length} orders`);

				if (orderBook.bids.length > 0) {
					console.log(`   Best bid: $${orderBook.bids[0].price}`);
				}
				if (orderBook.asks.length > 0) {
					console.log(`   Best ask: $${orderBook.asks[0].price}`);
				}
			}
		} catch (error) {
			console.log(
				`❌ Market interaction failed: ${error instanceof Error ? error.message : error}`,
			);
		}
	}
}

/**
 * Main debug function
 */
async function runDebug() {
	const debuggerInstance = new PolymarketDebugger();

	// Run comprehensive test
	const result = await debuggerInstance.runComprehensiveTest();

	// Test with a specific market if initialization was successful
	if (result.initialization.success) {
		const testMarket =
			"0x7b65109c8e37d06ae26f3c215f70fa20b3bdf6754c18807a9b61dd8803e74f3b"; // Ethereum $3800
		await debuggerInstance.testMarketInteraction(testMarket);
	}

	console.log("\n🎯 DEBUG COMPLETE");
	console.log("=".repeat(60));
}

// Run the debug script
if (import.meta.url === `file://${process.argv[1]}`) {
	runDebug().catch((error) => {
		console.error("💥 Debug script failed:", error);
		process.exit(1);
	});
}

export { runDebug, PolymarketDebugger };
