import { useState, useCallback } from 'react';

/**
 * Custom hook for managing sidebar state
 * 
 * @param initialState - Initial sidebar open state (default: true)
 * @returns Object containing sidebar state and toggle function
 */
export function useSidebar(initialState: boolean = true) {
  const [isOpen, setIsOpen] = useState(initialState);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    toggle,
    open,
    close
  };
}
