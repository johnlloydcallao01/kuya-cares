import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '../navigation/NavigationContext';
import { useLocalSearchParams } from 'expo-router';
import { useCart } from '../contexts/CartContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { formatCurrency } from '../utils/format';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';

const PAYMONGO_MINIMUM_AMOUNT_PHP = 1;

const MerchantCartSkeleton = () => {
    return (
        <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6' }} />
                <View style={{ width: 120, height: 20, backgroundColor: '#f3f4f6', borderRadius: 4, marginLeft: 12 }} />
            </View>
            {[1, 2, 3].map((i) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 24 }}>
                     <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#f3f4f6' }} />
                     <View style={{ flex: 1, marginLeft: 12 }}>
                         <View style={{ width: '70%', height: 16, backgroundColor: '#f3f4f6', borderRadius: 4, marginBottom: 8 }} />
                         <View style={{ width: '40%', height: 16, backgroundColor: '#f3f4f6', borderRadius: 4 }} />
                     </View>
                </View>
            ))}
        </View>
    );
};

export default function MerchantCartScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const merchantId = typeof params.id === 'string' ? params.id : params.merchantId as string;
  
  const colors = useThemeColors();
  const { getMerchantCart, updateQuantity, removeFromCart, reload, isLoading } = useCart();
  const [refreshing, setRefreshing] = useState(false);

  const merchantCart = getMerchantCart(merchantId);
  const isBelowPayMongoMinimum = Boolean(merchantCart && merchantCart.subtotal < PAYMONGO_MINIMUM_AMOUNT_PHP);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
        await reload();
    } finally {
        setRefreshing(false);
    }
  }, [reload]);

  const showSkeleton = isLoading || refreshing;

  const handleQuantityChange = (itemId: number, newQuantity: number) => {
    updateQuantity(itemId, newQuantity);
  };

  const handleRemoveItem = (itemId: number) => {
    removeFromCart(itemId);
  };

  const handleCheckout = () => {
    if (!merchantId || !merchantCart || merchantCart.subtotal < PAYMONGO_MINIMUM_AMOUNT_PHP) return;
    navigation.navigate('Checkout', { merchantId });
  };

  const headerTitle = merchantCart ? merchantCart.merchantName : 'Cart';

  return (
    <View style={[styles.container, { backgroundColor: '#f9fafb' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff', zIndex: 10 }}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <PullToRefreshLayout
        isRefreshing={refreshing}
        onRefresh={handleRefresh}
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {showSkeleton ? (
            <MerchantCartSkeleton />
        ) : !merchantCart ? (
             <View style={styles.emptyContainer}>
                <Ionicons name="cart-outline" size={64} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.text }]}>Your cart is empty for this merchant</Text>
                <TouchableOpacity 
                    style={[styles.browseButton, { backgroundColor: colors.primary }]}
                    onPress={() => navigation.navigate('Home')}
                >
                    <Text style={styles.browseButtonText}>Browse Restaurants</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <View>
                <View style={styles.merchantSection}>
                    <View style={styles.merchantHeader}>
                        {merchantCart.merchantLogoUrl ? (
                            <Image source={{ uri: merchantCart.merchantLogoUrl }} style={styles.merchantLogo} />
                        ) : (
                            <View style={styles.merchantLogoPlaceholder}>
                                <Ionicons name="storefront" size={20} color="#666" />
                            </View>
                        )}
                        <Text style={styles.merchantName}>{merchantCart.merchantName}</Text>
                    </View>
                    
                    {merchantCart.items.map((item) => (
                        <View key={item.id} style={styles.cartItem}>
                            <View style={styles.itemRow}>
                                {item.imageUrl ? (
                                    <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                                ) : (
                                    <View style={styles.itemImagePlaceholder} />
                                )}
                                <View style={styles.itemDetails}>
                                    <Text style={styles.itemName}>{item.productName}</Text>
                                    <Text style={styles.itemPrice}>{formatCurrency(item.subtotal)}</Text>
                                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                                        <Text style={styles.modifiersText}>
                                            {item.selectedModifiers.map((m: any) => m.name).join(', ')}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            
                            <View style={styles.actionsRow}>
                                <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                                    <Text style={styles.removeText}>Remove</Text>
                                </TouchableOpacity>
                                
                                <View style={styles.quantityControl}>
                                    <TouchableOpacity 
                                        onPress={() => handleQuantityChange(item.id, item.quantity - 1)}
                                        style={styles.qtyButton}
                                    >
                                        <Text style={styles.qtyButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.qtyText}>{item.quantity}</Text>
                                    <TouchableOpacity 
                                        onPress={() => handleQuantityChange(item.id, item.quantity + 1)}
                                        style={styles.qtyButton}
                                    >
                                        <Text style={styles.qtyButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
                
                <View style={styles.summarySection}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(merchantCart.subtotal)}</Text>
                    </View>
                    <View style={[styles.summaryRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 }]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{formatCurrency(merchantCart.subtotal)}</Text>
                    </View>
                </View>

                {isBelowPayMongoMinimum && (
                    <View style={styles.minimumAmountNotice}>
                        <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
                        <Text style={styles.minimumAmountNoticeText}>
                            This cart is below the PayMongo minimum of PHP 1.00. Review the item options or pricing before checkout.
                        </Text>
                    </View>
                )}
            </View>
        )}
      </PullToRefreshLayout>

      {merchantCart && merchantCart.items.length > 0 && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity 
            style={[styles.checkoutButton, isBelowPayMongoMinimum && styles.checkoutButtonDisabled]}
            onPress={handleCheckout}
            disabled={isBelowPayMongoMinimum}
          >
            <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
            <Text style={styles.checkoutTotal}>{formatCurrency(merchantCart.subtotal)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  merchantSection: {
      marginBottom: 24,
  },
  merchantHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
  },
  merchantLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  merchantLogoPlaceholder: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#e0e0e0',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
  },
  merchantName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
  },
  cartItem: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
  },
  itemRow: {
      flexDirection: 'row',
      marginBottom: 12,
  },
  itemImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 12,
  },
  itemImagePlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: '#eee',
      marginRight: 12,
  },
  itemDetails: {
      flex: 1,
      justifyContent: 'center',
  },
  itemName: {
      fontSize: 15,
      fontWeight: '600',
      color: '#333',
      marginBottom: 4,
  },
  itemPrice: {
      fontSize: 14,
      color: '#666',
  },
  modifiersText: {
      fontSize: 12,
      color: '#888',
      marginTop: 2,
  },
  actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: '#f5f5f5',
      paddingTop: 12,
  },
  removeText: {
      color: '#ef4444',
      fontSize: 13,
      fontWeight: '500',
  },
  quantityControl: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f9fafb',
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 4,
  },
  qtyButton: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
  },
  qtyButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
  },
  qtyText: {
      marginHorizontal: 12,
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
  },
  summarySection: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
  },
  summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
  },
  summaryLabel: {
      fontSize: 14,
      color: '#666',
  },
  summaryValue: {
      fontSize: 14,
      fontWeight: '500',
      color: '#333',
  },
  totalLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
  },
  totalValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
  },
  minimumAmountNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: '#FFF7ED',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#FDBA74',
      padding: 12,
      marginBottom: 24,
  },
  minimumAmountNoticeText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: '#9A3412',
      fontWeight: '500',
  },
  footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
  },
  checkoutButton: {
      backgroundColor: '#f3a823',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: 30,
  },
  checkoutButtonDisabled: {
      opacity: 0.6,
  },
  checkoutButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
  },
  checkoutTotal: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
  }
});
