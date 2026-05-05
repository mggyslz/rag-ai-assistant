import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Text } from "react-native";
import { colors } from "../../lib/theme/colors";

export const TypingIndicator: React.FC = () => {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 180),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.wrapper}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>✦</Text>
      </View>
      <View style={styles.bubble}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -5],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 6,
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.accentDim,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent + "33",
  },
  avatarText: {
    color: colors.accent,
    fontSize: 11,
  },
  bubble: {
    flexDirection: "row",
    gap: 5,
    paddingVertical: 6,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textSecondary,
  },
});