import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
  useLocationBasedMerchants,
  useLocationBasedCategories,
  useActiveAddress,
  LocationBasedMerchantService
} from '@encreasl/client-services';

import { apiConfig } from '../config/environment';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  initialQuery?: string;
  navigation: any;
}

interface Suggestion {
  text: string;
  source: 'merchant' | 'category' | 'product' | 'tag';
}

export default function SearchModal({ visible, onClose, initialQuery = '', navigation }: SearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const { user, token } = useAuth();

  // State for product suggestions (Manual fetch like Web)
  const [productSuggestions, setProductSuggestions] = useState<string[]>([]);
  // State for recent searches (Manual fetch like Web)
  const [serverRecentQueries, setServerRecentQueries] = useState<string[]>([]);

  // Normalize Query Helper (Identical to Web)
  const normalizeQuery = (input: string): string => {
    let q = (input || "").toLowerCase().trim();
    if (!q) return "";
    if (q.includes(" near me")) {
      q = q.replace(" near me", "").trim();
    }
    const idx = q.indexOf(" in ");
    if (idx > -1) {
      q = q.slice(0, idx).trim();
    }
    q = q.replace(/\s+/g, " ").trim();
    return q;
  };

  // Resolve User ID as string
  const userIdStr = user?.id ? String(user.id) : undefined;

  // Resolve Customer ID from User ID
  const { data: customerId } = useQuery({
    queryKey: ['customerId', userIdStr],
    queryFn: async () => {
      if (!user?.id) return null;
      return LocationBasedMerchantService.getCustomerIdFromUserId(user.id);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // 1. Recent Searches (Exact Web Logic)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!visible) return;
      try {
        const userId = user?.id;
        if (!userId) { setServerRecentQueries([]); return; }

        const API_BASE = apiConfig.baseUrl;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = apiConfig.payloadApiKey;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

        const url = `${API_BASE}/recent-searches?where[user][equals]=${encodeURIComponent(String(userId))}&where[scope][equals]=restaurants&sort=-updatedAt&limit=10`;
        const res = await fetch(url, { headers });
        if (!res.ok) { setServerRecentQueries([]); return; }

        const data = await res.json();
        const docs = Array.isArray(data?.docs) ? data.docs : [];
        const queries: string[] = docs.map((d: any) => (d?.query || '')).filter((v: any) => typeof v === 'string' && v.trim().length > 0);

        if (!cancelled) setServerRecentQueries(queries);
      } catch {
        if (!cancelled) setServerRecentQueries([]);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, user]);

  // 2. Product Suggestions (Implemented EXACTLY like Web with inline fetch)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!visible) return;
      const q = normalizeQuery(query);
      if (!q) { setProductSuggestions([]); return; }

      const API_BASE = apiConfig.baseUrl;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = apiConfig.payloadApiKey;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

      try {
        const url = `${API_BASE}/products?where[name][contains]=${encodeURIComponent(q)}&limit=12&depth=0`;
        const res = await fetch(url, { headers });
        if (!res.ok) { setProductSuggestions([]); return; }

        const data = await res.json();
        const docs = Array.isArray(data?.docs) ? data.docs : Array.isArray(data) ? data : [];
        const names: string[] = docs.map((p: any) => p?.name).filter((n: any) => typeof n === 'string' && n.trim().length > 0);
        const uniq: string[] = Array.from(new Set(names.map((n) => n.trim())));

        if (!cancelled) setProductSuggestions(uniq.slice(0, 12));
      } catch {
        if (!cancelled) setProductSuggestions([]);
      }
    };

    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, visible]);

  // 3. Merchant Suggestions (Local)
  const { data: merchants = [] } = useLocationBasedMerchants(customerId || undefined, null, 9999);

  // 4. Category Suggestions
  const { data: categories = [] } = useLocationBasedCategories(customerId || undefined);

  // 5. Active Address for "in [Address]" suggestions
  const { data: addressData } = useActiveAddress(userIdStr, token || undefined);
  const activeAddressName = addressData?.address?.formatted_address;

  // 6. Combined Suggestions (Exact Web Logic)
  const combinedSuggestions = useMemo((): Suggestion[] => {
    const q = query.trim();
    if (!q) return [];
    const lower = q.toLowerCase();

    const loc = activeAddressName ? ` in ${activeAddressName}` : '';
    const withLoc = (base: string) => [base, loc ? `${base}${loc}` : null].filter(Boolean) as string[];
    const withLocNearMe = (base: string) => [base, `${base} near me`, loc ? `${base}${loc}` : null].filter(Boolean) as string[];

    // Merchant Matches
    const merchantMatches = (merchants || [])
      .filter((m: any) => {
        const name = (m.outletName || '').toLowerCase();
        const vendor = (m.vendor?.businessName || '').toLowerCase();
        return name.includes(lower) || vendor.includes(lower);
      })
      .map((m: any) => (m.outletName || m.vendor?.businessName || '').trim())
      .filter((v: string) => v.length > 0);

    // Category Matches
    const categoryMatches = (categories || [])
      .filter((c: any) => (c.name || '').toLowerCase().includes(lower) || (c.slug || '').toLowerCase().includes(lower))
      .map((c: any) => c.name)
      .filter((v: string) => v && v.length > 0);

    // Tag Matches
    const tagMatches = (() => {
      const set = new Set<string>();
      (merchants || []).forEach((m: any) => (m.tags || []).forEach((t: string) => {
        const k = (t || '').trim();
        if (!k) return;
        if (k.toLowerCase().includes(lower)) set.add(k);
      }));
      return Array.from(set);
    })();

    const coll: Suggestion[] = [];
    // Slice 6 for merchants
    merchantMatches.slice(0, 6).forEach((name: string) => withLocNearMe(name).forEach((text) => coll.push({ text, source: 'merchant' })));
    // Slice 6 for categories
    categoryMatches.slice(0, 6).forEach((name: string) => withLoc(name).forEach((text) => coll.push({ text, source: 'category' })));
    // Slice 6 for products (from state)
    productSuggestions.slice(0, 6).forEach((name: string) => coll.push({ text: name, source: 'product' }));
    // Slice 4 for tags
    tagMatches.slice(0, 4).forEach((name: string) => withLoc(name).forEach((text) => coll.push({ text, source: 'tag' })));

    const seen = new Set<string>();
    const list = coll.filter((s) => {
      const k = s.text.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return list.slice(0, 12);
  }, [query, merchants, categories, productSuggestions, activeAddressName]);

  const recentList = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    serverRecentQueries.forEach((t) => {
      const k = t.trim().toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(t.trim());
    });
    return out.slice(0, 10);
  }, [serverRecentQueries]);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
    }
  }, [visible, initialQuery]);

  const handleSearch = (val?: string) => {
    const v = (val ?? query).trim();
    if (!v) return;

    // Fire and forget save (Exact Web Logic)
    (async () => {
      try {
        const userId = user?.id;
        if (!userId) return;

        const API_BASE = apiConfig.baseUrl;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = apiConfig.payloadApiKey;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

        const scope = 'restaurants';
        const normalized = normalizeQuery(v);
        const compositeKey = `${userId}:${scope}:${normalized}`;
        // Note: addressText needs activeAddressName
        const body = JSON.stringify({ user: userId, query: v, scope, source: 'web', addressText: activeAddressName || undefined });

        const res = await fetch(`${API_BASE}/recent-searches`, { method: 'POST', headers, body });
        if (res.ok) return;

        const existsUrl = `${API_BASE}/recent-searches?where[compositeKey][equals]=${encodeURIComponent(compositeKey)}&limit=1`;
        const getRes = await fetch(existsUrl, { headers });
        if (!getRes.ok) return;

        const data = await getRes.json();
        const id = data?.docs?.[0]?.id;
        if (!id) return;

        await fetch(`${API_BASE}/recent-searches/${id}`, { method: 'PATCH', headers, body: '{}' });
      } catch { }
    })();

    onClose();
    setQuery('');
    navigation.navigate('Search', { query: v });
  };

  const renderItem = ({ item, index }: { item: Suggestion | string, index: number }) => {
    const isRecent = !query.trim();
    const text = typeof item === 'string' ? item : item.text;
    const source = typeof item === 'string' ? 'recent' : item.source;

    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => handleSearch(text)}
      >
        <Ionicons
          name={isRecent ? "time-outline" : "search-outline"}
          size={20}
          color="#9CA3AF"
          style={styles.listIcon}
        />
        <View style={styles.listItemContent}>
          <Text style={styles.listText}>{text}</Text>
          {source === 'product' && (
            <View style={styles.productBadge}>
              <Text style={styles.productBadgeText}>in Restaurants</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const data = query.trim() ? combinedSuggestions : recentList;
  const showList = data.length > 0;
  const isLoading = false;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
            <View style={styles.inputContainer}>
              {!query && (
                <Text
                  style={styles.placeholderText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Search for foods & restaurants...
                </Text>
              )}
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                autoFocus={true}
                returnKeyType="search"
                onSubmitEditing={() => handleSearch(query)}
                // Android specific fixes for text alignment and clipping
                textAlignVertical="center"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#9CA3AF" />
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item, index) => `${typeof item === 'string' ? item : item.text}-${index}`}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                showList ? (
                  <Text style={styles.sectionHeader}>
                    {query.trim() ? "Suggested searches" : "Recent searches"}
                  </Text>
                ) : null
              }
            />
          )}
        </View>
      </SafeAreaView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6', // Subtle separator
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: 12,
    padding: 4, // Increase touch area
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24, // Pill shape for modern look
    height: 48,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  inputContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    width: '100%',
    height: '100%',
    fontSize: 16,
    color: '#111827', // Dark gray/black for text
    paddingVertical: 0, // CRITICAL: Remove default Android padding
    paddingHorizontal: 0, // Remove default padding
    includeFontPadding: false,
    backgroundColor: 'transparent',
  },
  placeholderText: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 16,
    color: '#9CA3AF',
  },
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  listIcon: {
    marginRight: 12,
  },
  listText: {
    fontSize: 16,
    color: '#1F2937',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  listItemContent: {
    flex: 1,
  },
  productBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  productBadgeText: {
    fontSize: 10,
    color: '#4B5563',
  },
});
