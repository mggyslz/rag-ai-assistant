import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors } from "../../lib/theme/colors";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export const ChatBubble: React.FC<Props> = ({ role, content }) => {
  const isUser = role === "user";
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!content) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        isUser ? styles.userWrapper : styles.assistantWrapper,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {isUser ? (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{content}</Text>
        </View>
      ) : (
        <View style={styles.assistantRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>✦</Text>
          </View>
          <View style={styles.assistantContent}>
            <Text style={styles.assistantText}>{content}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
    marginHorizontal: 16,
  },
  userWrapper: {
    alignItems: "flex-end",
  },
  assistantWrapper: {
    alignItems: "flex-start",
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: "80%",
  },
  userText: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
  },
  assistantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    maxWidth: "92%",
    gap: 10,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.accentDim,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.accent + "33",
  },
  avatarText: {
    color: colors.accent,
    fontSize: 11,
  },
  assistantContent: {
    flex: 1,
    paddingTop: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assistantText: {
    color: "#ececec",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "400",
  },
});