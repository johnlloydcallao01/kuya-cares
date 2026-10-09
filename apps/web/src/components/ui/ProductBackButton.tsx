'use client';

import { useRouter } from 'next/navigation';

export default function ProductBackButton({ fallbackHref }: { fallbackHref?: string }) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (fallbackHref) {
      router.push(fallbackHref as any);
    } else {
      router.push('/' as any);
    }
  };

  return (
    <button
      aria-label="Back"
      className="w-8 h-8 rounded-full bg-white dark:bg-[#1c1c1c] shadow-sm flex items-center justify-center"
      onClick={handleBack}
    >
      <i className="fas fa-arrow-left text-[14px] text-[#333] dark:text-[#e4e4e7]"></i>
    </button>
  );
}
