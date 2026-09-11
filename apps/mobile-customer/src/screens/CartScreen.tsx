import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart, MerchantCartSummary } from '../contexts/CartContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { formatCurrency } from '../utils/format';
import { useNavigation } from '../navigation/NavigationContext';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';

const CartSkeleton = () => {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      {[1, 2].map((i) => (
        <View key={i} style={{ 
          backgroundColor: '#fff', 
          borderRadius: 16, 
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6' }} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <View style={{ width: '60%', height: 16, backgroundColor: '#f3f4f6', borderRadius: 4, marginBottom: 4 }} />
              <View style={{ width: '40%', height: 12, backgroundColor: '#f3f4f6', borderRadius: 4 }} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
             <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#f3f4f6' }} />
             <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#f3f4f6' }} />
          </View>
          <View style={{ height: 1, backgroundColor: '#f3f4f6', marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
             <View style={{ width: 60, height: 16, backgroundColor: '#f3f4f6', borderRadius: 4 }} />
             <View style={{ width: 80, height: 16, backgroundColor: '#f3f4f6', borderRadius: 4 }} />
          </View>
          <View style={{ height: 40, borderRadius: 20, backgroundColor: '#f3f4f6' }} />
        </View>
      ))}
    </View>
  );
};

export default function CartScreen() {
  const navigation = useNavigation();
  const { getAllMerchantCarts, removeFromCart, reload, isLoading } = useCart();
  const colors = useThemeColors();
  const merchantCarts = getAllMerchantCarts();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCart, setSelectedCart] = useState<MerchantCartSummary | null>(null);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  // Consistent with the Home/Wishlist pattern: show the skeleton on initial load
  // AND during pull-to-refresh, so the refetch is visible (pull-to-refresh.md Pattern B)
  const showSkeleton = isLoading || refreshing;

  const handleMerchantPress = (merchantId: string) => {
    navigation.navigate('MerchantCart', { merchantId });
  };

  const closeOptionsModal = useCallback(() => {
    setIsOptionsModalVisible(false);
    setSelectedCart(null);
  }, []);

  const handleMoreOptions = (cart: MerchantCartSummary) => {
      setSelectedCart(cart);
      setIsOptionsModalVisible(true);
  };

  const handleAddMoreItems = useCallback(() => {
    if (!selectedCart) return;
    closeOptionsModal();
    navigation.navigate('Merchant', { merchantId: selectedCart.merchantId });
  }, [closeOptionsModal, navigation, selectedCart]);

  const handleDeleteCart = useCallback(() => {
    if (!selectedCart) return;
    selectedCart.items.forEach((item) => removeFromCart(item.id));
    closeOptionsModal();
  }, [closeOptionsModal, removeFromCart, selectedCart]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Carts</Text>
          <Text style={styles.headerCount}>{merchantCarts.length} carts</Text>
        </View>
      </SafeAreaView>

      <PullToRefreshLayout 
        isRefreshing={refreshing} 
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContent}
      >
        {showSkeleton ? (
          <CartSkeleton />
        ) : merchantCarts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Image 
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/11329/11329060.png' }} 
              style={{ width: 120, height: 120, marginBottom: 24, opacity: 0.5 }}
            />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>
              Looks like you haven&apos;t added anything to your cart yet.
            </Text>
            <TouchableOpacity
              style={[styles.shopButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {merchantCarts.map((cart) => (
              <View
                key={cart.merchantId}
                style={styles.cartCard}
              >
                {/* Merchant Header */}
                <View style={styles.merchantHeader}>
                  <View style={styles.merchantInfo}>
                    {cart.merchantLogoUrl ? (
                      <Image source={{ uri: cart.merchantLogoUrl }} style={styles.merchantLogo} />
                    ) : (
                      <View style={[styles.merchantLogo, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#6B7280' }}>
                          {cart.merchantName.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.merchantName}>{cart.merchantName}</Text>
                      {/* Placeholder for delivery info to match screenshot style */}
                      <Text style={styles.deliveryInfo}>
                        10-25 mins • <Text style={{ color: '#E11D48', fontWeight: '500' }}>Free</Text>
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                      onPress={() => handleMoreOptions(cart)}
                      style={{ padding: 4 }}
                  >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Items Row */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.itemsRow}
                >
                  {cart.items.map((item) => (
                    <View key={item.id} style={styles.itemWrapper}>
                      <Image
                        source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }}
                        style={styles.itemImage}
                      />
                      {item.quantity > 1 && (
                        <View style={styles.quantityBadge}>
                          <Text style={styles.quantityText}>{item.quantity}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  
                  {/* Add Button */}
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={() => navigation.navigate('Merchant', { merchantId: cart.merchantId })}
                  >
                    <Ionicons name="add" size={20} color="#374151" />
                  </TouchableOpacity>
                </ScrollView>

                <View style={styles.divider} />

                {/* Subtotal */}
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Subtotal</Text>
                  <Text style={styles.subtotalValue}>{formatCurrency(cart.subtotal || 0)}</Text>
                </View>

                {/* View Cart Button */}
                <TouchableOpacity
                  style={styles.viewCartButton}
                  onPress={() => handleMerchantPress(cart.merchantId)}
                >
                  <Text style={styles.viewCartText}>View your cart</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </PullToRefreshLayout>

      <Modal
        visible={isOptionsModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeOptionsModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeOptionsModal} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalBrandBadge}>
                {selectedCart?.merchantLogoUrl ? (
                  <Image source={{ uri: selectedCart.merchantLogoUrl }} style={styles.modalBrandImage} />
                ) : (
                  <Ionicons name="storefront-outline" size={18} color="#374151" />
                )}
              </View>
              <Text style={styles.modalTitle}>{selectedCart?.merchantName || 'Cart options'}</Text>
              <Text style={styles.modalSubtitle}>
                Choose what you want to do with this cart.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionCard, styles.modalActionPrimary]}
                activeOpacity={0.9}
                onPress={handleAddMoreItems}
              >
                <View style={[styles.modalActionIconWrap, styles.modalActionIconPrimary]}>
                  <Ionicons name="add-circle-outline" size={20} color="#B45309" />
                </View>
                <View style={styles.modalActionContent}>
                  <Text style={styles.modalActionTitle}>Add more items</Text>
                  <Text style={styles.modalActionDescription}>
                    Go back to the merchant page and keep building this order.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionCard, styles.modalActionDanger]}
                activeOpacity={0.9}
                onPress={handleDeleteCart}
              >
                <View style={[styles.modalActionIconWrap, styles.modalActionIconDanger]}>
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </View>
                <View style={styles.modalActionContent}>
                  <Text style={styles.modalActionTitle}>Delete cart</Text>
                  <Text style={styles.modalActionDescription}>
                    Remove all items from this merchant cart.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancelButton}
              activeOpacity={0.85}
              onPress={closeOptionsModal}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  headerCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 40,
    lineHeight: 24,
  },
  shopButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  merchantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  merchantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  merchantLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  deliveryInfo: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingRight: 16,
  },
  itemWrapper: {
    position: 'relative',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  quantityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    paddingHorizontal: 4,
  },
  quantityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subtotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  subtotalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
  },
  viewCartButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  viewCartText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.32)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 18,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginBottom: 18,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalBrandBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  modalBrandImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalActions: {
    gap: 12,
    marginBottom: 16,
  },
  modalActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalActionPrimary: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  modalActionDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  modalActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalActionIconPrimary: {
    backgroundColor: '#FEF3C7',
  },
  modalActionIconDanger: {
    backgroundColor: '#FEE2E2',
  },
  modalActionContent: {
    flex: 1,
    marginRight: 12,
  },
  modalActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalActionDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  modalCancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
});
