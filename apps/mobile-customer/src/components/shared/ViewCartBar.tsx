import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { formatCurrency } from '../../utils/format';

type ViewCartBarProps = {
  itemCount: number;
  subtotal: number;
  onPress: () => void;
  paddingBottom: number;
};

export default function ViewCartBar({
  itemCount,
  subtotal,
  onPress,
  paddingBottom,
}: ViewCartBarProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.viewCartContainer, { paddingBottom }]}>
      <TouchableOpacity
        style={[styles.viewCartButton, { backgroundColor: colors.primary }]}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={styles.viewCartLeft}>
          <View style={styles.cartCountBadge}>
            <Text style={styles.cartCountText}>{itemCount}</Text>
          </View>
          <Text style={styles.viewCartText}>View your cart</Text>
        </View>
        <Text style={styles.cartTotalText}>{formatCurrency(subtotal)}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  viewCartContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    zIndex: 1000,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 20,
  },
  viewCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  viewCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartCountBadge: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  cartCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  viewCartText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartTotalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
