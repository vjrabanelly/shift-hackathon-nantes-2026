import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { ScrapingBeeClient } from "scrapingbee";
import { articleDataSchema } from "../schemas/article";

const extractArticleStep = createStep({
    id: "extract-article",
    description:
        "Fetches a news article URL and returns its structured content",
    inputSchema: z.object({ url: z.string() }),
    outputSchema: articleDataSchema,
    execute: async ({ inputData, mastra }) => {
        const apiKey = process.env.SCRAPINGBEE_API_KEY;
        if (!apiKey) throw new Error("SCRAPINGBEE_API_KEY is not set");

        const client = new ScrapingBeeClient(apiKey);
        const response = await client.htmlApi({
            url: inputData.url,
            params: {
                return_page_markdown: true,
                render_js: false
            }
        });

        const markdown = new TextDecoder().decode(response.data);

        const agent = mastra?.getAgent("articleStructurerAgent");
        if (!agent) throw new Error("articleStructurerAgent not found");

        const result = await agent.generate(
            `URL: ${inputData.url}\n\n${markdown}`,
            { structuredOutput: { schema: articleDataSchema } }
        );

        return result.object;
    }
});

export const articleExtractorWorkflow = createWorkflow({
    id: "article-extractor",
    description:
        "Fetches a news article from a URL and returns structured content",
    inputSchema: z.object({ url: z.string() }),
    outputSchema: articleDataSchema
})
    .then(extractArticleStep)
    .commit();
