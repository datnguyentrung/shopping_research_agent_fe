import ChatInput from "@/components/ChatInput";
import {
  Search,
  Sparkles,
  Wand2,
  Shirt,
} from "lucide-react";
import { motion } from "motion/react";
import type { FC } from "react";
import "./NewChat.scss";

/* ───────── Props ───────── */

interface QuickAction {
  icon: FC<{ className?: string }>;
  title: string;
  description: string;
  prompt: string;
}

interface NewChatProps {
  onQuickAction: (prompt: string) => void;
  onSend: (content: string) => Promise<void>;
  isLoading?: boolean;
}

/* ───────── Quick action data ───────── */

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: Search,
    title: "Smart Product Search",
    description: "Tìm kiếm sản phẩm thông minh theo nhu cầu và ngân sách",
    prompt: "Tìm cho tôi một chiếc áo thun nam chất lượng tốt dưới 500k",
  },
  {
    icon: Wand2,
    title: "Virtual Try-On Experience",
    description: "Trải nghiệm thử đồ trực tuyến bằng AI",
    prompt: "Tôi muốn thử đồ trực tuyến",
  },
  {
    icon: Shirt,
    title: "Outfit Style Guide",
    description: "Gợi ý phối đồ theo phong cách cá nhân",
    prompt: "Gợi ý cho tôi một set đồ đi làm thanh lịch",
  },
];

/* ───────── Animation variants ───────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.25 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

/* ───────── Component ───────── */

const NewChat: FC<NewChatProps> = ({ onQuickAction, onSend, isLoading = false }) => {
  return (
    <div className="new-chat">
      {/* Hero */}
      <motion.div
        className="new-chat__hero"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="new-chat__logo">
          <Sparkles className="new-chat__logo-icon" />
        </div>

        <h1 className="new-chat__title">
          How can I help you shop today?
        </h1>

        <p className="new-chat__subtitle">
          Hỏi tôi bất cứ điều gì về mua sắm — từ tìm kiếm sản phẩm đến gợi ý phối đồ.
        </p>
      </motion.div>

      {/* Chat Input */}
      <div className="new-chat__input-wrap">
        <ChatInput
          onSend={onSend}
          isLoading={isLoading}
          showDisclaimer={false}
        />
      </div>

      {/* Feature Cards */}
      <motion.div
        className="new-chat__cards"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.title}
              className="new-chat__card"
              variants={cardVariants}
              whileHover={{
                y: -4,
                boxShadow: "0 14px 36px rgba(0,0,0,0.08)",
                borderColor: "#d1d5db",
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickAction(action.prompt)}
              type="button"
            >
              <div className="new-chat__card-icon-wrap">
                <Icon className="new-chat__card-icon-svg" />
              </div>
              <div className="new-chat__card-body">
                <span className="new-chat__card-title">{action.title}</span>
                <span className="new-chat__card-desc">{action.description}</span>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

export default NewChat;
