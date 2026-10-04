"use client";

import * as React from "react";

// Drag-to-reorder columns, remembered per browser (localStorage) so it
// sticks around next time — not shared between people, just a per-viewer
// convenience, same as column visibility already is in practice.
export function useColumnOrder(storageKey: string, defaultOrder: string[]) {
  const [columnOrder, setColumnOrderState] = React.useState<string[]>(defaultOrder);
  const draggedId = React.useRef<string | null>(null);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed: string[] = JSON.parse(stored);
      const known = new Set(defaultOrder);
      const kept = parsed.filter((id) => known.has(id));
      const missing = defaultOrder.filter((id) => !kept.includes(id));
      // localStorage only exists client-side, so this can't be read during
      // the initial render (would mismatch SSR) — has to happen in an
      // effect, same documented exception as next-themes' mount flag.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setColumnOrderState([...kept, ...missing]);
    } catch {
      // Corrupt/blocked storage — just fall back to the default order.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setColumnOrder = React.useCallback(
    (next: string[]) => {
      setColumnOrderState(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Private browsing / storage disabled — reordering still works for
        // this session, it just won't be remembered next time.
      }
    },
    [storageKey]
  );

  function handleDragStart(id: string) {
    draggedId.current = id;
  }

  function handleDrop(targetId: string) {
    const from = draggedId.current;
    draggedId.current = null;
    if (!from || from === targetId) return;
    const next = [...columnOrder];
    const fromIdx = next.indexOf(from);
    const toIdx = next.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, from);
    setColumnOrder(next);
  }

  return { columnOrder, setColumnOrder, handleDragStart, handleDrop };
}
