"use client";

import * as React from "react";

// Generic per-browser persistence for small UI preferences (column
// visibility, etc.) — remembered across reloads and deploys alike, since
// it lives in the browser, not on the server.
export function usePersistedState<T>(
  storageKey: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = React.useState<T>(defaultValue);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) {
        // Reading persisted UI state can only happen client-side, so this
        // has to run in an effect — same documented exception used for
        // next-themes' mount flag elsewhere in this app.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(stored));
      }
    } catch {
      // Corrupt/blocked storage — keep the default.
    }
  }, [storageKey]);

  const setPersistedValue = React.useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (update) => {
      setValue((prev) => {
        const next = typeof update === "function" ? (update as (p: T) => T)(prev) : update;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Private browsing / storage disabled — still works for this session.
        }
        return next;
      });
    },
    [storageKey]
  );

  return [value, setPersistedValue];
}
