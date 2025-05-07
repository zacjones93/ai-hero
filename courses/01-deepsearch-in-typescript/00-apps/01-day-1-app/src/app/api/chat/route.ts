import type { Message } from "ai";
import { streamText, createDataStreamResponse, appendResponseMessages } from "ai";
import { model } from "~/models";
import { auth } from "~/server/auth/index.ts";
import { searchSerper } from "~/serper";
import { z } from "zod";
import { upsertChat } from "~/server/db/queries";
import { randomUUID } from "crypto";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !session.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const body = (await request.json()) as {
    messages: Array<Message>;
    chatId?: string;
  };

  let { chatId } = body;
  const { messages: initialMessages } = body; // Rename to initialMessages to avoid conflict

  // If chatId is not provided, create a new chat
  if (!chatId) {
    chatId = randomUUID();
    const firstUserMessage = initialMessages.find(m => m.role === 'user')?.content;
    const chatTitle = typeof firstUserMessage === 'string'
      ? firstUserMessage.substring(0, 100)
      : "New Chat";

    // Create chat with initial messages (usually just the first user message)
    // We are saving the initial messages here before the stream begins.
    // The AI's response will be added in onFinish.
    await upsertChat({
      userId,
      chatId,
      title: chatTitle,
      messages: initialMessages,
    });
  }


  return createDataStreamResponse({
    execute: async (dataStream) => {
      // const { messages } = body; // messages is now initialMessages
      // No need to destructure body again, initialMessages is already available.

      const result = streamText({
        model,
        messages: initialMessages, // Use initialMessages here
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
        onFinish: async ({ response }) => {
          const responseMessages = response.messages;

          const updatedMessages = appendResponseMessages({
            messages: initialMessages, // from the POST body
            responseMessages,
          });

          // Determine title for upsertChat
          // If it was a new chat, the title was already set.
          // If it's an existing chat, we can update the title or keep it.
          // For now, let's try to set the title based on the first user message of the updated set.
          const firstUserMessageContent = updatedMessages.find(m => m.role === 'user')?.content;
          const chatTitle = typeof firstUserMessageContent === 'string'
            ? firstUserMessageContent.substring(0, 100)
            : "Chat"; // Fallback title

          await upsertChat({
            userId,
            chatId: chatId!, // chatId is guaranteed to be defined here
            title: chatTitle, // Potentially update title, or use existing if preferred
            messages: updatedMessages,
          });
        }
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
} 