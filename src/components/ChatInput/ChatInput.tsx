import { AudioLines, Mic, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import "./ChatInput.scss";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  isLoading?: boolean;
  showDisclaimer?: boolean;
}

export default function ChatInput({
  onSend,
  isLoading = false,
  showDisclaimer = false,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (message.trim() && !isLoading) {
      await onSend(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 180) + "px";
    }
  };

  const canSend = message.trim().length > 0 && !isLoading;

  return (
    <div className="chat-input">
      <form onSubmit={handleSubmit} className="chat-input__form">
        <div
          className={`chat-input__bar ${
            canSend ? "chat-input__bar--active" : "chat-input__bar--idle"
          }`}
        >
          {/* Left: Plus button */}
          <button type="button" className="chat-input__plus" title="Thêm">
            <Plus className="chat-input__plus-icon" />
          </button>

          {/* Center: Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onInput={handleInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Hỏi bất kỳ điều gì"
            className="chat-input__textarea"
            rows={1}
            style={{ minHeight: "24px", maxHeight: "180px" }}
            disabled={isLoading}
          />

          {/* Right: Mic + Audio */}
          <div className="chat-input__right">
            <button
              type="button"
              className="chat-input__mic"
              title="Giọng nói"
            >
              <Mic className="chat-input__mic-icon" />
            </button>
            {canSend ? (
              <motion.button
                type="submit"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="chat-input__send"
              >
                <AudioLines className="chat-input__send-icon" />
              </motion.button>
            ) : (
              <div className="chat-input__send chat-input__send--disabled">
                <AudioLines className="chat-input__send-icon" />
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Disclaimer — only visible in active chat state */}
      {showDisclaimer && (
      <p className="chat-input__disclaimer">
        AI có thể mắc lỗi. Hãy kiểm tra các thông tin quan trọng. Vui lòng tham khảo Tùy chọn cookie.
      </p>
      )}
    </div>
  );
}
