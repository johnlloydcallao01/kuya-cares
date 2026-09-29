'use client';

import { useEffect, useState } from 'react';

// "Show All Merchants & Products" search scope.
// Persisted so header dropdown, mobile search modal, and results page agree.
// Default OFF: search stays location-filtered like the rest of the home page.
export const SHOW_ALL_EVENT = 'showAllScopeChanged';
const STORAGE_KEY = 'kuyacares_show_all';

export function getShowAll(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setShowAll(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal: scope just won't persist.
  }
  window.dispatchEvent(new CustomEvent<boolean>(SHOW_ALL_EVENT, { detail: value }));
}

export function useShowAll(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => getShowAll());

  useEffect(() => {
    const handler = (event: Event) => {
      setValue((event as CustomEvent<boolean>).detail ?? getShowAll());
    };
    window.addEventListener(SHOW_ALL_EVENT, handler as EventListener);
    return () => window.removeEventListener(SHOW_ALL_EVENT, handler as EventListener);
  }, []);

  return [value, setShowAll];
}
