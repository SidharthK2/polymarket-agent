// Simple test to check if Polymarket API is accessible
import { ClobClient } from "@polymarket/clob-client";

async function testPolymarket() {
    console.log("🔍 Testing Polymarket API...");
    
    try {
        // Initialize without wallet for read-only access
        const client = new ClobClient(
            "https://clob.polymarket.com",
            137, // Polygon mainnet
            undefined, // No wallet for read-only
            undefined  // No credentials
        );

        console.log("✅ CLOB client created");
        
        // Try to fetch markets
        console.log("🔍 Fetching markets...");
        const markets = await client.getMarkets();
        
        console.log("📊 Markets response:", {
            type: typeof markets,
            isArray: Array.isArray(markets),
            length: Array.isArray(markets) ? markets.length : 'N/A',
            sample: Array.isArray(markets) && markets.length > 0 ? markets[0] : markets
        });
        
    } catch (error) {
        console.error("❌ Error:", error.message);
        console.error("Full error:", error);
    }
}

testPolymarket();
