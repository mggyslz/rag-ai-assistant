import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Text,
} from "react-native";
import { colors } from "../../lib/theme/colors";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const InputBar: React.FC<Props> = ({ onSend, disabled }) => {
  const [text, setText] = useState("");
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    onSend(trimmed);
    setText("");
  };

  const isActive = !!text.trim() && !disabled;

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
        />
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[styles.sendButton, isActive && styles.sendButtonActive]}
            onPress={handleSend}
            disabled={!isActive}
            activeOpacity={0.75}
          >
            <Text style={[styles.sendIcon, isActive && styles.sendIconActive]}>
              Send
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 130,
    paddingVertical: 4,
    backgroundColor: "transparent",
  },
  sendButton: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: colors.sendButtonDisabled,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonActive: {
    backgroundColor: colors.accent,
  },
  sendIcon: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  sendIconActive: {
    color: "#ffffff",
  },
});