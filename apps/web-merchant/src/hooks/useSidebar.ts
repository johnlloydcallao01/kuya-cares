import { useState, useCallback } from 'react';

/**
 * Custom hook for managing sidebar state
 * 
 * @param initialState - Initial state of the sidebar (open/closed)
 * @returns Object with isOpen state and toggle function
 */
export function useSidebar(initialState: boolean = true) {
  const [isOpen, setIsOpen] = useState(initialState);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    toggle,
  };
}
