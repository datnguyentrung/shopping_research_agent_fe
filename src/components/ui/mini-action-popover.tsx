import { EllipsisVertical } from "lucide-react";
import { useState, type MouseEvent } from "react";
import styles from "./mini-action-popover.module.scss";
import { showComingSoonActionToast } from "./mini-action-popover.toast";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

type ActionItem = {
  id: string;
  label: string;
  icon?: React.ElementType;
  isDanger?: boolean;
};
type SeparatorItem = { id: "__separator__" };
type PopoverActionItem = ActionItem | SeparatorItem;

interface MiniActionPopoverProps {
  itemLabel?: string;
  actions: ReadonlyArray<ActionItem | SeparatorItem | null | undefined>;
  onActionSelect?: (actionId: string) => void;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  title?: string;
  children?: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function MiniActionPopover({
  itemLabel,
  actions,
  onActionSelect,
  triggerClassName,
  contentClassName,
  disabled,
  title,
  children,
  side = "right",
  align = "end",
  sideOffset = 6,
}: MiniActionPopoverProps) {
  const [open, setOpen] = useState(false);

  const resolvedActions =
    actions
      ?.filter((action): action is PopoverActionItem => !!action)
      .map((action) =>
        "label" in action
          ? {
              id: action.id,
              label: action.label,
              icon: action.icon,
              isDanger: action.isDanger,
            }
          : { id: "__separator__" as const },
      ) ?? [];

  const handleActionClick = (
    event: MouseEvent<HTMLButtonElement>,
    actionId: string,
    actionLabel: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (onActionSelect) {
      onActionSelect(actionId);
      setOpen(false);
      return;
    }

    showComingSoonActionToast(actionLabel, itemLabel);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={title}
          className={cn(
            styles.triggerBtn,
            children ? styles.triggerInline : "",
            triggerClassName,
          )}
          aria-label="Mo thao tac"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();

            if (disabled) {
              event.preventDefault();
            }
          }}
        >
          {children ?? <EllipsisVertical size={14} />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        avoidCollisions
        className={cn(styles.popoverContent, contentClassName)}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className={styles.actionList}>
          {resolvedActions.map((item, index) =>
            !("label" in item) ? (
              <div key={`separator-${index}`} className={styles.separator} />
            ) : (
              (() => {
                const actionItem = item as ActionItem;
                const ActionIcon = actionItem.icon;
                return (
                  <button
                    key={actionItem.id}
                    type="button"
                    className={cn(
                      styles.actionBtn,
                      actionItem.isDanger ? styles.actionBtnDanger : "",
                    )}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) =>
                      handleActionClick(event, actionItem.id, actionItem.label)
                    }
                  >
                    {ActionIcon ? (
                      <ActionIcon size={14} className={styles.actionIcon} />
                    ) : null}
                    <span>{actionItem.label}</span>
                  </button>
                );
              })()
            ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
