import { Tabs } from "expo-router";
import React from "react";

import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function TabLayout() {
  return (
    <Tabs
        screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
        }}
    >
        <Tabs.Screen 
            name="home" 
            options={{ 
                tabBarIcon: ({ color, size }) => (
                    <MaterialIcons name="home" size={size} color={color} />
                ),
             }} 
        />

        <Tabs.Screen
            name="surveyList"
            options={{
                tabBarIcon: ({ color, size }) => (
                    <MaterialIcons name="how-to-vote" size={size} color={color} />
                ),
            }}
        />

        <Tabs.Screen
            name="newSurvey"
            options={{
                tabBarIcon: ({ color, size }) => (
                    <FontAwesome6 name="pen-to-square" size={size} color={color} />
                ),
            }}
        />

        <Tabs.Screen
            name="profile"
            options={{
                tabBarIcon: ({ color, size }) => (
                    <FontAwesome6 name="address-card" size={size} color={color} />
                ),
            }}
        /> 
      
    </Tabs>
  );
}