
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'Price varies';
  // Use en-PH for Philippine Peso
  // Note: Intl.NumberFormat might not be fully supported on all Android versions without polyfill, 
  // but usually works on modern RN. If issues arise, a simple replacement can be used.
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    // Fallback for older environments
    return `₱${value.toFixed(2)}`;
  }
};
