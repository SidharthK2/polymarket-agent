/**
 * Configuration object for the Polymarket MCP server.
 *
 * Centralizes all configuration values including API endpoints,
 * authentication keys, and blockchain settings. Reads sensitive values
 * from environment variables for security.
 */
export const config = {
	polymarket: {
		clobApiUrl: process.env.CLOB_API_URL || "https://clob.polymarket.com",
		chainId: 137, // Polygon mainnet
		apiKey: process.env.CLOB_API_KEY || "",
		secret: process.env.CLOB_SECRET || "",
		passphrase: process.env.CLOB_PASS_PHRASE || "",
		walletPrivateKey:
			process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY || "",
	},
	polygonRpc: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
};
