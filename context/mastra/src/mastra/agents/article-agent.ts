import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import z from "zod";

/** Structured output schema for a parsed news article */
export const articleOutputSchema = z.object({
    title: z.string().describe("Headline of the article"),
    summary: z.string().describe("2–3 sentence summary of the article"),
    keyPoints: z
        .array(z.string())
        .describe("Main points extracted from the article"),
    author: z.string().nullable().describe("Author name, null if not found"),
    publishedDate: z
        .string()
        .nullable()
        .describe("Publication date (ISO 8601 or as-is), null if not found"),
    category: z
        .string()
        .nullable()
        .describe(
            "Topic category (e.g. Politics, Tech, Sport), null if not found"
        ),
    url: z.string().describe("Original article URL")
});

/** Agent that fetches a news article URL and returns structured content */
export const articleAgent = new Agent({
    id: "article-agent",
    name: "Article Agent",
    instructions: `
You are an expert news article extractor.
Given a URL, use your webSearch tool to retrieve the article content.
Extract and return the following fields as structured JSON:
- title: the article headline
- summary: a single sentence summary
- keyPoints: 3 main points maximum
- author: the author name (null if unavailable)
- publishedDate: the publication date (null if unavailable)
- category: the topic category (null if unavailable)
- url: the original URL passed by the user
Always respond using the exact JSON structure. No commentary outside the JSON.
  `.trim(),
    model: "openai/gpt-5.4",
    tools: {
        webSearch: openai.tools.webSearch()
    }
});
