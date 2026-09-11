'use client';

import React, { useEffect, useState } from 'react';

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * ClientOnly - renders `fallback` on server + first client render,
 * then `children` only after mount. This makes the wrapped subtree
 * effectively CSR, guaranteeing server HTML == hydrated HTML
 * and eliminating React hydration error #441 from:
 * - toLocaleDateString / timezone differences
 * - document.body / createPortal in render
 * - localStorage / navigator / Intl differences
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;

  return <>{children}</>;
}

export default ClientOnly;
