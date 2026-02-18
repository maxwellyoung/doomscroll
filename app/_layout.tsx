import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { color } from "@/lib/design";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="feed"
          options={{
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
