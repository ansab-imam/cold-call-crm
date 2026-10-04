"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Lets a link like /pipeline?lead=<id> open that lead's detail panel on
// arrival — used by the universal search bar to jump straight to a result
// from anywhere in the app, then cleans the param off the URL.
export function useOpenLeadFromQuery(
  leads: { id: string }[],
  setOpenLeadId: (id: string) => void
) {
  const searchParams = useSearchParams();
  const router = useRouter();

  React.useEffect(() => {
    const id = searchParams.get("lead");
    if (!id) return;
    if (!leads.some((l) => l.id === id)) return;
    setOpenLeadId(id);
    const params = new URLSearchParams(searchParams);
    params.delete("lead");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);
}
