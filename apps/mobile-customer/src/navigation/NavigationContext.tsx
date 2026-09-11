import { createContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'expo-router';

export interface NavigationContextType {
  currentScreen: string;
  navigate: (screenName: string, params?: any) => void;
  goBack: () => void;
}

// Keep the context for backward compatibility if needed, though we primarily use the hook
export const NavigationContext = createContext<NavigationContextType | null>(null);

// Helper to map Expo Router paths to old screen names
const getScreenName = (pathname: string): string => {
  if (pathname === '/' || pathname === '/index' || pathname === '/(tabs)') return 'Home';
  if (pathname.includes('/login')) return 'Login';
  if (pathname.includes('/signup')) return 'Signup';
  if (pathname.includes('/forgot-password')) return 'ForgotPassword';
  if (pathname.includes('/orders')) return 'Orders';
  if (pathname.includes('/cart')) return 'Cart';
  if (pathname.includes('/search')) return 'Search';
  if (pathname.includes('/account')) return 'Account';
  if (pathname.includes('/wishlist')) return 'Wishlist';
  if (pathname.includes('/merchant/')) return 'Merchant';
  if (pathname.includes('/merchant-cart/')) return 'MerchantCart';
  if (pathname.includes('/checkout/')) return 'Checkout';
  if (pathname.includes('/product/')) return 'Product';
  if (pathname.includes('/notifications')) return 'Notifications';
  if (pathname.includes('/nearby-restaurants')) return 'NearbyRestaurants';
  if (pathname.includes('/newly-updated')) return 'NewlyUpdated';
  return 'Home';
};

export const useNavigation = (): NavigationContextType => {
  const router = useRouter();
  const pathname = usePathname();
  const [currentScreen, setCurrentScreen] = useState('Home');

  useEffect(() => {
    setCurrentScreen(getScreenName(pathname));
  }, [pathname]);

  const navigate = (screenName: string, params?: any) => {
    // console.log(`Navigating to: ${screenName}`, params);

    switch (screenName) {
      case 'Home': 
        router.push('/(tabs)'); 
        break;
      case 'Login': 
        router.replace('/(auth)/login'); 
        break;
      case 'Signup': 
        router.push('/(auth)/signup'); 
        break;
      case 'ForgotPassword': 
        router.push('/(auth)/forgot-password'); 
        break;
      case 'Orders': 
        router.push('/(tabs)/orders'); 
        break;
      case 'Cart': 
        router.push('/(tabs)/cart'); 
        break;
      case 'Search': 
        if (params) {
          router.push({ pathname: '/(tabs)/search', params });
        } else {
          router.push('/(tabs)/search');
        }
        break;
      case 'Account': 
        router.push('/(tabs)/account'); 
        break;
      case 'Wishlist': 
        router.push('/(tabs)/wishlist'); 
        break;
      case 'Merchant': 
        if (params?.id) router.push({ pathname: `/merchant/${params.id}`, params });
        else if (params?.merchantId) router.push({ pathname: `/merchant/${params.merchantId}`, params });
        else console.warn('Merchant ID missing');
        break;
      case 'MerchantCart':
        if (params?.id) router.push({ pathname: `/merchant-cart/${params.id}`, params });
        else if (params?.merchantId) router.push({ pathname: `/merchant-cart/${params.merchantId}`, params });
        else console.warn('Merchant ID missing for cart');
        break;
      case 'Checkout':
        if (params?.id) router.push({ pathname: `/checkout/${params.id}`, params });
        else if (params?.merchantId) router.push({ pathname: `/checkout/${params.merchantId}`, params });
        else console.warn('Merchant ID missing for checkout');
        break;
      case 'Product':
         if (params?.id) router.push({ pathname: `/product/${params.id}`, params });
         else if (params?.productId) router.push({ pathname: `/product/${params.productId}`, params });
         else if (params?.merchantProductId) router.push({ pathname: `/product/${params.merchantProductId}`, params });
         else console.warn('Product ID missing');
         break;
      case 'Notifications': 
        router.push('/notifications'); 
        break;
      case 'NearbyRestaurants': 
        router.push('/nearby-restaurants'); 
        break;
      case 'NewlyUpdated': 
        router.push('/newly-updated'); 
        break;
      default: 
        console.warn(`Unknown screen: ${screenName}`);
        // Try to push as path if it looks like one, or default to home
        if (screenName.startsWith('/')) {
            router.push(screenName as any);
        }
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // If can't go back, maybe go home?
      router.replace('/');
    }
  };

  return { currentScreen, navigate, goBack };
};
