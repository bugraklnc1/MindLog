import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

// Screens
import TodayScreen from '../screens/TodayScreen';
import HistoryScreen from '../screens/HistoryScreen';
import EntryDetailScreen from '../screens/EntryDetailScreen';
import GraphScreen from '../screens/GraphScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// History Stack - Geçmiş ve Detay sayfaları
function HistoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HistoryList" component={HistoryScreen} />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Bugün') {
              iconName = focused ? 'today' : 'today-outline';
            } else if (route.name === 'Geçmiş') {
              iconName = focused ? 'time' : 'time-outline';
            } else if (route.name === 'Grafik') {
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#6366f1',
          tabBarInactiveTintColor: '#adb5bd',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#e9ecef',
            paddingBottom: Platform.OS === 'ios' ? 20 : 8,
            paddingTop: 8,
            height: Platform.OS === 'ios' ? 88 : 64,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        })}
      >
        <Tab.Screen 
          name="Bugün" 
          component={TodayScreen}
          options={{
            tabBarLabel: 'Bugün',
          }}
        />
        <Tab.Screen 
          name="Geçmiş" 
          component={HistoryStack}
          options={{
            tabBarLabel: 'Geçmiş',
          }}
        />
        <Tab.Screen 
          name="Grafik" 
          component={GraphScreen}
          options={{
            tabBarLabel: 'Grafik',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
