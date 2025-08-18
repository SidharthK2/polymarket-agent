#!/usr/bin/env node

import { PolymarketService } from './dist/services/polymarket-service.js';

async function testGammaVsClob() {
    console.log('🔍 Testing Gamma API vs CLOB API market structures...\n');
    
    const service = new PolymarketService();
    
    try {
        // Test 1: Get markets from Gamma API
        console.log('📊 Test 1: Getting markets from Gamma API...');
        const gammaMarkets = await service.getMarketsFromGamma({ limit: 2 });
        
        if (gammaMarkets.length > 0) {
            const gammaMarket = gammaMarkets[0];
            console.log('✅ Gamma API Market Structure:');
            console.log('   ID:', gammaMarket.id);
            console.log('   Question:', gammaMarket.question);
            console.log('   condition_id:', gammaMarket.condition_id);
            console.log('   conditionId:', gammaMarket.conditionId);
            console.log('   All fields:', Object.keys(gammaMarket));
            
                         // Test 2: Try to get the same market from CLOB API using conditionId
             console.log('\n📊 Test 2: Trying to get same market from CLOB API using conditionId...');
             try {
                 const clobMarket = await service.getMarket(gammaMarket.conditionId);
                 console.log('✅ CLOB API Market found!');
                 console.log('   CLOB ID:', clobMarket.id);
                 console.log('   CLOB Question:', clobMarket.question);
             } catch (error) {
                console.log('❌ CLOB API failed:', error.message);
                
                // Test 3: Try with condition_id if available
                if (gammaMarket.condition_id) {
                    console.log('\n📊 Test 3: Trying with condition_id...');
                    try {
                        const clobMarket2 = await service.getMarket(gammaMarket.condition_id);
                        console.log('✅ CLOB API Market found with condition_id!');
                        console.log('   CLOB ID:', clobMarket2.id);
                        console.log('   CLOB Question:', clobMarket2.question);
                    } catch (error2) {
                        console.log('❌ CLOB API failed with condition_id:', error2.message);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testGammaVsClob().catch(console.error);
