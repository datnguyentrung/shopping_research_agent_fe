import {
  Shirt,
  Search,
  Sparkles,
  Wand2,
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
}

/* ───────── Dữ liệu gợi ý ───────── */

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

/* ───────── Animation Variants ───────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.35,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

/* ───────── Component ───────── */

const NewChat: FC<NewChatProps> = ({ onQuickAction }) => {
  return (
    <div className="new-chat">
      {/* Hero Section */}
      <motion.div
        className="new-chat__hero"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="new-chat__icon-wrapper">
          <Sparkles className="new-chat__icon" />
        </div>

        <h1 className="new-chat__title">
          How can I help you shop today?
        </h1>

        <p className="new-chat__subtitle">
          Hỏi tôi bất cứ điều gì về mua sắm — từ tìm kiếm sản phẩm đến gợi ý phối đồ.
        </p>
      </motion.div>

      {/* Quick Action Cards */}
      <motion.div
        className="new-chat__actions"
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
              whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(37,99,235,0.10)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickAction(action.prompt)}
              type="button"
            >
              <div className="new-chat__card-icon">
                <Icon className="new-chat__card-icon-svg" />
              </div>
              <span className="new-chat__card-title">{action.title}</span>
              <span className="new-chat__card-desc">{action.description}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

export default NewChat;
