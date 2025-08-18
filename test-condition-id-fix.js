#!/usr/bin/env node
import { PolymarketService } from './polymarket-mcp/dist/services/polymarket-service.js';

async function testConditionIdFix() {
    console.log('🔍 Testing conditionId fix...\n');
    const service = new PolymarketService();
    
    try {
        console.log('📊 Test: Search markets by interests (politics)...');
        const markets = await service.searchMarketsByInterests(['politics'], {
            limit: 3,
            knowledgeLevel: 'intermediate',
            riskTolerance: 'moderate'
        });
        
        if (markets.length > 0) {
            console.log(`✅ Found ${markets.length} markets:`);
            markets.forEach((market, index) => {
                console.log(`\n${index + 1}. Market Details:`);
                console.log(`   ID: ${market.id}`);
                console.log(`   conditionId: ${market.conditionId}`);
                console.log(`   Question: ${market.question}`);
                
                // Test if the ID is a conditionId (starts with 0x)
                if (market.id.startsWith('0x')) {
                    console.log(`   ✅ ID is a conditionId (correct for trading!)`);
                } else {
                    console.log(`   ❌ ID is NOT a conditionId (will fail trading)`);
                }
            });
        } else {
            console.log('❌ No markets found');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testConditionIdFix().catch(console.error);
