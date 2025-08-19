import { AgentBuilder } from "@iqai/adk";
import { env } from "../env";

/**
 * Interest Profiler Agent - REFACTORED
 *
 * SINGLE RESPONSIBILITY: User interest discovery and profiling ONLY
 * - Analyzes user input to extract interests
 * - Categorizes interests for market matching
 * - NO market discovery, NO state management
 * - Returns structured interest profile
 */

interface UserProfile {
	interests: string[];
	knowledgeLevel: "beginner" | "intermediate" | "advanced";
	riskTolerance: "conservative" | "moderate" | "aggressive";
	categories: string[];
}

interface InterestResponse {
	success: boolean;
	profile?: UserProfile;
	interests: string[];
	categories: string[];
	confidence: number;
	error?: string;
	displayMessage: string;
}

export async function createInterestProfilerAgent() {
	const { runner } = await AgentBuilder.create("interest_profiler")
		.withDescription(
			"Discovers and categorizes user interests for personalized market recommendations",
		)
		.withModel(env.LLM_MODEL)
		.withInstruction(`
			You are an Interest Profiler for Polymarket - PURE INTEREST ANALYSIS.

			SINGLE RESPONSIBILITY: Extract and categorize user interests from conversation.

			CORE FUNCTION:
			1. Analyze user input to identify interests and preferences
			2. Map interests to Polymarket categories
			3. Infer knowledge level and risk tolerance from context
			4. Return structured profile for market matching

			INTEREST CATEGORIES TO DETECT:
			- Politics (elections, policy, candidates, government)
			- Sports (basketball, football, soccer, boxing, olympics, tournaments)
			- Crypto (bitcoin, ethereum, defi, nft, blockchain, trading)
			- Technology (ai, startups, ipo, tech companies, innovation)
			- Entertainment (movies, music, awards, celebrities, streaming)
			- Economics (markets, inflation, gdp, employment, finance)
			- Current Events (news, social trends, viral content)
			- Science (climate, space, research, discoveries)

			KNOWLEDGE LEVEL INDICATORS:
			- Beginner: "new to", "learning about", "what is", basic questions
			- Intermediate: general interest, some familiarity, moderate engagement
			- Advanced: specific terminology, detailed questions, expert knowledge

			RISK TOLERANCE INDICATORS:
			- Conservative: "safe", "stable", "low risk", "careful"
			- Moderate: balanced approach, mixed signals, default assumption
			- Aggressive: "high risk", "exciting", "volatile", "speculative"

			OUTPUT FORMAT:
			Always respond with a structured analysis:

			INTERESTS DETECTED: [list of specific interests]
			CATEGORIES: [main categories matched]
			KNOWLEDGE LEVEL: [beginner/intermediate/advanced]
			RISK TOLERANCE: [conservative/moderate/aggressive]
			CONFIDENCE: [0.0-1.0 score]

			Then provide friendly explanation of findings.

			VALIDATION RULES:
			- Minimum 1 interest required
			- Map to known Polymarket categories
			- Default to "intermediate" and "moderate" if unclear
			- Be specific with interests (not just categories)

			EXAMPLES:
			Input: "I love basketball and crypto trading"
			Output: 
			INTERESTS DETECTED: [basketball, crypto trading, sports betting]
			CATEGORIES: [Sports, Crypto]
			KNOWLEDGE LEVEL: intermediate
			RISK TOLERANCE: moderate
			CONFIDENCE: 0.8

			Input: "I'm new to politics, want to learn about elections"
			Output:
			INTERESTS DETECTED: [politics, elections, voting]
			CATEGORIES: [Politics]
			KNOWLEDGE LEVEL: beginner
			RISK TOLERANCE: conservative
			CONFIDENCE: 0.9

			PERSONALITY: Friendly analyst, curious about user preferences, educational tone.
		`)
		.build();

	// Wrap runner with structured profiling
	const wrappedRunner = {
		analyzeInterests: async (userInput: string): Promise<InterestResponse> => {
			try {
				const message = `Analyze user interests from: "${userInput}". Extract specific interests, map to categories, and assess knowledge/risk levels. Use the structured format with INTERESTS DETECTED, CATEGORIES, etc.`;

				const response = await runner.ask(message);

				// Parse structured response
				const profile = parseInterestProfile(response);

				if (profile.interests.length === 0) {
					return {
						success: false,
						interests: [],
						categories: [],
						confidence: 0,
						error: "No clear interests detected",
						displayMessage:
							"I couldn't identify specific interests from your message. Could you tell me more about what topics interest you? For example: politics, sports, crypto, technology, entertainment?",
					};
				}

				return {
					success: true,
					profile,
					interests: profile.interests,
					categories: profile.categories,
					confidence: calculateConfidence(profile, userInput),
					displayMessage: response,
				};
			} catch (error) {
				return {
					success: false,
					interests: [],
					categories: [],
					confidence: 0,
					error: error instanceof Error ? error.message : "Analysis failed",
					displayMessage:
						"I had trouble analyzing your interests. Please try describing what topics or areas you're interested in more specifically.",
				};
			}
		},

		// Legacy ask method for backward compatibility
		ask: async (message: string): Promise<string> => {
			return await runner.ask(message);
		},

		// Add runAsync for compatibility
		runAsync: async function* (params: any) {
			const result = await runner.ask(params.newMessage?.content || "");
			yield { type: "response", content: result };
		},
	};

	return wrappedRunner;
}

/**
 * Parse structured interest profile from agent response
 */
function parseInterestProfile(response: string): UserProfile {
	const profile: UserProfile = {
		interests: [],
		knowledgeLevel: "intermediate",
		riskTolerance: "moderate",
		categories: [],
	};

	try {
		// Parse interests
		const interestsMatch = response.match(/INTERESTS DETECTED:\s*\[(.*?)\]/i);
		if (interestsMatch) {
			profile.interests = interestsMatch[1]
				.split(",")
				.map((i) => i.trim().replace(/['"]/g, ""))
				.filter((i) => i.length > 0);
		}

		// Parse categories
		const categoriesMatch = response.match(/CATEGORIES:\s*\[(.*?)\]/i);
		if (categoriesMatch) {
			profile.categories = categoriesMatch[1]
				.split(",")
				.map((c) => c.trim().replace(/['"]/g, ""))
				.filter((c) => c.length > 0);
		}

		// Parse knowledge level
		const knowledgeMatch = response.match(/KNOWLEDGE LEVEL:\s*(\w+)/i);
		if (knowledgeMatch) {
			const level = knowledgeMatch[1].toLowerCase();
			if (["beginner", "intermediate", "advanced"].includes(level)) {
				profile.knowledgeLevel = level as
					| "beginner"
					| "intermediate"
					| "advanced";
			}
		}

		// Parse risk tolerance
		const riskMatch = response.match(/RISK TOLERANCE:\s*(\w+)/i);
		if (riskMatch) {
			const risk = riskMatch[1].toLowerCase();
			if (["conservative", "moderate", "aggressive"].includes(risk)) {
				profile.riskTolerance = risk as
					| "conservative"
					| "moderate"
					| "aggressive";
			}
		}
	} catch (parseError) {
		console.warn("Failed to parse interest profile, using defaults");
	}

	// Fallback: try to extract interests from free text
	if (profile.interests.length === 0) {
		profile.interests = extractInterestsFromText(response);
		profile.categories = mapInterestsToCategories(profile.interests);
	}

	return profile;
}

/**
 * Extract interests from free text as fallback
 */
function extractInterestsFromText(text: string): string[] {
	const interests: string[] = [];
	const textLower = text.toLowerCase();

	// Known interest keywords
	const interestKeywords = {
		politics: [
			"politics",
			"election",
			"voting",
			"government",
			"policy",
			"candidate",
		],
		sports: [
			"sports",
			"basketball",
			"football",
			"soccer",
			"baseball",
			"tennis",
			"golf",
			"boxing",
			"mma",
			"olympics",
		],
		crypto: [
			"crypto",
			"bitcoin",
			"ethereum",
			"blockchain",
			"defi",
			"nft",
			"trading",
		],
		technology: [
			"technology",
			"tech",
			"ai",
			"artificial intelligence",
			"startup",
			"innovation",
		],
		entertainment: [
			"entertainment",
			"movies",
			"music",
			"tv",
			"celebrity",
			"awards",
		],
		economics: [
			"economics",
			"finance",
			"market",
			"trading",
			"investment",
			"money",
		],
		"current events": ["news", "current events", "trending", "viral"],
	};

	for (const [category, keywords] of Object.entries(interestKeywords)) {
		for (const keyword of keywords) {
			if (textLower.includes(keyword)) {
				interests.push(keyword);
				break; // Only add one per category
			}
		}
	}

	return [...new Set(interests)]; // Remove duplicates
}

/**
 * Map specific interests to broader categories
 */
function mapInterestsToCategories(interests: string[]): string[] {
	const categoryMap: { [key: string]: string } = {
		// Politics
		politics: "Politics",
		election: "Politics",
		voting: "Politics",
		government: "Politics",
		policy: "Politics",
		candidate: "Politics",

		// Sports
		sports: "Sports",
		basketball: "Sports",
		football: "Sports",
		soccer: "Sports",
		baseball: "Sports",
		tennis: "Sports",
		golf: "Sports",
		boxing: "Sports",
		mma: "Sports",
		olympics: "Sports",

		// Crypto
		crypto: "Crypto",
		bitcoin: "Crypto",
		ethereum: "Crypto",
		blockchain: "Crypto",
		defi: "Crypto",
		nft: "Crypto",
		"crypto trading": "Crypto",

		// Technology
		technology: "Technology",
		tech: "Technology",
		ai: "Technology",
		"artificial intelligence": "Technology",
		startup: "Technology",
		innovation: "Technology",

		// Entertainment
		entertainment: "Entertainment",
		movies: "Entertainment",
		music: "Entertainment",
		tv: "Entertainment",
		celebrity: "Entertainment",
		awards: "Entertainment",

		// Economics
		economics: "Economics",
		finance: "Economics",
		market: "Economics",
		trading: "Economics",
		investment: "Economics",

		// Current Events
		news: "Current Events",
		"current events": "Current Events",
		trending: "Current Events",
		viral: "Current Events",
	};

	const categories = new Set<string>();

	for (const interest of interests) {
		const category = categoryMap[interest.toLowerCase()];
		if (category) {
			categories.add(category);
		}
	}

	return Array.from(categories);
}

/**
 * Calculate confidence score based on profile completeness and input quality
 */
function calculateConfidence(profile: UserProfile, userInput: string): number {
	let confidence = 0;

	// Base confidence from interests found
	if (profile.interests.length > 0) confidence += 0.4;
	if (profile.interests.length > 2) confidence += 0.2;

	// Categories mapped
	if (profile.categories.length > 0) confidence += 0.2;

	// Input quality indicators
	const inputLength = userInput.trim().length;
	if (inputLength > 20) confidence += 0.1;
	if (inputLength > 50) confidence += 0.1;

	// Specific keywords detected
	const specificKeywords = [
		"love",
		"interested",
		"follow",
		"watch",
		"trade",
		"invest",
	];
	const hasSpecificKeywords = specificKeywords.some((keyword) =>
		userInput.toLowerCase().includes(keyword),
	);
	if (hasSpecificKeywords) confidence += 0.1;

	return Math.min(confidence, 1.0);
}
