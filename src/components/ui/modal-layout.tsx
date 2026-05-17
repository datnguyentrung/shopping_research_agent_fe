import { X } from "lucide-react";
import {
  useEffect,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import styles from "./modal-layout.module.scss";
import { cn } from "./utils";

type ModalLayoutProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  withSurface?: boolean;
  maxWidth?: number | string;
  overlayClassName?: string;
  dialogClassName?: string;
  surfaceClassName?: string;
  bodyClassName?: string;
};

function toCssMaxWidth(value: number | string | undefined): string | undefined {
  if (typeof value === "number") {
    return `${value}px`;
  }

  return value;
}

export function ModalLayout({
  open,
  onClose,
  children,
  title,
  subtitle,
  footer,
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  withSurface = true,
  maxWidth = 960,
  overlayClassName,
  dialogClassName,
  surfaceClassName,
  bodyClassName,
}: ModalLayoutProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnEscape, onClose, open]);

  if (!open) {
    return null;
  }

  const dialogStyle: CSSProperties = {
    maxWidth: toCssMaxWidth(maxWidth),
  };

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) {
      return;
    }

    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className={cn(styles.overlay, overlayClassName)}
      onMouseDown={handleBackdropMouseDown}
      aria-hidden={false}
    >
      <section
        className={cn(styles.dialog, dialogClassName)}
        style={dialogStyle}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle — visible on mobile, hidden on desktop */}
        <div className={styles.handle} aria-hidden="true">
          <div className={styles.handleBar} />
        </div>

        {withSurface ? (
          <div className={cn(styles.surface, surfaceClassName)}>
            {(title || subtitle || showCloseButton) && (
              <header className={styles.header}>
                <div>
                  {title ? <h2 className={styles.title}>{title}</h2> : null}
                  {subtitle ? (
                    <p className={styles.subtitle}>{subtitle}</p>
                  ) : null}
                </div>
                {showCloseButton ? (
                  <button
                    type="button"
                    className={styles.closeBtn}
                    aria-label="Đóng"
                    onClick={onClose}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </header>
            )}

            <div className={cn(styles.body, bodyClassName)}>{children}</div>

            {footer ? (
              <footer className={styles.footer}>{footer}</footer>
            ) : null}
          </div>
        ) : (
          children
        )}
      </section>
    </div>,
    document.body,
  );
}
