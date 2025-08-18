import { AgentBuilder, createTool } from "@iqai/adk";
import { env } from "../env";

/**
 * Onboarding Coordinator Agent
 *
 * Main orchestrator that guides users through the Polymarket onboarding
 * experience by coordinating with specialized sub-agents.
 */
type AgentRunner = Awaited<
	ReturnType<typeof AgentBuilder.prototype.build>
>["runner"];

export async function createOnboardingCoordinator(subAgents: {
	interestProfiler: AgentRunner;
	marketRecommender: AgentRunner;
}) {
	// Create agent tools for delegation using Agent-as-a-Tool pattern
	const interestProfilerTool = createTool({
		name: "profile_user_interests",
		description:
			"Discover and analyze user interests through specialized conversation to build their market preference profile",
		/**
		 * Delegates to the Interest Profiler Agent to discover user preferences
		 * @param query - Optional specific query about user interests
		 * @returns Structured user interest profile
		 */
		fn: async (args: { query?: string }, context) => {
			const message = args.query
				? `Please help profile this user's interests, focusing on: ${args.query}`
				: "Please help profile this user's interests based on our conversation.";

			return await subAgents.interestProfiler.ask(message);
		},
	});

	const marketRecommenderTool = createTool({
		name: "recommend_markets",
		description:
			"Find and recommend relevant Polymarket markets based on user interests and preferences",
		/**
		 * Delegates to the Market Recommender Agent to find relevant markets
		 * @param interests - Specific interests to search for
		 * @param limit - Maximum number of markets to recommend
		 * @returns Structured market recommendations with trading options
		 */
		fn: async (args: { interests?: string; limit?: number }, context) => {
			let message = "Please recommend markets based on the user profile.";

			if (args.interests) {
				message = `Please recommend markets for someone interested in: ${args.interests}`;
			}
			if (args.limit) {
				message += ` Limit to ${args.limit} recommendations.`;
			}

			return await subAgents.marketRecommender.ask(message);
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
