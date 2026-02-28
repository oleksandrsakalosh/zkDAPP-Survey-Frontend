import { Tabs } from "expo-router";
import React from "react";

import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function TabLayout() {
  return (
    <Tabs
        screenOptions={{
            headerShown: false,
            tabBarShowLabel: true,
        }}
    >
        <Tabs.Screen 
            name="home" 
            options={{ 
                tabBarIcon: ({ color, size }) => (
                    <MaterialIcons name="home" size={size} color={color} />
                ),
                tabBarLabel: "Home",
             }} 
        />

        <Tabs.Screen
            name="explore"
            options={{
                tabBarIcon: ({ color, size }) => (
                    <FontAwesome6 name="magnifying-glass" size={size} color={color} />
                ),
                tabBarLabel: "Explore",
                headerShown: true,
                headerTitle: "Explore",
            }}
        />

        <Tabs.Screen
            name="mySurveys"
            options={{
                tabBarIcon: ({ color, size }) => (
                    <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />
                ),
                tabBarLabel: "My Surveys",
                headerShown: true,
                headerTitleAlign: "left",
                headerTitle: "My Surveys",
                headerTitleStyle: {
                    fontSize: 24,
                    fontWeight: "700",
                },
            }}
        />

        <Tabs.Screen
            name="profile"
            options={{
                tabBarIcon: ({ color, size }) => (
                    <FontAwesome6 name="address-card" size={size} color={color} />
                ),
                tabBarLabel: "Profile",
                headerShown: true,
                headerTitle: "Profile",
            }}
        /> 
      
    </Tabs>
  );
}