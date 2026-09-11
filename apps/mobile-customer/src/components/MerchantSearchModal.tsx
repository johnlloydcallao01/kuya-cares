import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MerchantProductDisplay, MerchantCategoryDisplay } from '@encreasl/client-services';
import { formatCurrency } from '../utils/format';

interface Props {
  visible: boolean;
  onClose: () => void;
  products: MerchantProductDisplay[];
  categories: MerchantCategoryDisplay[];
  onAddToCart: (product: MerchantProductDisplay) => void;
}

export default function MerchantSearchModal({ visible, onClose, products, categories, onAddToCart }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const inputRef = React.useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      // Focus after a short delay to allow modal animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const categoryMap = new Map<number | string, MerchantCategoryDisplay>();
    categories.forEach(c => categoryMap.set(c.id, c));

    return products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.shortDescription || '').toLowerCase();
      const matchProduct = name.includes(q) || desc.includes(q);
      
      const matchCategory = (p.categoryIds || []).some(cid => {
        const c = categoryMap.get(cid);
        const text = ((c?.name || '') + ' ' + (c?.slug || '')).toLowerCase();
        return text.includes(q);
      });

      return matchProduct || matchCategory;
    });
  }, [products, categories, query]);

  const handleAddToCart = (product: MerchantProductDisplay) => {
    onAddToCart(product);
  };

  const renderItem = ({ item }: { item: MerchantProductDisplay }) => {
    return (
      <TouchableOpacity 
        style={styles.itemContainer}
        onPress={() => {
            if (item.productType === 'variable' || item.productType === 'grouped') {
                 Alert.alert('Product', item.name);
            } else {
                 handleAddToCart(item);
            }
        }}
      >
        <View style={styles.itemContent}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          {item.shortDescription ? (
            <Text style={styles.itemDescription} numberOfLines={2}>{item.shortDescription}</Text>
          ) : null}
          
          <View style={styles.priceContainer}>
            {item.basePrice !== null && (
              <Text style={styles.itemPrice}>{formatCurrency(item.basePrice)}</Text>
            )}
            {item.compareAtPrice !== null && (item.compareAtPrice > (item.basePrice || 0)) && (
              <Text style={styles.itemComparePrice}>{formatCurrency(item.compareAtPrice)}</Text>
            )}
          </View>
        </View>

        <View style={styles.itemImageContainer}>
          <Image 
            source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }} 
            style={styles.itemImage}
            resizeMode="cover"
          />
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name="add" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide" // Or 'fade'
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              ref={inputRef}
              placeholder="Search menu"
              style={styles.searchInput}
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="#ccc" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results */}
        <View style={styles.content}>
          {filteredProducts.length === 0 ? (
            query.trim().length > 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No matching items</Text>
              </View>
            ) : null
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 40 }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    marginLeft: -8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    paddingRight: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111',
  },
  itemComparePrice: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  addButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eba236',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 16,
  },
});
