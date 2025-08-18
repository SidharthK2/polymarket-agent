import { AgentBuilder, createTool } from "@iqai/adk";
import { env } from "../env";

/**
 * Onboarding Coordinator Agent
 *
 * Main orchestrator that guides users through the Polymarket onboarding
 * experience by coordinating with specialized sub-agents.
 */
export async function createOnboardingCoordinator(subAgents: {
	interestProfiler: any;
	marketRecommender: any;
}) {
	// Create agent tools for delegation
	const interestProfilerTool = createTool({
		name: "profile_user_interests",
		description: "Discover user interests and preferences through conversation",
		fn: async (args, context) => {
			return await subAgents.interestProfiler.ask(
				"Please help profile this user's interests based on our conversation.",
				context,
			);
		},
	});

	const marketRecommenderTool = createTool({
		name: "recommend_markets",
		description: "Find and recommend markets based on user interests",
		fn: async (args, context) => {
			return await subAgents.marketRecommender.ask(
				"Please recommend markets based on the user profile.",
				context,
			);
		},
	});

	const { runner } = await AgentBuilder.create("onboarding_coordinator")
		.withDescription(
			"Guides users through personalized Polymarket onboarding experience",
		)
		.withModel(env.LLM_MODEL)
		.withInstruction(`
            You are the Onboarding Coordinator for Polymarket - your goal is to provide a smooth, personalized introduction to prediction markets.

            WELCOME FLOW:
            1. Greet new users warmly
            2. Briefly explain what you'll help them with
            3. Ask if they'd like to explore markets based on their interests

            SIMPLE COORDINATION:
            - If user mentions interests (basketball, politics, etc.) → immediately use recommend_markets
            - Skip profiling unless absolutely necessary
            - Focus on getting to market recommendations quickly

            DELEGATION STRATEGY:
            - Use sub-agents for their specialties
            - Coordinate the overall experience
            - Synthesize information from multiple agents
            - Keep the conversation flowing naturally

            USER EXPERIENCE PRINCIPLES:
            - Make it feel conversational, not robotic
            - Personalize based on their responses
            - Don't overwhelm with too much info at once
            - Always ask what they'd like to explore next
            - Be encouraging but realistic about risks

            PERSONALITY: Friendly guide, knowledgeable but not pushy, focused on education and discovery rather than promoting trading.
        `)
		.withTools(interestProfilerTool, marketRecommenderTool)
		.build();

	return runner;
}
