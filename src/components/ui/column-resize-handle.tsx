"use client";

import { cn } from "@/lib/utils";

export function ColumnResizeHandle({
  onMouseDown,
  className,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => e.preventDefault()}
      draggable={false}
      className={cn(
        "absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none select-none",
        "after:absolute after:right-[3px] after:top-0 after:h-full after:w-px after:bg-border",
        "hover:after:bg-primary/60 active:after:bg-primary",
        className
      )}
    />
  );
}
