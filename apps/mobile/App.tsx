import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, LinkingOptions, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as Sentry from '@sentry/react-native';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/stores/authStore';
import { colors } from './src/constants/theme';
import { api } from './src/services/api';
import type { RootStackParamList } from './src/navigation/types';

// Initialize Sentry
Sentry.init({
  dsn: 'https://8fb813926bef37f769bf658d2615196a@o4510827006197760.ingest.de.sentry.io/4510827029266512',
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  environment: __DEV__ ? 'development' : 'production',
});

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors from preventAutoHideAsync
});

// Create navigation integration for Sentry
const routingInstrumentation = Sentry.reactNavigationIntegration();

// Deep linking configuration
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'utx://'],
  config: {
    screens: {
      Main: 'main',
    },
  },
};

function AppContent() {
  const { isLoading, setLoading, isAuthenticated } = useAuthStore();
  const handledCallbackRef = useRef(false);
  const navigationRef = useNavigationContainerRef();

  // Handle Strava OAuth callback
  useEffect(() => {
    const handleStravaCallback = async (url: string) => {
      // Prevent handling the same callback twice
      if (handledCallbackRef.current) return;

      // Check if it's a Strava callback URL
      if (url.includes('strava-callback')) {
        handledCallbackRef.current = true;

        try {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (error) {
            Alert.alert('Strava Connection Failed', 'Authorization was denied or cancelled.');
            return;
          }

          if (code) {
            const response = await api.stravaCallback(code);
            if (response.success) {
              Alert.alert(
                'Strava Connected!',
                'Your workouts will now automatically sync to Strava.',
                [{ text: 'Great!' }]
              );
            } else {
              Alert.alert('Connection Failed', response.error || 'Failed to connect Strava.');
            }
          }
        } catch (error) {
          console.error('Strava callback error:', error);
          Alert.alert('Error', 'Failed to complete Strava connection.');
        } finally {
          // Reset after a delay to allow re-connection attempts
          setTimeout(() => {
            handledCallbackRef.current = false;
          }, 5000);
        }
      }
    };

    // Handle initial URL (app opened via deep link)
    const handleInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleStravaCallback(initialUrl);
      }
    };

    // Handle URL while app is open
    const subscription = Linking.addEventListener('url', (event) => {
      handleStravaCallback(event.url);
    });

    if (isAuthenticated) {
      handleInitialUrl();
    }

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    async function prepare() {
      try {
        // Simulate loading auth state from storage
        // The persist middleware handles this automatically
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.warn('Prepare error:', e);
      } finally {
        setLoading(false);
        try {
          await SplashScreen.hideAsync();
        } catch (e) {
          // Ignore errors from hideAsync
        }
      }
    }

    prepare();
  }, [setLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            routingInstrumentation.registerNavigationContainer(navigationRef);
          }}
          linking={linking}
          theme={{
            dark: true,
            colors: {
              primary: colors.primary,
              background: colors.background,
              card: colors.surface,
              text: colors.textPrimary,
              border: colors.border,
              notification: colors.primary,
            },
            fonts: {
              regular: { fontFamily: 'System', fontWeight: '400' },
              medium: { fontFamily: 'System', fontWeight: '500' },
              bold: { fontFamily: 'System', fontWeight: '700' },
              heavy: { fontFamily: 'System', fontWeight: '900' },
            },
          }}
        >
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App() {
  return <AppContent />;
}

export default Sentry.wrap(App);
