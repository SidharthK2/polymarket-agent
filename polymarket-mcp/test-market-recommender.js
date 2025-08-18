#!/usr/bin/env node
import { PolymarketService } from './dist/services/polymarket-service.js';

async function testMarketRecommender() {
    console.log('🔍 Testing what market data search functions return...\n');
    const service = new PolymarketService();
    
    try {
        console.log('📊 Test 1: Search markets by interests (basketball)...');
        const basketballMarkets = await service.searchMarketsByInterests(['basketball'], {
            limit: 3,
            knowledgeLevel: 'intermediate',
            riskTolerance: 'moderate'
        });
        
        if (basketballMarkets.length > 0) {
            console.log(`✅ Found ${basketballMarkets.length} basketball markets:`);
            basketballMarkets.forEach((market, index) => {
                console.log(`\n${index + 1}. Market Details:`);
                console.log(`   ID: ${market.id}`);
                console.log(`   conditionId: ${market.conditionId}`);
                console.log(`   Question: ${market.question}`);
                console.log(`   All fields:`, Object.keys(market));
            });
        } else {
            console.log('❌ No basketball markets found');
        }
        
        console.log('\n📊 Test 2: Enhanced search (sports)...');
        const sportsMarkets = await service.searchMarketsEnhanced('sports', {
            limit: 3,
            sortBy: 'volume'
        });
        
        if (sportsMarkets.length > 0) {
            console.log(`✅ Found ${sportsMarkets.length} sports markets:`);
            sportsMarkets.forEach((market, index) => {
                console.log(`\n${index + 1}. Market Details:`);
                console.log(`   ID: ${market.id}`);
                console.log(`   conditionId: ${market.conditionId}`);
                console.log(`   Question: ${market.question}`);
                console.log(`   All fields:`, Object.keys(market));
            });
        } else {
            console.log('❌ No sports markets found');
        }
        
        console.log('\n📊 Test 3: Direct Gamma API call (no filtering)...');
        const directMarkets = await service.getMarketsFromGamma({ 
            limit: 5,
            min_liquidity: 100  // Lower liquidity threshold
        });
        
        if (directMarkets.length > 0) {
            console.log(`✅ Found ${directMarkets.length} direct markets:`);
            directMarkets.forEach((market, index) => {
                console.log(`\n${index + 1}. Market Details:`);
                console.log(`   ID: ${market.id}`);
                console.log(`   conditionId: ${market.conditionId}`);
                console.log(`   Question: ${market.question}`);
                console.log(`   Liquidity: ${market.liquidity}`);
                console.log(`   Volume: ${market.volume}`);
            });
        } else {
            console.log('❌ No direct markets found');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testMarketRecommender().catch(console.error);
