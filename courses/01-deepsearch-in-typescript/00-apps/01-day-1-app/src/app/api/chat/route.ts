import type { Message } from "ai";
import { streamText, createDataStreamResponse } from "ai";
import { model } from "~/models";
import { auth } from "~/server/auth/index.ts";
import { searchSerper } from "~/serper";
import { z } from "zod";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
  };

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const { messages } = body;

      const result = streamText({
        model,
        messages,
        system:
          "You are a helpful AI assistant. You are equipped with a web search tool. Use it to answer questions that require up-to-date information or knowledge about current events. Always try to use the search web tool to find relevant information and cite your sources with inline links.",
        tools: {
          searchWeb: {
            description: "Search the web for a query.",
            parameters: z.object({
              query: z.string().describe("The query to search the web for"),
            }),
            execute: async ({ query }, { abortSignal }) => {
              const results = await searchSerper(
                { q: query, num: 10 },
                abortSignal,
              );

              return results.organic.map((result) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
              }));
            },
          },
        },
        maxSteps: 10,
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
} 