"use client";

import type { Column } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";

// Right-click only, deliberately — a plain left click used to silently flip
// the sort order and repeatedly wrecked whatever view someone was mid-task
// on. This is the anchor + menu; the parent table owns which column (if
// any) currently has it open and wires a right-click handler to it.
export function ColumnSortMenu<TData>({
  column,
  open,
  onOpenChange,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Column<TData, any>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sorted = column.getIsSorted();
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <span className="text-muted-foreground" onClick={(e) => e.stopPropagation()}>
            {sorted === "asc" ? (
              <ArrowUp className="size-3" />
            ) : sorted === "desc" ? (
              <ArrowDown className="size-3" />
            ) : (
              <ArrowUpDown className="size-3 opacity-40" />
            )}
          </span>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
          <ArrowUp className="size-3.5" />
          Sort ascending
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
          <ArrowDown className="size-3.5" />
          Sort descending
        </DropdownMenuItem>
        {sorted && (
          <DropdownMenuItem onClick={() => column.clearSorting()}>
            <X className="size-3.5" />
            Clear sort
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
