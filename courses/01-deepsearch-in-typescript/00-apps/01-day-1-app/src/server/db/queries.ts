import { db } from "~/server/db";
import { chats, messages, users } from "~/server/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Message as VercelAIMessage } from "ai";

export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title: string;
  messages: VercelAIMessage[];
}) => {
  const { userId, chatId, title, messages: newMessages } = opts;

  return db.transaction(async (tx) => {
    // Check if user exists
    const userExists = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userExists.length === 0) {
      throw new Error(`User with id ${userId} not found.`);
    }

    const existingChat = await tx
      .select({ id: chats.id, userId: chats.userId })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (existingChat.length > 0) {
      // Chat exists, verify ownership
      if (existingChat[0]?.userId !== userId) {
        throw new Error(
          `User ${userId} does not have permission to update chat ${chatId}`,
        );
      }

      // Delete existing messages for this chat
      await tx.delete(messages).where(eq(messages.chatId, chatId));

      // Update chat title and updatedAt
      await tx
        .update(chats)
        .set({
          title: title,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(chats.id, chatId));
    } else {
      // Chat does not exist, create it
      await tx.insert(chats).values({
        id: chatId,
        userId: userId,
        title: title,
        // createdAt and updatedAt will use default values
      });
    }

    // Insert new messages
    if (newMessages.length > 0) {
      const messagesToInsert = newMessages.map((message, index) => ({
        chatId: chatId,
        role: message.role,
        parts: message.parts ?? [{ type: "text", content: message.content }], // Handle old and new message format
        displayOrder: index,
      }));
      await tx.insert(messages).values(messagesToInsert);
    }

    // Return the chat with its messages
    const finalChat = await tx.query.chats.findFirst({
      where: eq(chats.id, chatId),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.displayOrder)],
        },
      },
    });

    return finalChat;
  });
};

export const getChat = async (chatId: string, userId: string) => {
  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.displayOrder)],
      },
    },
  });

  if (!chat) {
    return null;
  }
  return chat;
};

export const getChats = async (userId: string) => {
  const userChats = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: (chats, { desc }) => [desc(chats.updatedAt)],
    // We don't need messages here as per requirements
  });
  return userChats;
}; 