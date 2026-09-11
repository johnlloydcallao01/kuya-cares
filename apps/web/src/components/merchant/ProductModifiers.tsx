'use client';

import React from 'react';
import { ModifierGroup } from '@/types/product';

interface ProductModifiersProps {
  modifierGroups: ModifierGroup[];
  selected: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
}

export default function ProductModifiers({ modifierGroups, selected, onChange }: ProductModifiersProps) {
  if (!modifierGroups || modifierGroups.length === 0) return null;

  const handleOptionToggle = (group: ModifierGroup, optionId: string, checked: boolean) => {
    const current = selected[group.id] || [];
    let nextGroup: string[] = current;

    if (group.selection_type === 'single') {
      nextGroup = checked ? [optionId] : [];
    } else {
      if (checked) {
        if (current.includes(optionId)) {
          nextGroup = current;
        } else {
          const base = [...current, optionId];
          const max = typeof group.max_selections === 'number' ? group.max_selections : undefined;
          if (max != null && base.length > max) {
            return;
          }
          nextGroup = base;
        }
      } else {
        nextGroup = current.filter((id) => id !== optionId);
      }
    }

    const nextState: Record<string, string[]> = { ...selected, [group.id]: nextGroup };
    if (nextGroup.length === 0) {
      delete nextState[group.id];
    }
    onChange(nextState);
  };

  return (
    <div className="mt-8 space-y-8">
      {modifierGroups.map((group) => {
        const selectedIds = selected[group.id] || [];
        return (
          <div key={group.id} className="border-t border-gray-100 pt-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                <div className="flex gap-2 mt-1">
                  {group.is_required ? (
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      Required
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      Optional
                    </span>
                  )}
                  {group.selection_type === 'multiple' && (
                    <span className="text-xs text-gray-500">
                      {group.min_selections > 0 ? `Select at least ${group.min_selections}` : ''}
                      {group.max_selections ? ` (Max ${group.max_selections})` : ''}
                    </span>
                  )}
                  {group.selection_type === 'single' && (
                    <span className="text-xs text-gray-500">Select 1</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {group.options?.map((option) => {
                const isChecked = selectedIds.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      !option.is_available
                        ? 'bg-gray-50 border-gray-100 cursor-not-allowed'
                        : 'border-gray-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type={group.selection_type === 'single' ? 'radio' : 'checkbox'}
                        name={`group-${group.id}`}
                        className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        disabled={!option.is_available}
                        checked={isChecked}
                        onChange={(e) => handleOptionToggle(group, option.id, e.target.checked)}
                      />
                      <span
                        className={`font-medium ${
                          !option.is_available ? 'text-gray-400' : 'text-gray-700'
                        }`}
                      >
                        {option.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {option.price_adjustment > 0 && (
                        <span className="text-sm font-medium text-gray-900">
                          +₱{option.price_adjustment.toFixed(2)}
                        </span>
                      )}
                      {!option.is_available && (
                        <span className="text-xs text-red-500 font-medium">Unavailable</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
