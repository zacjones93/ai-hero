"use client";

import { ChatMessage } from "~/components/chat-message";
import { SignInModal } from "~/components/sign-in-modal";
import { useChat } from "@ai-sdk/react";
import { Loader2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { isNewChatCreated as IsNewChatCreatedType } from "~/types";
import { isNewChatCreated } from "~/types";
import type { Message } from "ai";

interface ChatPageProps {
  userName: string;
  chatId?: string;
  initialMessages: Message[]
}

export const ChatPage = ({
  userName,
  chatId,
  initialMessages,
}: ChatPageProps) => {
  const router = useRouter();
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, data } =
    useChat({
      api: "/api/chat",
      initialMessages,
      body: {
        chatId,
      },
      onError: (error) => {
        if (
          error.message.includes("Unauthorized") ||
          error.message.includes("401")
        ) {
          toast.error("Authentication required. Please sign in to chat.");
          setIsSignInModalOpen(true);
        } else {
          toast.error("Oops, an error occurred! Please try again.");
          console.error("Chat error:", error);
        }
      },
    });

  useEffect(() => {
    if (data && data.length > 0) {
      const lastDataItem = data[data.length - 1];
      if (isNewChatCreated(lastDataItem)) {
        router.push(`?id=${lastDataItem.chatId}`);
      }
    }
  }, [data, router]);

  console.log({ messages });

  return (
    <>
      <Toaster richColors position="top-center" />
      <div className="flex flex-1 flex-col">
        <div
          className="mx-auto w-full max-w-[65ch] flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500"
          role="log"
          aria-label="Chat messages"
        >
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              parts={message.parts ?? [{ type: "text", text: message.content }]}
              role={message.role}
              userName={userName}
            />
          ))}

          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
          )}
        </div>

        <div className="border-t border-gray-700">
          <form onSubmit={handleSubmit} className="mx-auto max-w-[65ch] p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Say something..."
                autoFocus
                aria-label="Chat input"
                className="flex-1 rounded border border-gray-700 bg-gray-800 p-2 text-gray-200 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || input.trim() === ""}
                className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:hover:bg-gray-700"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "send"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
      />
    </>
  );
};
