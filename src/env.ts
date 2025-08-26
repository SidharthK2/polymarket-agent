import { config } from "dotenv";
import { z } from "zod";

config();

export const envSchema = z.object({
	DEBUG: z.string().default("false"),
	DEMO: z.string().default("true"),
	GOOGLE_API_KEY: z.string(),
	CG_API_KEY: z.string(),
	TELEGRAM_BOT_TOKEN: z.string(),
	LLM_MODEL: z.string(),
	COINGECKO_ENVIRONMENT: z.enum(["demo", "pro"]).default("demo"),
	PRIVATE_KEY: z.string(),

	// System PATH for telegram toolset
	PATH: z.string().optional(),
});

export const env = envSchema.parse(process.env);
