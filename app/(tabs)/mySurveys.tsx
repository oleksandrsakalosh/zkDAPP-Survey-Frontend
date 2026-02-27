import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";


export default function MySurveys() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>New Survey Screen</Text>
      </View>

      <Pressable
        onPress={() => router.push("/create-survey")}
        style={({ pressed }) => ({
          backgroundColor: "#2F6BFF",
          opacity: pressed ? 0.9 : 1,
          borderRadius: 16,
          height: 56,
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
        })}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>
          Create survey
        </Text>
        <Text style={{ color: "#FFFFFF", fontSize: 22, marginLeft: 10, marginTop: -1 }}>
          ›
        </Text>
      </Pressable>
    </View>
  );
}