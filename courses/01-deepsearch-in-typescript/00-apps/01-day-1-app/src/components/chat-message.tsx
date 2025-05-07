import ReactMarkdown, { type Components } from "react-markdown";
import type { MessagePart } from "~/types";

interface ChatMessageProps {
  parts: MessagePart[];
  role: string;
  userName: string;
}

const components: Components = {
  // Override default elements with custom styling
  p: ({ children }) => <p className="mb-4 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ className, children, ...props }) => (
    <code className={`${className ?? ""}`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-700 p-4">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const Markdown = ({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

export const ChatMessage = ({ parts, role, userName }: ChatMessageProps) => {
  const isAI = role === "assistant";

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${
          isAI ? "bg-gray-800 text-gray-300" : "bg-gray-900 text-gray-300"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-400">
          {isAI ? "AI" : userName}
        </p>

        <div className="prose prose-invert max-w-none">
          {parts.map((part, index) => {
            switch (part.type) {
              case "text":
                return <Markdown key={index}>{part.text}</Markdown>;
              case "tool-invocation":
                return (
                  <div
                    key={index}
                    className="bg-gray-850 my-4 rounded border border-gray-700 p-3"
                  >
                    <p className="text-sm font-medium text-gray-400">
                      Tool Invocation: {part.toolInvocation.toolName}
                    </p>
                    <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-900 p-2 text-xs text-gray-300">
                      Args: {JSON.stringify(part.toolInvocation.args, null, 2)}
                    </pre>
                    {part.toolInvocation.state === "result" &&
                      part.toolInvocation.result && (
                        <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-900 p-2 text-xs text-green-400">
                          Result:{" "}
                          {JSON.stringify(part.toolInvocation.result, null, 2)}
                        </pre>
                      )}
                  </div>
                );
              default:
                // For now, we'll return null for other part types as per the requirements.
                // You can hover over MessagePart in your IDE to see all possible types.
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
};
