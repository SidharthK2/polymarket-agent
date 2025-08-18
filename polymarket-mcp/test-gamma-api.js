// Using built-in fetch (Node.js 18+) or falling back to node-fetch
const fetch = globalThis.fetch;

/**
 * Quick test script for Polymarket Gamma API
 * Tests if the Gamma API is accessible and returns market data
 */

async function testGammaAPI() {
    console.log('🌟 Testing Polymarket Gamma API...');
    
    try {
        // Test basic markets endpoint
        const params = new URLSearchParams({
            limit: '10',
            offset: '0', 
            active: 'true',
            order: 'volume24hr',
            min_liquidity: '100'
        });

        const url = `https://gamma-api.polymarket.com/markets?${params}`;
        console.log(`📡 Testing URL: ${url}`);
        
        const response = await fetch(url);
        console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            console.log('❌ Gamma API request failed');
            console.log(`   Status: ${response.status}`);
            console.log(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
            return false;
        }

        const data = await response.json();
        console.log(`📈 Response structure:`, {
            type: typeof data,
            isArray: Array.isArray(data),
            hasData: !!data.data,
            dataLength: data.data?.length || 'N/A',
            keys: Object.keys(data).join(', ')
        });

        if (data.data && data.data.length > 0) {
            console.log(`✅ Gamma API working! Found ${data.data.length} markets`);
            console.log(`📝 Sample market:`, {
                id: data.data[0].id,
                question: data.data[0].question || data.data[0].title,
                volume: data.data[0].volume24hr || data.data[0].volume,
                liquidity: data.data[0].liquidity,
                category: data.data[0].category || data.data[0].tags?.[0]
            });
            return true;
        }
            console.log('⚠️ Gamma API returned empty data');
            console.log('   Full response:', JSON.stringify(data, null, 2));
            return false;

    } catch (error) {
        console.log('❌ Gamma API test failed with error:');
        console.log('   Error:', error.message);
        console.log('   Type:', error.constructor.name);
        if (error.code) console.log('   Code:', error.code);
        return false;
    }
}

async function testAlternativeEndpoints() {
    console.log('\n🔍 Testing alternative Gamma API endpoints...');
    
    const endpoints = [
        'https://gamma-api.polymarket.com/markets',
        'https://gamma-api.polymarket.com/events', 
        'https://api.polymarket.com/markets', // Alternative endpoint
        'https://strapi.polymarket.com/markets' // Another possible endpoint
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\n📡 Testing: ${endpoint}`);
            const response = await fetch(`${endpoint}?limit=1`);
            console.log(`   Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`   ✅ Success! Data type: ${typeof data}, length: ${data?.length || data?.data?.length || 'unknown'}`);
            }
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
        }
    }
}

// Run the tests
async function main() {
    const gammaSuccess = await testGammaAPI();
    
    if (!gammaSuccess) {
        await testAlternativeEndpoints();
    }
    
    console.log('\n🏁 Gamma API test completed!');
    
    if (!gammaSuccess) {
        console.log('\n💡 Recommendations:');
        console.log('   1. Gamma API might be down or changed endpoints');
        console.log('   2. Your enhanced system will fallback to CLOB API (which works!)');
        console.log('   3. Consider using CLOB API directly for now');
        console.log('   4. Market discovery will still work, just without volume/liquidity data');
    }
}

main().catch(console.error);
