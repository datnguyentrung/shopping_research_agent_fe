import type { ComponentType, ReactNode, SVGProps } from "react";

import "./AiStylistNote.scss";

interface AiStylistNoteProps {
  isTyping: boolean;
  isLoading: boolean;
  reasonText: string;
  typedReason: string;
  renderHighlightedReason: (text: string) => ReactNode;
  SparkleIcon: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function AiStylistNote({
  isTyping,
  isLoading,
  reasonText,
  typedReason,
  renderHighlightedReason,
  SparkleIcon,
}: AiStylistNoteProps) {
  return (
    <section className="mpv-zone mpv-center" aria-label="AI Stylist Note">
      <div className="mpv-card mpv-ai-note" data-typing={isTyping}>
        <div className="mpv-ai-header">
          <span
            className="mpv-ai-icon"
            data-animate={isTyping}
            aria-hidden="true"
          >
            <SparkleIcon />
          </span>
          <div className="mpv-ai-heading">
            <span className="mpv-ai-title">AI Stylist Note</span>
            <span className="mpv-ai-subtitle">Khuyên dùng</span>
          </div>
        </div>

        <div className="mpv-ai-body" aria-live="polite">
          <span className="mpv-ai-kicker">AI Stylist Insight</span>
          {isLoading ? (
            <p className="mpv-ai-text mpv-ai-text--muted">
              AI đang phân tích để đưa ra lời khuyên phù hợp...
            </p>
          ) : reasonText ? (
            <p className="mpv-ai-text">
              {typedReason.length === 0 && isTyping
                ? "AI đang soạn ghi chú..."
                : renderHighlightedReason(typedReason || reasonText)}
              {isTyping && (
                <span className="mpv-typing-caret" aria-hidden="true" />
              )}
            </p>
          ) : (
            <p className="mpv-ai-text mpv-ai-text--muted">
              AI sẽ ghi chú sau khi có sản phẩm phù hợp.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
