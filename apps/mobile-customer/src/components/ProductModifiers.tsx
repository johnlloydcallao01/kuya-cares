import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModifierGroup } from '../types/product';

interface ProductModifiersProps {
  modifierGroups: ModifierGroup[];
  selected: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
}

export default function ProductModifiers({ modifierGroups, selected, onChange }: ProductModifiersProps) {
  if (!modifierGroups || modifierGroups.length === 0) return null;

  const getSelectionHint = (group: ModifierGroup): string => {
    if (group.selection_type === 'single') {
      return group.is_required ? 'Select 1' : 'Optional';
    }

    if (group.is_required) {
      const minText = group.min_selections > 0 ? `Select at least ${group.min_selections}` : 'Select options';
      return group.max_selections ? `${minText} (Max ${group.max_selections})` : minText;
    }

    if (group.min_selections > 0) {
      return group.max_selections
        ? `Optional, but choose at least ${group.min_selections} if selecting (Max ${group.max_selections})`
        : `Optional, but choose at least ${group.min_selections} if selecting`;
    }

    return group.max_selections ? `Optional (Max ${group.max_selections})` : 'Optional';
  };

  const handleOptionToggle = (group: ModifierGroup, optionId: string) => {
    const current = selected[group.id] || [];
    const isChecked = current.includes(optionId);
    let nextGroup: string[] = current;

    if (group.selection_type === 'single') {
      // Radio toggle: selecting an already-chosen option deselects it (matches
      // the web implementation), so optional single-select groups can be cleared.
      nextGroup = isChecked ? [] : [optionId];
    } else {
      if (!isChecked) {
        // Add
        const base = [...current, optionId];
        const max = typeof group.max_selections === 'number' ? group.max_selections : undefined;
        if (max != null && base.length > max) {
          return; // Max reached
        }
        nextGroup = base;
      } else {
        // Remove
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
    <View style={styles.container}>
      {modifierGroups.map((group) => {
        const selectedIds = selected[group.id] || [];
        
        return (
          <View key={group.id} style={styles.groupContainer}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{group.name}</Text>
              <View style={styles.badgesContainer}>
                {group.is_required ? (
                  <View style={[styles.badge, styles.requiredBadge]}>
                    <Text style={styles.requiredText}>Required</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.optionalBadge]}>
                    <Text style={styles.optionalText}>Optional</Text>
                  </View>
                )}
                {group.selection_type === 'multiple' && (
                  <Text style={styles.selectionText}>{getSelectionHint(group)}</Text>
                )}
                {group.selection_type === 'single' && (
                  <Text style={styles.selectionText}>{getSelectionHint(group)}</Text>
                )}
              </View>
            </View>

            <View style={styles.optionsList}>
              {group.options?.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                const isAvailable = option.is_available;

                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                      !isAvailable && styles.optionRowDisabled
                    ]}
                    onPress={() => isAvailable && handleOptionToggle(group, option.id)}
                    disabled={!isAvailable}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      <View style={[
                        styles.checkbox,
                        group.selection_type === 'single' && styles.radio,
                        isSelected && styles.checkboxSelected,
                        !isAvailable && styles.checkboxDisabled
                      ]}>
                        {isSelected && (
                          group.selection_type === 'single' ? (
                            <View style={styles.radioInner} />
                          ) : (
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                          )
                        )}
                      </View>
                      <Text style={[
                        styles.optionName,
                        !isAvailable && styles.optionNameDisabled
                      ]}>
                        {option.name}
                      </Text>
                    </View>
                    {option.price_adjustment > 0 && (
                      <Text style={styles.priceAdjustment}>
                        +₱{option.price_adjustment.toFixed(2)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  groupContainer: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 24,
  },
  groupHeader: {
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  requiredBadge: {
    backgroundColor: '#FEF2F2',
  },
  optionalBadge: {
    backgroundColor: '#F3F4F6',
  },
  requiredText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },
  optionalText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  selectionText: {
    fontSize: 12,
    color: '#6B7280',
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },
  optionRowSelected: {
    borderColor: '#eba236',
    backgroundColor: '#FFF9F0',
  },
  optionRowDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    borderRadius: 10,
  },
  checkboxSelected: {
    backgroundColor: '#eba236',
    borderColor: '#eba236',
  },
  checkboxDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#E5E7EB',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
  },
  optionName: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  optionNameDisabled: {
    color: '#9CA3AF',
  },
  priceAdjustment: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
});
