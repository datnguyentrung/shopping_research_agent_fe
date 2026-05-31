import type { ComponentType, SVGProps } from "react";

import type { ProductCategory } from "../../../../types/recommendation.types";
import "./ModeSidebar.scss";

type Mode = "cart" | "tryon";

type FilterItem = {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

interface ModeSidebarProps {
  mode: Mode;
  resolvedCartCount: number;
  showFilters: boolean;
  productCategory: ProductCategory | null;
  onSelectMode: (mode: Mode) => void;
  onSelectCategory: (category: ProductCategory) => void;
  filterItems: FilterItem[];
  SparkleIcon: ComponentType<SVGProps<SVGSVGElement>>;
  CartIcon: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function ModeSidebar({
  mode,
  resolvedCartCount,
  showFilters,
  productCategory,
  onSelectMode,
  onSelectCategory,
  filterItems,
  SparkleIcon,
  CartIcon,
}: ModeSidebarProps) {
  return (
    <aside
      className="mpv-zone mpv-sidebar"
      aria-label="Chế độ hiển thị và bộ lọc"
    >
      <div
        className="mpv-mode-switch"
        data-mode={mode}
        role="group"
        aria-label="Chế độ hiển thị"
      >
        <button
          className="mpv-mode-option"
          type="button"
          data-active={mode === "cart"}
          aria-pressed={mode === "cart"}
          onClick={() => onSelectMode("cart")}
        >
          {mode === "cart" && (
            <span className="mpv-mode-icon" aria-hidden="true">
              <SparkleIcon />
            </span>
          )}
          {mode === "tryon" && <span className="mpv-mode-label">Giỏ hàng</span>}
        </button>
        <button
          className="mpv-mode-option"
          type="button"
          data-active={mode === "tryon"}
          aria-pressed={mode === "tryon"}
          onClick={() => onSelectMode("tryon")}
        >
          {mode === "tryon" && (
            <span className="mpv-mode-icon" aria-hidden="true">
              <CartIcon />
              {resolvedCartCount > 0 ? (
                <span className="mpv-mode-badge" aria-hidden="true">
                  {resolvedCartCount}
                </span>
              ) : null}
            </span>
          )}
          {mode === "cart" && <span className="mpv-mode-label">Thử đồ</span>}
        </button>
        <span className="mpv-mode-indicator" aria-hidden="true" />
      </div>

      {showFilters && (
        <div className="mpv-filter-stack">
          {filterItems.map((filter) => {
            const isActive = filter.id === productCategory;

            return (
              <div className="mpv-filter-item" key={filter.id}>
                <button
                  className="mpv-filter-btn"
                  type="button"
                  data-active={isActive}
                  aria-pressed={isActive}
                  aria-label={`Danh mục ${filter.label}`}
                  onClick={() => onSelectCategory(filter.id as ProductCategory)}
                >
                  <filter.Icon className="mpv-filter-icon" aria-hidden="true" />
                </button>
                <span className="mpv-filter-label">{filter.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
