import clsx from "clsx";
import type { Message } from "@/types";

interface Props {
  message: Message;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex mb-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={clsx(
          "max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-blue-500 text-white rounded-br-sm"
            : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={clsx(
            "text-[0.65rem] mt-1 text-right",
            isUser ? "text-blue-100" : "text-gray-400"
          )}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
