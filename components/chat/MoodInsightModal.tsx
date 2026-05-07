import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MoodSnapshot, MoodTrend } from "../../lib/services/api";
import { colors } from "../../lib/theme/colors";

const BASE_URL = "http://192.168.1.8:5000/api";

interface Props {
  visible: boolean;
  onClose: () => void;
  sessionId: string | null;
  latest: MoodSnapshot | null;
  trend: MoodTrend | null;
  history: MoodSnapshot[];
}

const MOOD_META: Record<string, { emoji: string; label: string; color: string }> = {
  angry:      { emoji: "😡", label: "Angry",       color: "#dc2626" },
  stressed:   { emoji: "😤", label: "Stressed",    color: "#ef4444" },
  anxious:    { emoji: "😰", label: "Anxious",     color: "#f59e0b" },
  frustrated: { emoji: "😠", label: "Frustrated",  color: "#f97316" },
  sad:        { emoji: "😔", label: "Sad",          color: "#6366f1" },
  tired:      { emoji: "😴", label: "Tired",        color: "#8b5cf6" },
  bored:      { emoji: "😑", label: "Bored",        color: "#6b7280" },
  happy:      { emoji: "😊", label: "Happy",        color: "#22c55e" },
  excited:    { emoji: "🤩", label: "Excited",      color: "#f472b6" },
  content:    { emoji: "🙂", label: "Content",      color: "#10b981" },
  neutral:    { emoji: "😐", label: "Neutral",      color: "#6b7280" },
};

const ENERGY_META: Record<string, { emoji: string; label: string }> = {
  high:   { emoji: "⚡", label: "High" },
  medium: { emoji: "〰️", label: "Medium" },
  low:    { emoji: "🔋", label: "Low" },
};

const FOCUS_META: Record<string, { emoji: string; label: string }> = {
  high:   { emoji: "🎯", label: "Focused" },
  medium: { emoji: "🌀", label: "Moderate" },
  low:    { emoji: "💭", label: "Scattered" },
};

function getMoodMeta(mood: string) {
  return MOOD_META[mood] ?? { emoji: "🤔", label: mood, color: "#6b7280" };
}

function MoodSparkline({ history }: { history: MoodSnapshot[] }) {
  const recent = history.slice(-7);
  const moodOrder = ["excited", "happy", "content", "neutral", "bored", "tired", "anxious", "frustrated", "stressed", "sad", "angry"];

  return (
    <View style={spark.container}>
      <Text style={spark.label}>Last {recent.length} interactions</Text>
      <View style={spark.bars}>
        {recent.map((snap, i) => {
          const meta = getMoodMeta(snap.mood);
          const rank = moodOrder.indexOf(snap.mood);
          const height = Math.max(16, 8 + (rank >= 0 ? (moodOrder.length - rank) * 6 : 20));
          return (
            <View key={i} style={spark.barCol}>
              <Text style={spark.barEmoji}>{meta.emoji}</Text>
              <View style={[spark.bar, { height, backgroundColor: meta.color + "99" }]} />
              <View style={[spark.barTick, { backgroundColor: meta.color }]} />
            </View>
          );
        })}
        {Array.from({ length: Math.max(0, 7 - recent.length) }).map((_, i) => (
          <View key={`empty-${i}`} style={spark.barCol}>
            <View style={spark.barEmpty} />
          </View>
        ))}
      </View>
    </View>
  );
}

export const MoodInsightModal: React.FC<Props> = ({
  visible,
  onClose,
  sessionId,
  latest,
  trend,
  history,
}) => {
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      // Reset insight state on each open — never auto-fetch
      setInsight("");
      setHasRequested(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
    }
  }, [visible]);

  const fetchInsight = async () => {
    if (!latest || !sessionId || loading) return;
    setLoading(true);
    setHasRequested(true);

    try {
      const response = await fetch(`${BASE_URL}/mood/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await response.json();
      setInsight(data.insight ?? "Unable to generate insight at this time.");
    } catch {
      setInsight("Apologies — I was unable to fetch your mood insight just now.");
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const moodMeta = latest ? getMoodMeta(latest.mood) : getMoodMeta("neutral");
  const energyMeta = latest ? (ENERGY_META[latest.energy] ?? ENERGY_META.medium) : ENERGY_META.medium;
  const focusMeta = latest ? (FOCUS_META[latest.focus] ?? FOCUS_META.medium) : FOCUS_META.medium;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <TouchableOpacity activeOpacity={1}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Mood Reading</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Current mood card */}
              {latest ? (
                <View style={[styles.moodCard, { borderColor: moodMeta.color + "55" }]}>
                  <View style={[styles.moodIconBg, { backgroundColor: moodMeta.color + "22" }]}>
                    <Text style={styles.moodEmoji}>{moodMeta.emoji}</Text>
                  </View>
                  <View style={styles.moodCardInfo}>
                    <Text style={[styles.moodLabel, { color: moodMeta.color }]}>
                      {moodMeta.label}
                    </Text>
                    <Text style={styles.moodConfidence}>
                      {Math.round(latest.confidence * 100)}% confidence
                    </Text>
                  </View>
                  <View style={styles.moodStats}>
                    <View style={styles.statPill}>
                      <Text style={styles.statEmoji}>{energyMeta.emoji}</Text>
                      <Text style={styles.statText}>{energyMeta.label}</Text>
                    </View>
                    <View style={styles.statPill}>
                      <Text style={styles.statEmoji}>{focusMeta.emoji}</Text>
                      <Text style={styles.statText}>{focusMeta.label}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.noMoodCard}>
                  <Text style={styles.noMoodText}>
                    No mood data yet — start a conversation and I'll pick up on how you're feeling.
                  </Text>
                </View>
              )}

              {/* Trend streak */}
              {trend && trend.mood_streak >= 2 && (
                <View style={styles.streakRow}>
                  <Text style={styles.streakIcon}>📊</Text>
                  <Text style={styles.streakText}>
                    {moodMeta.emoji} {moodMeta.label} for {trend.mood_streak} interactions in a row
                  </Text>
                </View>
              )}

              {/* Sparkline */}
              {history.length > 0 && <MoodSparkline history={history} />}

              {/* Divider */}
              <View style={styles.divider} />

              {/* Insight section */}
              <View style={styles.insightSection}>
                <View style={styles.insightHeader}>
                  <View style={styles.regAvatar}>
                    <Text style={styles.regAvatarText}>✦</Text>
                  </View>
                  <Text style={styles.insightTitle}>Reginald's Insight</Text>
                </View>

                {/* Idle state — not yet requested */}
                {!hasRequested && !loading && (
                  <View style={styles.idleCard}>
                    <Text style={styles.idleText}>
                      Ask Reginald for a personalised read on your current state.
                    </Text>
                    {latest ? (
                      <TouchableOpacity
                        style={styles.getInsightBtn}
                        onPress={fetchInsight}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.getInsightBtnText}>✦  Get Insight</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.insightPlaceholder}>
                        Send a message first and I'll offer my assessment.
                      </Text>
                    )}
                  </View>
                )}

                {/* Loading state */}
                {loading && (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.loadingText}>Assessing your state of affairs…</Text>
                  </View>
                )}

                {/* Insight result */}
                {hasRequested && !loading && insight ? (
                  <>
                    <Text style={styles.insightText}>{insight}</Text>
                    <TouchableOpacity
                      style={styles.refreshBtn}
                      onPress={fetchInsight}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.refreshText}>↻  Refresh insight</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#131318",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#2a2a35",
    paddingBottom: 36,
    maxHeight: "85%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3a3a48",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2a2a35",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },

  // Mood card
  moodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a24",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  moodIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  moodEmoji: { fontSize: 26 },
  moodCardInfo: { flex: 1 },
  moodLabel: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  moodConfidence: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },
  moodStats: {
    gap: 6,
    alignItems: "flex-end",
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252530",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  statEmoji: { fontSize: 11 },
  statText: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "500",
  },

  noMoodCard: {
    backgroundColor: "#1a1a24",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  noMoodText: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  // Streak
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1e28",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  streakIcon: { fontSize: 14 },
  streakText: {
    color: "#aaa",
    fontSize: 13,
    flex: 1,
  },

  divider: {
    height: 1,
    backgroundColor: "#252530",
    marginVertical: 16,
  },

  // Insight
  insightSection: { gap: 12 },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  regAvatar: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.accentDim,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent + "33",
  },
  regAvatarText: {
    color: colors.accent,
    fontSize: 10,
  },
  insightTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // Idle / CTA
  idleCard: {
    backgroundColor: "#1a1a24",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252530",
    padding: 16,
    alignItems: "center",
    gap: 14,
  },
  idleText: {
    color: "#666",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  getInsightBtn: {
    backgroundColor: colors.accentDim,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent + "55",
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  getInsightBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Loading
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    color: "#666",
    fontSize: 13,
    fontStyle: "italic",
  },

  // Insight result
  insightText: {
    color: "#d0d0d0",
    fontSize: 14,
    lineHeight: 22,
    backgroundColor: "#1a1a24",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#252530",
  },
  insightPlaceholder: {
    color: "#555",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  refreshBtn: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1e1e28",
  },
  refreshText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
});

// ── Sparkline styles ──────────────────────────────────────────────────────────

const spark = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    color: "#555",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 64,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  barEmoji: {
    fontSize: 10,
  },
  bar: {
    width: "100%",
    borderRadius: 4,
    minHeight: 8,
  },
  barTick: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  barEmpty: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "#252530",
  },
});