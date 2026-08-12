"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ToastState {
  msg: string;
  type: string;
}

/** Small self-clearing toast used across all three pages. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, type = "") => {
    setToast({ msg, type });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const el = toast ? (
    <div className={"toast show " + toast.type} role="status">
      {toast.msg}
    </div>
  ) : null;

  return { show, el };
}
