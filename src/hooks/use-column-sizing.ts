"use client";

import * as React from "react";
import { usePersistedState } from "./use-persisted-state";

const MIN_WIDTH = 60;
const MAX_WIDTH = 640;

// Excel-style drag-to-resize for table columns, remembered per browser the
// same way column order/visibility already are. Independent of any table
// library so it works the same on TanStack-table-backed grids and the
// hand-rolled ones alike — a column's width is just a number keyed by id.
export function useColumnSizing(
  storageKey: string,
  defaultSizes: Record<string, number>
) {
  const [sizes, setSizes] = usePersistedState<Record<string, number>>(
    storageKey,
    defaultSizes
  );
  const dragRef = React.useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  const getWidth = React.useCallback(
    (columnId: string) => sizes[columnId] ?? defaultSizes[columnId] ?? 140,
    [sizes, defaultSizes]
  );

  const startResize = React.useCallback(
    (columnId: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        id: columnId,
        startX: e.clientX,
        startWidth: sizes[columnId] ?? defaultSizes[columnId] ?? 140,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function onMouseMove(ev: MouseEvent) {
        const drag = dragRef.current;
        if (!drag) return;
        const next = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, drag.startWidth + (ev.clientX - drag.startX))
        );
        setSizes((prev) => ({ ...prev, [drag.id]: next }));
      }
      function onMouseUp() {
        dragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [sizes, defaultSizes, setSizes]
  );

  const resetWidths = React.useCallback(() => setSizes(defaultSizes), [defaultSizes, setSizes]);

  return { getWidth, startResize, resetWidths };
}
