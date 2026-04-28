import { Alert, Platform } from "react-native";

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
) => {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  if (typeof window !== "undefined") {
    window.alert(message ? `${title}\n\n${message}` : title);
  }

  const nextAction =
    buttons?.find((button) => button.style !== "cancel" && button.onPress)?.onPress ??
    buttons?.find((button) => button.onPress)?.onPress;
  nextAction?.();
};
