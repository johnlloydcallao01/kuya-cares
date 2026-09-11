import { Tabs } from 'expo-router';
import { useThemeColors } from '../../src/contexts/ThemeContext';
import FooterNavigation from '../../src/components/FooterNavigation';
import { useNavigation } from '../../src/navigation/NavigationContext';

// Adapter component to bridge Expo Router with existing FooterNavigation
function FooterAdapter(props: any) {
  const { navigate, currentScreen } = useNavigation();
  
  // Pass the navigation object with navigate method and current active screen
  return (
    <FooterNavigation 
      navigation={{ navigate }} 
      activeScreen={currentScreen} 
    />
  );
}

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      tabBar={(props) => <FooterAdapter {...props} />}
      screenOptions={{
        headerShown: false,
        // Ensure the background color matches theme
        sceneStyle: { backgroundColor: colors.background }
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wishlist" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="account" />
      
      {/* Hidden tabs that still show the footer */}
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="nearby-restaurants" options={{ href: null }} />
      <Tabs.Screen name="newly-updated" options={{ href: null }} />
    </Tabs>
  );
}
