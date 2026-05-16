# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` / `npm start` — Start Vite dev server with HMR
- `npm run build` — TypeScript check (`tsc -b`) then Vite production build
- `npm run lint` — Run ESLint (flat config format)
- `npm run preview` — Preview production build locally

No test framework is configured.

## Architecture

**Shopping Research Agent** — a chat-based shopping assistant frontend. Users chat with an AI backend that streams responses via SSE and renders interactive UI components (product cards, questionnaires) inline in the conversation.

### Backend Communication

The app talks to a Python backend (default `http://localhost:8000`, configurable via `VITE_API_BASE_URL` env var) using SSE streaming (`@microsoft/fetch-event-source`). Two endpoints:
- `POST /chat` — send a message, receive streaming response
- `GET /chat/history/:sessionId` — fetch past messages

### Chat & Session Flow

Routing: `/` (new session) and `/c/:sessionId` (existing session). `useChatSSE` hook manages the full lifecycle: streaming chunks, accumulating assistant messages, creating sessions on first message, and loading history on navigation. When the backend sends `a2ui_session_init` with a new session ID, the app navigates to `/c/:newId`.

### A2UI System (AI-to-UI)

The backend can send structured payloads alongside text. These are rendered as interactive components inside chat messages via `A2UIRenderer`:
- **a2ui_questionnaire** — multi-choice preference survey
- **a2ui_interactive_product** — product card with accept/reject feedback
- **a2ui_processing_status** — progress indicator
- **a2ui_session_init** — backend signals new session creation
- **a2ui_done** — signals end of A2UI interaction chain

Hidden messages (`sendHiddenMessage`) send user actions (e.g., product feedback) back to the backend without showing a user message bubble.

### State Management

- `ChatContext` (React Context) — shared message state across components
- `useChatSSE` — local state hook for individual chat session (messages, loading, errors, streaming)
- No external state library

### Virtual Try-On

`TryOnModal` component provides webcam-based virtual try-on via MediaPipe pose detection and WebSocket communication with the backend for real-time image processing.

### Key Path Aliases

Configured in both `vite.config.ts` and `tsconfig.app.json`:
`@/` → `src/`, `@components/`, `@services/`, `@utils/`, `@assets/`, `@store/`, `@styles/`, `@types/`

### UI Stack

- **Components**: Radix UI primitives (`src/components/ui/`) + custom components
- **Styling**: Tailwind CSS 4 + SCSS (component-level `.scss` files)
- **Animations**: Motion (Framer Motion)
- **Markdown**: `react-markdown` with `remark-gfm` for assistant message rendering
- **Icons**: `lucide-react`
- **Notifications**: `sonner`

### Component Structure

- `src/components/Sidebar/` — chat session list and navigation
- `src/components/ChatWindow/` — message list with markdown and A2UI rendering
- `src/components/ChatInput/` — message input with send
- `src/components/a2ui/` — AI-driven interactive components (renderer, questionnaire, product card, processing)
- `src/components/TryOnModal/` — virtual try-on modal
- `src/components/ui/` — Radix-based primitive components (shadcn-style)
- `src/components/ActivityMessage/` — activity/status messages

### Type Definitions

- `src/types/chat.types.ts` — `ChatMessage`, `ChatRequest`, `ChatStreamChunk`
- `src/types/a2ui.types.ts` — discriminated union `A2UIPayload` for all A2UI component types
- `src/types/product.types.ts` — `CapturedData` (product data from e-commerce platforms)

### Conventions

- Comments are in Vietnamese (matching the team's language)
- Module type is ESM (`"type": "module"`)
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters` enabled
