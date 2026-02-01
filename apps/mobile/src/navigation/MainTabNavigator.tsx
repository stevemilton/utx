import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { colors, spacing } from '../constants/theme';

// Import screens
import { FeedScreen } from '../screens/main/FeedScreen';
import { WorkoutsScreen } from '../screens/main/WorkoutsScreen';
import { AddWorkoutScreen } from '../screens/main/AddWorkoutScreen';
import { LeaderboardScreen } from '../screens/main/LeaderboardScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Simple icon components (we'll use SVGs in production)
const TabIcon: React.FC<{ name: string; focused: boolean }> = ({ name, focused }) => {
  const icons: Record<string, string> = {
    Feed: '📰',
    Workouts: '📊',
    AddWorkout: '➕',
    Leaderboard: '🏆',
    Profile: '👤',
  };

  return (
    <View style={[styles.iconContainer, focused ? styles.iconContainerFocused : undefined]}>
      <View style={{ opacity: focused ? 1 : 0.6 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {/* Placeholder - replace with actual icons */}
          <View
            style={[
              styles.iconPlaceholder,
              focused ? styles.iconPlaceholderFocused : undefined,
            ]}
          />
        </View>
      </View>
    </View>
  );
};

// Custom Add button
const AddButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <TouchableOpacity style={styles.addButton} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.addButtonInner}>
      <View style={styles.addIconHorizontal} />
      <View style={styles.addIconVertical} />
    </View>
  </TouchableOpacity>
);

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Feed" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Workouts"
        component={WorkoutsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Workouts" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AddWorkout"
        component={AddWorkoutScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <AddButton onPress={() => props.onPress?.(undefined as any)} />
          ),
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Leaderboard" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.backgroundSecondary,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 85,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerFocused: {},
  iconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.textTertiary,
  },
  iconPlaceholderFocused: {
    backgroundColor: colors.primary,
  },
  addButton: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonInner: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconHorizontal: {
    position: 'absolute',
    width: 20,
    height: 3,
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
  },
  addIconVertical: {
    position: 'absolute',
    width: 3,
    height: 20,
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
  },
});
