'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  className?: string;
}

/**
 * Back button component that navigates to the previous page
 */
export function BackButton({ className = '' }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <button 
      onClick={handleBack}
      className={`p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-all duration-200 group ${className}`}
      aria-label="Go back"
    >
      <svg 
        className="w-6 h-6 text-white group-hover:text-white/90 transition-colors" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}