// Test the fixed Gamma API parameters
const fetch = globalThis.fetch;

async function testFixedGammaAPI() {
    console.log('🔧 Testing FIXED Gamma API parameters...');
    
    try {
        // Test with the fixed parameters
        const params = new URLSearchParams({
            limit: '10',
            offset: '0', 
            active: 'true',
            closed: 'false', // Only open markets
            order: 'volume24hr',
            min_liquidity: '100' // Lower threshold
        });

        const url = `https://gamma-api.polymarket.com/markets?${params}`;
        console.log(`📡 Testing URL: ${url}`);
        
        const response = await fetch(url);
        console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            console.log('❌ Fixed Gamma API request failed');
            return false;
        }

        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            console.log(`✅ Fixed Gamma API working! Found ${data.data.length} markets`);
            
            // Check if markets are current
            const currentMarkets = data.data.filter(market => {
                const endDate = new Date(market.endDate || market.end_date_iso);
                return endDate > new Date(); // Future end date = active
            });
            
            console.log(`🎯 Current/Active markets: ${currentMarkets.length}/${data.data.length}`);
            
            if (currentMarkets.length > 0) {
                console.log(`📝 Sample current market:`, {
                    id: currentMarkets[0].id,
                    question: currentMarkets[0].question || currentMarkets[0].title,
                    endDate: currentMarkets[0].endDate || currentMarkets[0].end_date_iso,
                    volume: currentMarkets[0].volume24hr || currentMarkets[0].volume,
                    liquidity: currentMarkets[0].liquidity,
                    category: currentMarkets[0].category || currentMarkets[0].tags?.[0],
                    active: currentMarkets[0].active,
                    closed: currentMarkets[0].closed
                });
                return true;
            } else {
                console.log('⚠️ No current markets found - all are historical');
                return false;
            }
        } else {
            console.log('⚠️ Fixed Gamma API returned empty data');
            return false;
        }

    } catch (error) {
        console.log('❌ Fixed Gamma API test failed:', error.message);
        return false;
    }
}

testFixedGammaAPI().then(success => {
    if (success) {
        console.log('\n🎉 SUCCESS! The fix should work for your enhanced system!');
    } else {
        console.log('\n💡 Gamma API may not have current markets, but CLOB fallback will work');
    }
});
