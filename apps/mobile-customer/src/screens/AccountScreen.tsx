import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';
import { fetchAccountOverview, AccountOverview, asObject } from '../services/account';
import { formatCurrency } from '../utils/format';

const AccountSkeleton = () => {
  return (
    <View style={{ padding: 16 }}>
      {/* Profile Card */}
      <View style={{
        backgroundColor: '#fff',
        marginBottom: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            marginRight: 16,
            backgroundColor: '#E5E7EB',
          }} />
          <View style={{ flex: 1 }}>
            <View style={{ width: '60%', height: 20, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 8 }} />
            <View style={{ width: '80%', height: 14, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 8 }} />
            <View style={{ width: '45%', height: 12, backgroundColor: '#F3F4F6', borderRadius: 4 }} />
          </View>
        </View>

        <View style={{
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
        }}>
          <View style={{ width: '30%', height: 12, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 8 }} />
          <View style={{ width: '70%', height: 14, backgroundColor: '#F3F4F6', borderRadius: 4 }} />
        </View>
      </View>

      {/* Stats Card */}
      <View style={{
        backgroundColor: '#fff',
        marginBottom: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <View style={{ width: '35%', height: 16, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ width: 48, height: 24, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 8 }} />
              <View style={{ width: 40, height: 12, backgroundColor: '#F3F4F6', borderRadius: 4 }} />
            </View>
          ))}
        </View>
      </View>

      {/* Menu Items */}
      <View style={{
        backgroundColor: '#fff',
        marginBottom: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <View style={{ width: '35%', height: 16, backgroundColor: '#F3F4F6', borderRadius: 4 }} />
        </View>
        {[1, 2, 3, 4, 5].map(i => (
          <View key={i} style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderTopWidth: i > 1 ? 1 : 0,
            borderTopColor: '#F3F4F6',
          }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#E5E7EB', marginRight: 14 }} />
            <View style={{ width: '40%', height: 16, backgroundColor: '#F3F4F6', borderRadius: 4 }} />
          </View>
        ))}
      </View>
    </View>
  );
};

export default function AccountScreen() {
  const colors = useThemeColors();
  const { user, customerId, logout } = useAuth();
  const router = useRouter();

  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Guest';
  const email = user?.email || '';
  const profileImageUrl =
    user?.profilePicture?.cloudinaryURL || user?.profilePicture?.url || null;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  const activeAddress = overview?.customer?.activeAddress
    ? asObject(overview.customer.activeAddress)
    : null;
  const formattedAddress =
    activeAddress?.formatted_address ||
    activeAddress?.formattedAddress ||
    null;

  const loadData = useCallback(async () => {
    const userId = user?.id ?? customerId;
    if (!userId) {
      setOverview(null);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchAccountOverview(userId);
      setOverview(data);
    } catch (err) {
      console.error('Failed to load account overview:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const showSkeleton = loading || refreshing;

  if (showSkeleton) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView style={{ backgroundColor: colors.primary }} edges={['top']} />
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
              Account
            </Text>
          </View>
          <PullToRefreshLayout isRefreshing={refreshing} onRefresh={handleRefresh}>
            <AccountSkeleton />
          </PullToRefreshLayout>
        </View>
      </View>
    );
  }

  const stats = overview?.stats;

  const quickActions: {
    icon: string;
    label: string;
    badge?: number;
    onPress: () => void;
  }[] = [
    {
      icon: 'receipt-outline',
      label: 'My Orders',
      badge: stats?.orderCount,
      onPress: () => router.push('/(tabs)/orders'),
    },
    {
      icon: 'heart-outline',
      label: 'Favorites',
      badge: stats?.favoriteCount,
      onPress: () => router.push('/(tabs)/wishlist'),
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      badge: stats?.unreadNotificationCount,
      onPress: () => router.push('/notifications'),
    },
    {
      icon: 'location-outline',
      label: 'Delivery Addresses',
      badge: stats?.addressCount,
      onPress: () => router.push('/addresses'),
    },
    {
      icon: 'create-outline',
      label: 'Edit Profile',
      onPress: () => router.push('/edit-profile'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ backgroundColor: colors.primary }} edges={['top']} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
            Account
          </Text>
        </View>

        <PullToRefreshLayout isRefreshing={refreshing} onRefresh={handleRefresh}>
          {/* Profile Card */}
          <View
            style={{
              backgroundColor: colors.surface,
              margin: 16,
              borderRadius: 16,
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {profileImageUrl ? (
                <Image
                  source={{ uri: profileImageUrl }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    marginRight: 16,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    marginRight: 16,
                    backgroundColor: colors.primaryLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: 'bold',
                      color: colors.primary,
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: colors.text,
                    marginBottom: 2,
                  }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    marginBottom: 2,
                  }}
                  numberOfLines={1}
                >
                  {email}
                </Text>
                {memberSince && (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    Member since {memberSince}
                  </Text>
                )}
              </View>
            </View>

            {/* Active Delivery Address */}
            <View
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'flex-start' }}
                activeOpacity={0.7}
                onPress={() => router.push('/addresses')}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={formattedAddress ? colors.primary : colors.textSecondary}
                  style={{ marginTop: 1, marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 2,
                    }}
                  >
                    Delivery Address
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: formattedAddress ? colors.text : colors.textSecondary,
                      lineHeight: 20,
                    }}
                    numberOfLines={2}
                  >
                    {formattedAddress || 'No delivery address set yet'}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textSecondary}
                  style={{ marginLeft: 8, marginTop: 4 }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Row */}
          {stats && (
            <View
              style={{
                backgroundColor: colors.surface,
                marginHorizontal: 16,
                marginBottom: 16,
                borderRadius: 16,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: colors.text,
                  marginBottom: 16,
                }}
              >
                Your Stats
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: 'bold',
                      color: colors.primary,
                    }}
                  >
                    {stats.orderCount}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Orders
                  </Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: 'bold',
                      color: '#10b981',
                    }}
                    numberOfLines={1}
                  >
                    {stats.totalSpent > 0 ? formatCurrency(stats.totalSpent) : '—'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Total Spent
                  </Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: 'bold',
                      color: '#8b5cf6',
                    }}
                  >
                    {stats.reviewCount}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Reviews
                  </Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: 'bold',
                      color: '#f97316',
                    }}
                  >
                    {stats.favoriteCount}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Favorites
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Menu Items */}
          <View
            style={{
              backgroundColor: colors.surface,
              marginHorizontal: 16,
              marginBottom: 16,
              borderRadius: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: 'bold',
                color: colors.text,
                padding: 20,
                paddingBottom: 12,
              }}
            >
              My Account
            </Text>

            {quickActions.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
                <Text
                  style={{
                    flex: 1,
                    marginLeft: 14,
                    fontSize: 16,
                    color: colors.text,
                  }}
                >
                  {item.label}
                </Text>
                {item.badge !== undefined && item.badge > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      minWidth: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 6,
                      marginRight: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.surface,
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            onPress={logout}
            style={{
              backgroundColor: colors.surface,
              marginHorizontal: 16,
              marginBottom: 32,
              borderRadius: 16,
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, color: '#ef4444', fontWeight: '600' }}>
              Sign Out
            </Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </PullToRefreshLayout>
      </View>
    </View>
  );
}
