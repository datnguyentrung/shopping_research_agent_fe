import A2UIRenderer from "@/components/a2ui/A2UIRenderer";
import ProcessingStatus from "@/components/a2ui/ProcessingStatus";
import { useScrollToBottom } from "@/hooks/useScrollToBottom";
import type { ChatMessage } from "@/types/chat.types";
import { formatDateTime } from "@/utils/formatters";
import { Copy, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ActivityMessage from "../ActivityMessage";
import "./ChatWindow.scss";

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  newSearchTerm: string;
  onReset: () => void;
  onSendHiddenMessage: (action: string, payload: unknown) => Promise<void>;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="chat-window__code-block">
      <div className="chat-window__code-header">
        <span className="chat-window__code-lang">{language}</span>
        <button className="chat-window__code-copy">
          <Copy className="chat-window__code-copy-icon" />
          Copy
        </button>
      </div>
      <pre className="chat-window__code-content">
        <code className="chat-window__code-text">{code}</code>
      </pre>
    </div>
  );
}

export default function ChatWindow({
  messages,
  isLoading,
  error,
  newSearchTerm,
  onReset,
  onSendHiddenMessage,
}: ChatWindowProps) {
  const bottomRef = useScrollToBottom(messages);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  const lastMessage = messages[messages.length - 1];
  const hasProductCard =
    lastMessage?.role === "assistant" &&
    (lastMessage?.a2ui?.type === "a2ui_interactive_product" ||
      (lastMessage?.seenProducts && lastMessage.seenProducts.length > 0));

  useEffect(() => {
    if (
      hasProductCard &&
      scrollContainerRef.current
    ) {
      const container = scrollContainerRef.current;
      const productBlock = container.querySelector(
        ".chat-window__a2ui-block:last-of-type"
      );
      if (productBlock) {
        productBlock.scrollIntoView({
          behavior: "instant" as ScrollBehavior,
          block: "end",
        });
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, hasProductCard]);

  return (
    <div className="chat-window">
      {/* Messages */}
      <div className="chat-window__messages-scroll" ref={scrollContainerRef}>
        <div className="chat-window__messages-stack">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`chat-window__message-row ${
                message.role === "user"
                  ? "chat-window__message-row--user"
                  : "chat-window__message-row--assistant"
              }`}
            >
              {/* Avatar */}
              {message.role === "assistant" ? (
                <div className="chat-window__avatar chat-window__avatar--assistant">
                  <Sparkles className="chat-window__avatar-icon" />
                </div>
              ) : (
                <div className="chat-window__avatar chat-window__avatar--user">
                  <span className="chat-window__avatar-text">JD</span>
                </div>
              )}

              {/* Bubble */}
              <div
                className={`chat-window__message-col ${
                  message.role === "user"
                    ? "chat-window__message-col--user"
                    : "chat-window__message-col--assistant"
                }`}
              >
                <div
                  className={`chat-window__bubble ${
                    message.role === "user"
                      ? "chat-window__bubble--user"
                      : "chat-window__bubble--assistant"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <>
                      {!message.content &&
                        message.a2ui?.type !== "a2ui_interactive_product" &&
                        message.a2ui?.type !== "a2ui_questionnaire" &&
                        !(
                          message.seenProducts &&
                          message.seenProducts.length > 0
                        ) &&
                        message.a2ui?.type === "a2ui_processing_status" && (
                          <ProcessingStatus
                            text={message.a2ui.data.statusText}
                            percent={message.a2ui.data.progressPercent}
                          />
                        )}

                      {!message.content &&
                        message.a2ui?.type !== "a2ui_interactive_product" &&
                        message.a2ui?.type !== "a2ui_questionnaire" &&
                        message.a2ui?.type !== "a2ui_processing_status" &&
                        !(
                          message.seenProducts &&
                          message.seenProducts.length > 0
                        ) &&
                        isLoading && (
                          <ActivityMessage
                            message={`Đang cập nhật tìm kiếm: ${newSearchTerm}`}
                          />
                        )}

                      {message.content && (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: ({ children }) => <>{children}</>,
                            p: ({ children }) => (
                              <p className="chat-window__text-paragraph">
                                {children}
                              </p>
                            ),
                            strong: ({ children }) => (
                              <strong className="chat-window__text-strong">
                                {children}
                              </strong>
                            ),
                            code: ({ className, children }) => {
                              const language =
                                className?.replace("language-", "") || "code";
                              const text = String(children).replace(/\n$/, "");
                              return className ? (
                                <CodeBlock code={text} language={language} />
                              ) : (
                                <code className="chat-window__text-inline-code">
                                  {text}
                                </code>
                              );
                            },
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      )}

                      {(message.a2ui &&
                        message.a2ui.type !== "a2ui_processing_status" &&
                        message.a2ui.type !== "a2ui_done") ||
                      (message.seenProducts &&
                        message.seenProducts.length > 0) ? (
                        <div className="chat-window__a2ui-block">
                          <A2UIRenderer
                            a2uiPayload={message.a2ui ?? null}
                            seenProducts={message.seenProducts}
                            onSendHiddenMessage={onSendHiddenMessage}
                            isLoading={isLoading}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    // Nếu là User -> Giữ nguyên ReactMarkdown như cũ
                    message.content && (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          pre: ({ children }) => <>{children}</>,
                          p: ({ children }) => (
                            <p className="chat-window__text-paragraph">
                              {children}
                            </p>
                          ),
                          strong: ({ children }) => (
                            <strong className="chat-window__text-strong">
                              {children}
                            </strong>
                          ),
                          code: ({ className, children }) => {
                            const language =
                              className?.replace("language-", "") || "code";
                            const text = String(children).replace(/\n$/, "");
                            return className ? (
                              <CodeBlock code={text} language={language} />
                            ) : (
                              <code className="chat-window__text-inline-code">
                                {text}
                              </code>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    )
                  )}
                </div>

                <small className="chat-window__timestamp">
                  {formatDateTime(message.createdAt)}
                </small>

                {/* Actions for assistant */}
                {message.role === "assistant" && (
                  <div className="chat-window__assistant-actions">
                    <button className="chat-window__assistant-action chat-window__assistant-action--copy">
                      <Copy className="chat-window__assistant-action-icon" />
                    </button>
                    <button className="chat-window__assistant-action chat-window__assistant-action--upvote">
                      <ThumbsUp className="chat-window__assistant-action-icon" />
                    </button>
                    <button className="chat-window__assistant-action chat-window__assistant-action--downvote">
                      <ThumbsDown className="chat-window__assistant-action-icon" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {error && <p className="chat-window__error">{error}</p>}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
