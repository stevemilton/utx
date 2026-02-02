import React, { useEffect, Component, ErrorInfo, ReactNode, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/stores/authStore';
import { colors } from './src/constants/theme';
import { api } from './src/services/api';
import type { RootStackParamList } from './src/navigation/types';

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors from preventAutoHideAsync
});

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={errorStyles.button} onPress={this.handleRetry}>
            <Text style={errorStyles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

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

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
