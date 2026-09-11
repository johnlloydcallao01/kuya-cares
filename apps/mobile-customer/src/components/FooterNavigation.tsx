import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { useCart } from '../contexts/CartContext';

interface FooterNavigationProps {
  navigation: any;
  activeScreen: string;
}

export default function FooterNavigation({ navigation, activeScreen }: FooterNavigationProps) {
  const colors = useThemeColors();
  const { totalQuantity } = useCart();
  const insets = useSafeAreaInsets();

  const tabs = [
    { name: 'Home', icon: 'home', screen: 'Home' },
    { name: 'Wishlists', icon: 'heart', screen: 'Wishlist' },
    { name: 'Carts', icon: 'cart', screen: 'Cart' },
    { name: 'Orders', icon: 'receipt', screen: 'Orders' },
    { name: 'Menu', icon: 'menu', screen: 'Account' },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: 'white',
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 8), // Respect safe area
      height: 60 + Math.max(insets.bottom, 0), // Adjust height dynamically
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    }}>
      {tabs.map((tab, index) => {
        const isActive = activeScreen === tab.screen || 
                        (tab.name === 'Menu' && activeScreen === 'Account') ||
                        (tab.name === 'Wishlists' && activeScreen === 'Wishlist') ||
                        (tab.name === 'Carts' && activeScreen === 'Cart');
        
        // Determine icon name based on active state
        let iconName = tab.icon;
        if (!isActive) {
          // Use outline versions for inactive tabs where available
          if (tab.icon === 'home') iconName = 'home-outline';
          else if (tab.icon === 'heart') iconName = 'heart-outline';
          else if (tab.icon === 'cart') iconName = 'cart-outline';
          else if (tab.icon === 'receipt') iconName = 'receipt-outline';
          else if (tab.icon === 'menu') iconName = 'menu-outline';
        }

        return (
          <TouchableOpacity
            key={tab.name}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 4,
            }}
            onPress={() => {
              if (tab.screen !== activeScreen) {
                navigation.navigate(tab.screen);
              }
            }}
          >
            {tab.name === 'Carts' ? (
              // Special design for Carts
              <View>
                <View style={{
                  width: 48, // Slightly larger
                  height: 48,
                  borderRadius: 24,
                  // Wait, "Carts (Cart icon, with a badge showing '2', and it looks slightly raised or larger)"
                  // Usually the center button is highlighted. If the footer is white, maybe the button is white too but raised?
                  // Or maybe it's colored. Let's assume standard "raised center button" often has a background color, 
                  // BUT the user said "white footer". Let's stick to the previous elevated design but updated.
                  // Actually, let's look at the previous code: it had `backgroundColor: colors.surface` (which is likely white/light).
                  // Let's keep it white but raised.
                  backgroundColor: 'white',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -20, // Elevate
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 5,
                  borderWidth: 1,
                  borderColor: '#f0f0f0'
                }}>
                  <Ionicons
                    name={isActive ? 'cart' : 'cart-outline'}
                    size={24}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                  {/* Badge */}
                  {totalQuantity > 0 && (
                    <View style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      backgroundColor: '#f97316', // Orange badge
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: 'white',
                    }}>
                      <Text style={{
                        color: 'white',
                        fontSize: 10,
                        fontWeight: 'bold',
                        paddingHorizontal: 4,
                      }}>{totalQuantity > 99 ? '99+' : totalQuantity}</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              // Regular design for other tabs
              <Ionicons
                name={iconName as any}
                size={24}
                color={isActive ? colors.primary : colors.textSecondary}
              />
            )}
            
            <Text style={{
              fontSize: 10,
              marginTop: tab.name === 'Carts' ? 4 : 4,
              fontWeight: isActive ? '600' : '500',
              color: isActive ? colors.primary : colors.textSecondary,
            }}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
