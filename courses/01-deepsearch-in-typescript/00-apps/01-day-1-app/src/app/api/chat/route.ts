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

  const { messages: initialMessages } = body;
  let effectiveChatId = body.chatId; // Will hold the actual chatId to be used
  const isChatIdProvidedByClient = !!body.chatId; // True if client sent an ID

  // If chatId is not provided by the client, it's a new chat
  if (!isChatIdProvidedByClient) {
    effectiveChatId = randomUUID(); // Generate a new chatId
    const firstUserMessage = initialMessages.find(m => m.role === 'user')?.content;
    const chatTitle = typeof firstUserMessage === 'string'
      ? firstUserMessage.substring(0, 100)
      : "New Chat";

    // Create chat with initial messages (usually just the first user message)
    // We are saving the initial messages here before the stream begins.
    // The AI's response will be added in onFinish.
    await upsertChat({
      userId,
      chatId: effectiveChatId, // Use the newly generated chatId
      title: chatTitle,
      messages: initialMessages,
    });
  }
  // Now, effectiveChatId is guaranteed to be a string (either from client or newly generated)


  return createDataStreamResponse({
    execute: async (dataStream) => {
      // If it was a new chat creation flow (client didn't provide chatId),
      // send the NEW_CHAT_CREATED event with the new chatId.
      if (!isChatIdProvidedByClient) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: effectiveChatId!, // effectiveChatId is guaranteed string here
        });
      }

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
          const firstUserMessageContent = updatedMessages.find(m => m.role === 'user')?.content;
          const chatTitle = typeof firstUserMessageContent === 'string'
            ? firstUserMessageContent.substring(0, 100)
            // For a new chat, its title was already set. For existing, this updates or sets based on content.
            : (isChatIdProvidedByClient ? "Chat Update" : (initialMessages.find(m => m.role === 'user')?.content as string || "New Chat").substring(0, 100));


          await upsertChat({
            userId,
            chatId: effectiveChatId!, // Use the effective chatId (original or new)
            title: chatTitle,
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