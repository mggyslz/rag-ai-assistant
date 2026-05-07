import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  StatusBar,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatBubble } from "../components/chat/ChatBubble";
import { InputBar } from "../components/ui/InputBar";
import { TypingIndicator } from "../components/chat/TypingIndicator";
import { Sidebar } from "../components/chat/Sidebar";
import {
  sendMessageStream,
  fetchHistory,
  fetchMoodState,
  Message,
  MoodSnapshot,
} from "../lib/services/api";
import { colors } from "../lib/theme/colors";

const generateSessionId = () => "session-" + Date.now();
const SESSION_KEY = "rag_session_id";

const MOOD_META: Record<string, { emoji: string; color: string }> = {
  angry:      { emoji: "😡", color: "#dc2626" },
  stressed:   { emoji: "😤", color: "#ef4444" },
  anxious:    { emoji: "😰", color: "#f59e0b" },
  frustrated: { emoji: "😠", color: "#f97316" },
  sad:        { emoji: "😔", color: "#6366f1" },
  tired:      { emoji: "😴", color: "#8b5cf6" },
  bored:      { emoji: "😑", color: "#6b7280" },
  happy:      { emoji: "😊", color: "#22c55e" },
  excited:    { emoji: "🤩", color: "#f472b6" },
  content:    { emoji: "🙂", color: "#10b981" },
  neutral:    { emoji: "😐", color: "#6b7280" },
};

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [currentMood, setCurrentMood] = useState<MoodSnapshot | null>(null);
  const listRef = useRef<FlatList>(null);

  const loadSession = useCallback(async (id: string) => {
    setMessages([]);
    setCurrentMood(null);
    setSessionId(id);
    await AsyncStorage.setItem(SESSION_KEY, id);
    fetchHistory(id).then(setMessages).catch(() => {});
    fetchMoodState(id)
      .then((state) => setCurrentMood(state.latest))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const initSession = async () => {
      let id = await AsyncStorage.getItem(SESSION_KEY);
      if (!id) {
        id = generateSessionId();
        await AsyncStorage.setItem(SESSION_KEY, id);
      }
      setSessionId(id);
      fetchHistory(id).then(setMessages).catch(() => {});
      fetchMoodState(id)
        .then((state) => setCurrentMood(state.latest))
        .catch(() => {});
    };
    initSession();
  }, []);

  const scrollToBottom = () => {
    listRef.current?.scrollToEnd({ animated: true });
  };

  const handleNewChat = useCallback(async () => {
    const newId = generateSessionId();
    setSidebarVisible(false);
    await loadSession(newId);
  }, [loadSession]);

  const handleSelectSession = useCallback(
    (id: string) => {
      loadSession(id);
    },
    [loadSession]
  );

  const handleConversationDeleted = useCallback(
    async (deletedSessionId: string) => {
      if (deletedSessionId === sessionId) {
        const newId = generateSessionId();
        setMessages([]);
        setCurrentMood(null);
        setSessionId(newId);
        await AsyncStorage.setItem(SESSION_KEY, newId);
      }
    },
    [sessionId]
  );

  const refreshMood = useCallback(
    (id: string) => {
      fetchMoodState(id)
        .then((state) => setCurrentMood(state.latest))
        .catch(() => {});
    },
    []
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!sessionId) return;

      const userMessage: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      sendMessageStream(
        sessionId,
        text,
        (token) => {
          setIsTyping(false);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + token,
            };
            return updated;
          });
        },
        () => {
          setIsTyping(false);
          // Refresh mood after assistant finishes responding
          refreshMood(sessionId);
        },
        (error) => {
          setIsTyping(false);
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: "Something went wrong. Please try again.",
            };
            return updated;
          });
        }
      );
    },
    [sessionId, refreshMood]
  );

  const moodMeta = currentMood ? (MOOD_META[currentMood.mood] ?? null) : null;

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>✦</Text>
      </View>
      <Text style={styles.emptyTitle}>How can I help?</Text>
      <Text style={styles.emptySubtitle}>Ask me anything</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setSidebarVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>✦</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Assistant</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.headerSub}>RAG Memory Active</Text>
            </View>
          </View>
        </View>

        {/* Mood badge in header */}
        {moodMeta && currentMood && (
          <TouchableOpacity
            style={[styles.moodBadge, { borderColor: moodMeta.color + "44" }]}
            onPress={() => setSidebarVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.moodBadgeEmoji}>{moodMeta.emoji}</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => (
            <ChatBubble
              role={item.role}
              content={item.content}
              mood={item.role === "assistant" ? currentMood?.mood : undefined}
            />
          )}
          ListEmptyComponent={<EmptyState />}
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          onContentSizeChange={scrollToBottom}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.listContentEmpty,
          ]}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
        <InputBar onSend={handleSend} disabled={isTyping} />
      </KeyboardAvoidingView>

      {/* Sidebar overlay */}
      <Sidebar
        visible={sidebarVisible}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onClose={() => setSidebarVisible(false)}
        onConversationDeleted={handleConversationDeleted}
      />
    </SafeAreaView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIcon: {
    color: colors.textSecondary,
    fontSize: 18,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentDim,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent + "44",
  },
  headerIconText: {
    color: colors.accent,
    fontSize: 14,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3ecf8e",
  },
  headerSub: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // Mood badge
  moodBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#1a1a24",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  moodBadgeEmoji: {
    fontSize: 17,
  },

  list: { flex: 1 },
  listContent: { paddingVertical: 16 },
  listContentEmpty: { flex: 1 },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentDim,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent + "44",
    marginBottom: 8,
  },
  emptyIconText: {
    color: colors.accent,
    fontSize: 22,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});