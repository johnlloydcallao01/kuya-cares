'use client';

import React from 'react';
import { useGoogleMapsPlaces } from '@/hooks/useGoogleMapsPlaces';

interface AddressSearchInputProps {
  placeholder?: string;
  onAddressSelect?: (place: google.maps.places.PlaceResult) => void;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  autoFocus?: boolean;
  fullPage?: boolean; // New prop to render predictions as page content instead of dropdown
}

const LocationIcon = () => (
  <svg
    className="w-4 h-4 text-gray-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

export function AddressSearchInput({
  placeholder = "Search for an address",
  onAddressSelect,
  className = "",
  inputClassName = "",
  dropdownClassName = "",
  autoFocus = false,
  fullPage = false,
}: AddressSearchInputProps) {
  const {
    searchQuery,
    setSearchQuery,
    predictions,
    isLoading,
    isMapsReady,
    selectPlace,
  } = useGoogleMapsPlaces();

  const handleAddressSelect = async (placeId: string) => {
    const place = await selectPlace(placeId);
    if (place && onAddressSelect) {
      onAddressSelect(place);
    }
    // Clear search after selection
    setSearchQuery('');
  };

  return (
    <div className={`${fullPage ? '' : 'relative'} ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={!isMapsReady}
          className={`w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClassName}`}
        />
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <LocationIcon />
        </div>
        {isLoading && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Predictions - Conditional rendering based on fullPage prop */}
      {predictions.length > 0 && (
        fullPage ? (
          // Full page mode - render predictions as regular page content
          <div className="mt-4 space-y-2">
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                onClick={() => handleAddressSelect(prediction.place_id)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border border-gray-200 rounded-lg flex items-center space-x-3"
              >
                <LocationIcon />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {prediction.structured_formatting.main_text}
                  </div>
                  {prediction.structured_formatting.secondary_text && (
                    <div className="text-xs text-gray-500 truncate">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          // Dropdown mode - render predictions in dropdown container
          <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto ${dropdownClassName}`}>
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                onClick={() => handleAddressSelect(prediction.place_id)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0 flex items-center space-x-3"
              >
                <LocationIcon />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {prediction.structured_formatting.main_text}
                  </div>
                  {prediction.structured_formatting.secondary_text && (
                    <div className="text-xs text-gray-500 truncate">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* No results message - Conditional rendering based on fullPage prop */}
      {searchQuery.trim() && predictions.length === 0 && !isLoading && isMapsReady && (
        fullPage ? (
          // Full page mode
          <div className="mt-4 px-4 py-3 text-sm text-gray-500 border border-gray-200 rounded-lg">
            No addresses found for &quot;{searchQuery}&quot;
          </div>
        ) : (
          // Dropdown mode
          <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg ${dropdownClassName}`}>
            <div className="px-4 py-3 text-sm text-gray-500">
              No addresses found for &quot;{searchQuery}&quot;
            </div>
          </div>
        )
      )}

      {/* Loading Google Maps message - Only show if actively loading and user has started typing */}
      {!isMapsReady && searchQuery.trim() && (
        fullPage ? (
          // Full page mode
          <div className="mt-4 px-4 py-3 text-sm text-gray-500 flex items-center space-x-2 border border-gray-200 rounded-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span>Loading address search...</span>
          </div>
        ) : (
          // Dropdown mode
          <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg ${dropdownClassName}`}>
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>Loading address search...</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}