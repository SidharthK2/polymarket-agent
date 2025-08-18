#!/usr/bin/env node

import { PolymarketService } from './dist/services/polymarket-service.js';

async function testGetMarketSimple() {
    console.log('🔍 Simple test for PolymarketService.getMarket...\n');
    
    const service = new PolymarketService();
    
    try {
        // Test with a known market ID from CLOB API
        const testIds = ['0x039b48827f3c6b83f50153715af8a66f2b74b04fcfc5def13acb3f151eeb3d81'
        ];
        
        for (const marketId of testIds) {
            console.log(`\n📊 Testing getMarket with ID: ${marketId}`);
            
            try {
                const market = await service.getMarket(marketId);
                console.log('✅ Success!');
                console.log(`   Question: ${market.question}`);
                console.log(`   ID: ${market.id}`);
                console.log(`   Outcomes: ${market.outcomes.join(', ')}`);
                break; // Found a working ID, stop testing
            } catch (error) {
                console.log(`❌ Failed: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testGetMarketSimple().catch(console.error);
