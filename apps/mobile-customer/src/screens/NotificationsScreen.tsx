import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNavigation } from '../navigation/NavigationContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';
import type { NotificationItem } from '../services/notifications';

const DOMAIN_ICON_MAP: Record<string, { icon: string; color: string }> = {
  order: { icon: 'receipt-outline', color: '#6366f1' },
  account: { icon: 'person-outline', color: '#f97316' },
  system: { icon: 'settings-outline', color: '#8b5cf6' },
  marketing: { icon: 'pricetag-outline', color: '#f3a823' },
  custom: { icon: 'chatbubble-outline', color: '#10b981' },
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const colors = useThemeColors();

  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handlePress = useCallback(
    async (item: NotificationItem) => {
      if (item.status === 'unread') {
        markAsRead(item.id);
      }

      if (item.orderId) {
        router.push(`/order/${item.orderId}`);
      }
    },
    [router, markAsRead],
  );

  const handleToggleRead = useCallback(
    (item: NotificationItem) => {
      if (item.status === 'unread') {
        markAsRead(item.id);
      } else {
        markAsUnread(item.id);
      }
    },
    [markAsRead, markAsUnread],
  );

  const getNotificationStyle = (item: NotificationItem) => {
    return DOMAIN_ICON_MAP[item.domain] || DOMAIN_ICON_MAP.system;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ backgroundColor: colors.primary }} edges={['top']} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 8, marginRight: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, flex: 1 }}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
              }}
            >
              <Text style={{ color: colors.surface, fontWeight: '600', fontSize: 12 }}>
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading && !refreshing ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 32,
            }}
          >
            <View
              style={{
                width: 120,
                height: 120,
                backgroundColor: colors.border,
                borderRadius: 60,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <Ionicons name="notifications-outline" size={60} color={colors.textSecondary} />
            </View>
            <Text
              style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: colors.text,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              No notifications yet
            </Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              We{"'"}ll notify you about order updates, promotions, and more!
            </Text>
          </View>
        ) : (
          <PullToRefreshLayout isRefreshing={refreshing} onRefresh={handleRefresh}>
            {unreadCount > 0 && (
              <View
                style={{
                  backgroundColor: '#fef3c7',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#fde68a',
                }}
              >
                <Text style={{ color: '#92400e', fontSize: 14, fontWeight: '600' }}>
                  You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            <View style={{ padding: 16 }}>
              {notifications.map((item) => {
                const { icon, color } = getNotificationStyle(item);
                const isUnread = item.status === 'unread';

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handlePress(item)}
                    style={{
                      backgroundColor: isUnread ? colors.primaryLight : colors.surface,
                      borderRadius: 12,
                      marginBottom: 12,
                      padding: 16,
                      borderLeftWidth: 4,
                      borderLeftColor: isUnread ? colors.primary : colors.border,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: `${color}20`,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Ionicons name={icon as any} size={20} color={color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: isUnread ? 'bold' : '600',
                              color: colors.text,
                              flex: 1,
                            }}
                          >
                            {item.title}
                          </Text>
                          {isUnread && (
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: colors.primary,
                                marginLeft: 8,
                                marginTop: 4,
                              }}
                            />
                          )}
                        </View>

                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 14,
                            lineHeight: 20,
                            marginBottom: 8,
                          }}
                        >
                          {item.body}
                        </Text>

                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            fontWeight: '500',
                          }}
                        >
                          {formatTime(item.deliveredAt)}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleToggleRead(item)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        alignSelf: 'flex-start',
                        marginTop: 12,
                        backgroundColor: colors.background,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Ionicons
                        name={isUnread ? 'checkmark-circle-outline' : 'arrow-undo-circle-outline'}
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 12,
                          fontWeight: '600',
                          marginLeft: 4,
                        }}
                      >
                        {isUnread ? 'Mark as read' : 'Mark as unread'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ height: 100 }} />
          </PullToRefreshLayout>
        )}
      </View>
    </View>
  );
}