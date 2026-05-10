import { useEffect, useRef } from "react";

export const useScrollToBottom = <T>(messages: T[]) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: "instant" as ScrollBehavior,
        block: "end",
      });
    }
  }, [messages]);

  return bottomRef;
};
