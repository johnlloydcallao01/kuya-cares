import { useState, useCallback } from 'react';

/**
 * Custom hook for managing category selection state
 * 
 * @param initialCategory - Initial selected category (default: "All")
 * @returns Object containing category state and selection function
 */
export function useCategory(initialCategory: string = "All") {
  const [activeCategory, setActiveCategory] = useState(initialCategory);

  const selectCategory = useCallback((category: string) => {
    setActiveCategory(category);
  }, []);

  return {
    activeCategory,
    selectCategory
  };
}
