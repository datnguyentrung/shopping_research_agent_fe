import A2UIRenderer from "@/components/a2ui/A2UIRenderer";
import ProcessingStatus from "@/components/a2ui/ProcessingStatus";
import ChatInput from "@/components/ChatInput";
import { NewChat } from "@/components/ChatWindow/NewChat";
import { useScrollToBottom } from "@/hooks/useScrollToBottom";
import type { ChatMessage } from "@/types/chat.types";
import { formatDateTime } from "@/utils/formatters";
import { Skeleton } from "boneyard-js/react";
import { Copy, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useRef, useState, type FC } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../contexts/AuthContext";
import ActivityMessage from "../ActivityMessage";
import TryOnModal from "../TryOnModal";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import "./ChatWindow.scss";

/* ───────── Props ───────── */

interface ChatWindowProps {
  messages: ChatMessage[] | null;
  isLoading: boolean;
  isFetchingHistory: boolean;
  error: string | null;
  newSearchTerm: string;
  user: ReturnType<typeof useAuth>["user"];
  onReset: () => void;
  onSendHiddenMessage: (action: string, payload: unknown) => Promise<void>;
  onQuickAction?: (prompt: string) => void;
  onSend: (content: string) => Promise<void>;
}

/* ───────── Code Block ───────── */

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

/* ───────── Chat Skeleton (boneyard-js fallback) ───────── */

const ChatSkeleton: FC = () => {
  const rows = Array.from({ length: 4 }, (_, i) => i);

  return (
    <div className="chat-window__skeleton">
      <div className="chat-window__skeleton-stack">
        {rows.map((i) => (
          <div
            key={i}
            className={`chat-window__skeleton-row ${
              i % 2 === 0
                ? "chat-window__skeleton-row--assistant"
                : "chat-window__skeleton-row--user"
            }`}
          >
            {/* Avatar bone */}
            {i % 2 === 0 && <div className="chat-window__skeleton-avatar" />}

            {/* Bubble bones */}
            <div
              className={`chat-window__skeleton-bubble ${
                i % 2 === 0
                  ? "chat-window__skeleton-bubble--assistant"
                  : "chat-window__skeleton-bubble--user"
              }`}
            >
              {i % 2 === 0 ? (
                <>
                  <div className="chat-window__skeleton-bone chat-window__skeleton-bone--lg" />
                  <div className="chat-window__skeleton-bone chat-window__skeleton-bone--md" />
                  <div className="chat-window__skeleton-bone chat-window__skeleton-bone--sm" />
                </>
              ) : (
                <div className="chat-window__skeleton-bone chat-window__skeleton-bone--user" />
              )}
            </div>

            {/* User avatar bone (right side) */}
            {i % 2 !== 0 && <div className="chat-window__skeleton-avatar" />}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────── Main Component ───────── */

export default function ChatWindow({
  messages,
  isLoading,
  isFetchingHistory,
  error,
  newSearchTerm,
  user,
  onSendHiddenMessage,
  onQuickAction,
  onSend,
}: ChatWindowProps) {
  const [selectedProduct, setSelectedProduct] = useState<{
    imgUrl: string;
    productUrl: string;
    name: string;
  } | null>(null);
  const safeMessages = messages ?? [];
  const bottomRef = useScrollToBottom(safeMessages);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(safeMessages.length);

  const lastMessage = safeMessages[safeMessages.length - 1];
  const hasProductCard =
    lastMessage?.role === "assistant" &&
    (lastMessage?.a2ui?.type === "a2ui_interactive_product" ||
      (lastMessage?.seenProducts && lastMessage.seenProducts.length > 0));

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  useEffect(() => {
    if (hasProductCard && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const productBlock = container.querySelector(
        ".chat-window__a2ui-block:last-of-type",
      );
      if (productBlock) {
        productBlock.scrollIntoView({
          behavior: "instant" as ScrollBehavior,
          block: "end",
        });
      }
    }
    prevMessageCountRef.current = safeMessages.length;
  }, [safeMessages.length, hasProductCard]);

  const isEmpty = safeMessages.length === 0;

  /*
   * Strict rendering priority (evaluated top → bottom):
   *   1. isFetchingHistory  → skeleton  (always wins, regardless of messages state)
   *   2. has messages       → messages list
   *   3. fallback           → empty welcome screen
   */
  const viewState = isFetchingHistory
    ? "window-skeleton"
    : !isEmpty
      ? "window-messages"
      : "window-empty";

  return (
    <>
      <div className="chat-window">
        <AnimatePresence mode="wait">
          {viewState === "window-skeleton" && (
            <motion.div
              key="window-skeleton"
              className="chat-window__messages-scroll"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              <Skeleton
                loading
                animate="shimmer"
                color="#f0f0f5"
                transition={300}
                fallback={<ChatSkeleton />}
              >
                <div />
              </Skeleton>
            </motion.div>
          )}

          {viewState === "window-empty" && (
            <motion.div
              key="window-empty"
              className="chat-window__empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <NewChat
                onQuickAction={onQuickAction ?? (() => {})}
                onSend={onSend}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {viewState === "window-messages" && (
            <motion.div
              key="window-messages"
              className="chat-window__messages-scroll"
              ref={scrollContainerRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              <div className="chat-window__messages-stack">
                {safeMessages.map((message) => (
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
                    ) : user ? (
                      <Avatar className="chat-sidebar__avatar">
                        <AvatarImage
                          src={user?.user_metadata?.avatar_url}
                          alt={user?.user_metadata?.full_name}
                        />
                        <AvatarFallback className="chat-sidebar__avatar-fallback">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="chat-window__avatar chat-window__avatar--user">
                        <AvatarImage src="" alt="User Avatar" />
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
                              message.a2ui?.type !==
                                "a2ui_interactive_product" &&
                              message.a2ui?.type !== "a2ui_questionnaire" &&
                              !(
                                message.seenProducts &&
                                message.seenProducts.length > 0
                              ) &&
                              message.a2ui?.type ===
                                "a2ui_processing_status" && (
                                <ProcessingStatus
                                  text={message.a2ui.data.statusText}
                                  percent={message.a2ui.data.progressPercent}
                                />
                              )}

                            {!message.content &&
                              message.a2ui?.type !==
                                "a2ui_interactive_product" &&
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
                                      className?.replace("language-", "") ||
                                      "code";
                                    const text = String(children).replace(
                                      /\n$/,
                                      "",
                                    );
                                    return className ? (
                                      <CodeBlock
                                        code={text}
                                        language={language}
                                      />
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
                                  // 2. THẺ IMG: Chỉ nhận src và alt tiêu chuẩn, ép kiểu qua ComponentProps để chiều lòng TS
                                  img: (
                                    props: React.ComponentPropsWithoutRef<"img">,
                                  ) => {
                                    const { src, alt } = props;
                                    if (!src) return null;

                                    // Giải mã dữ liệu từ alt text ("Tên sản phẩm | Link sản phẩm")
                                    const altParts = alt
                                      ? alt.split(" | ")
                                      : [];
                                    const displayName =
                                      altParts[0] || "Sản phẩm";
                                    const finalProductUrl = altParts[1] || ""; // Lấy link xịn từ alt text

                                    return (
                                      <div className="chat-window__image-container">
                                        <div className="chat-window__image-grid">
                                          <div className="chat-window__image-left" />

                                          <img
                                            className="chat-window__markdown-image"
                                            src={src}
                                            alt={displayName}
                                          />

                                          <div className="chat-window__image-right">
                                            <button
                                              type="button"
                                              className="chat-window__tryon-btn"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                setSelectedProduct({
                                                  imgUrl: src,
                                                  productUrl: finalProductUrl, // Gửi link xịn lên FastAPI
                                                  name: displayName,
                                                });
                                              }}
                                            >
                                              ✨ Thử đồ với Bụt
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  },
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
                                    className?.replace("language-", "") ||
                                    "code";
                                  const text = String(children).replace(
                                    /\n$/,
                                    "",
                                  );
                                  return className ? (
                                    <CodeBlock
                                      code={text}
                                      language={language}
                                    />
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
            </motion.div>
          )}
        </AnimatePresence>

        {viewState === "window-messages" && (
          <ChatInput onSend={onSend} isLoading={isLoading} showDisclaimer />
        )}
      </div>

      {/* Modal hiện lên khi selectedProduct có dữ liệu */}
      {selectedProduct && (
        <TryOnModal
          open={!!selectedProduct}
          onOpenChange={(open) => {
            if (!open) setSelectedProduct(null);
          }}
          productImageUrl={selectedProduct.imgUrl}
          productUrl={selectedProduct.productUrl}
          productName={selectedProduct.name}
        />
      )}
    </>
  );
}
