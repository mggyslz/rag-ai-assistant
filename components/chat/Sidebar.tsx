import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { colors } from "../../lib/theme/colors";
import {
  fetchSessions,
  deleteConversation,
  fetchMoodState,
  fetchPinnedMemories,
  addPinnedMemory,
  updatePinnedMemory,
  deletePinnedMemoryById,
  SessionItem,
  MoodSnapshot,
  MoodTrend,
  MoodState,
  PinnedMemory,
} from "../../lib/services/api";
import { MoodInsightModal } from "./MoodInsightModal";

interface Props {
  visible: boolean;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  onConversationDeleted: (sessionId: string) => void;
}

const MOOD_META: Record<string, { emoji: string; label: string; color: string }> = {
  stressed:   { emoji: "😤", label: "Stressed",   color: "#ef4444" },
  sad:        { emoji: "😔", label: "Sad",         color: "#6366f1" },
  tired:      { emoji: "😴", label: "Tired",       color: "#8b5cf6" },
  frustrated: { emoji: "😠", label: "Frustrated",  color: "#f97316" },
  happy:      { emoji: "😊", label: "Happy",       color: "#22c55e" },
  content:    { emoji: "🙂", label: "Content",     color: "#10b981" },
  neutral:    { emoji: "😐", label: "Neutral",     color: "#6b7280" },
};

function getMoodMeta(mood: string) {
  return MOOD_META[mood] ?? { emoji: "🤔", label: mood, color: "#6b7280" };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Yesterday";
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Tab = "chats" | "memories";

export const Sidebar: React.FC<Props> = ({
  visible,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onClose,
  onConversationDeleted,
}) => {
  const slideAnim = useRef(new Animated.Value(-320)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [moodState, setMoodState] = useState<MoodState>({ latest: null, trend: null, history: [] });
  const [moodLoading, setMoodLoading] = useState(false);
  const [insightVisible, setInsightVisible] = useState(false);

  // Memories state
  const [pinnedMemories, setPinnedMemories] = useState<PinnedMemory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const [addingMemory, setAddingMemory] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirmMemoryId, setDeleteConfirmMemoryId] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      fetchSessions().then(setSessions).catch(() => {});
      if (currentSessionId) loadMood(currentSessionId);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 68,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -320,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, currentSessionId]);

  const loadMood = async (sessionId: string) => {
    setMoodLoading(true);
    try {
      const state = await fetchMoodState(sessionId);
      setMoodState(state);
    } catch {
      setMoodState({ latest: null, trend: null, history: [] });
    } finally {
      setMoodLoading(false);
    }
  };

  // Load pinned memories when switching to memories tab
  useEffect(() => {
    if (activeTab === "memories" && currentSessionId) {
      loadPinnedMemories();
    }
  }, [activeTab, currentSessionId]);

  const loadPinnedMemories = useCallback(async () => {
    if (!currentSessionId) return;
    setLoadingMemories(true);
    try {
      const data = await fetchPinnedMemories(currentSessionId);
      setPinnedMemories(data);
    } catch {
      // silently fail
    } finally {
      setLoadingMemories(false);
    }
  }, [currentSessionId]);

  const handleAddMemory = async () => {
    const trimmed = newMemory.trim();
    if (!trimmed || !currentSessionId) return;
    setAddingMemory(true);
    try {
      await addPinnedMemory(currentSessionId, trimmed);
      setNewMemory("");
      await loadPinnedMemories();
    } catch {
      // silently fail
    } finally {
      setAddingMemory(false);
    }
  };

  const handleStartEdit = (memory: PinnedMemory) => {
    setEditingId(memory.id);
    setEditText(memory.content);
  };

  const handleSaveEdit = async (memoryId: number) => {
    const trimmed = editText.trim();
    if (!trimmed || !currentSessionId) return;
    try {
      await updatePinnedMemory(currentSessionId, memoryId, trimmed);
      setEditingId(null);
      setEditText("");
      await loadPinnedMemories();
    } catch {
      // silently fail
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleDeleteMemory = async (memoryId: number) => {
    if (!currentSessionId) return;
    try {
      await deletePinnedMemoryById(currentSessionId, memoryId);
      setPinnedMemories((prev) => prev.filter((m) => m.id !== memoryId));
      setDeleteConfirmMemoryId(null);
    } catch {
      setDeleteConfirmMemoryId(null);
    }
  };

  const handleDelete = useCallback(
    async (sessionId: string) => {
      setDeletingId(sessionId);
      try {
        await deleteConversation(sessionId);
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
        onConversationDeleted(sessionId);
      } finally {
        setDeletingId(null);
      }
    },
    [onConversationDeleted]
  );

  const moodMeta = moodState.latest
    ? getMoodMeta(moodState.latest.mood)
    : null;

  const renderSession = ({ item }: { item: SessionItem }) => {
    const isActive = item.session_id === currentSessionId;
    const isDeleting = deletingId === item.session_id;

    return (
      <TouchableOpacity
        style={[styles.sessionItem, isActive && styles.sessionItemActive]}
        onPress={() => {
          onSelectSession(item.session_id);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.sessionIcon}>
          <Text style={styles.sessionIconText}>💬</Text>
        </View>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionPreview} numberOfLines={1}>
            {item.preview}
          </Text>
          <Text style={styles.sessionTime}>{formatTime(item.last_at)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.session_id)}
          disabled={isDeleting}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#555" />
          ) : (
            <Text style={styles.deleteBtnText}>✕</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        pointerEvents={visible ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdropAnim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.drawerTitle}>Menu</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* New chat button */}
        <TouchableOpacity style={styles.newChatBtn} onPress={onNewChat} activeOpacity={0.8}>
          <Text style={styles.newChatIcon}>✦</Text>
          <Text style={styles.newChatText}>New Chat</Text>
        </TouchableOpacity>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "chats" && styles.tabActive]}
            onPress={() => setActiveTab("chats")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "chats" && styles.tabTextActive]}>
              Chats
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "memories" && styles.tabActive]}
            onPress={() => setActiveTab("memories")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "memories" && styles.tabTextActive]}>
              Memories
            </Text>
            {pinnedMemories.length > 0 && activeTab !== "memories" && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pinnedMemories.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Tab content ─────────────────────────────────────────────────── */}
        {activeTab === "chats" ? (
          <>
            {/* Mood Panel — only on chats tab */}
            <TouchableOpacity
              style={[
                styles.moodPanel,
                moodMeta && { borderColor: moodMeta.color + "44" },
              ]}
              onPress={() => setInsightVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.moodPanelTop}>
                <Text style={styles.moodPanelHeading}>Today's Mood</Text>
                {moodLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={styles.moodPanelArrow}>›</Text>
                )}
              </View>

              {moodState.latest && moodMeta ? (
                <View style={styles.moodPanelContent}>
                  <View style={[styles.moodIconBg, { backgroundColor: moodMeta.color + "22" }]}>
                    <Text style={styles.moodEmoji}>{moodMeta.emoji}</Text>
                  </View>
                  <View style={styles.moodPanelInfo}>
                    <Text style={[styles.moodName, { color: moodMeta.color }]}>
                      {moodMeta.label}
                    </Text>
                    <View style={styles.moodPills}>
                      <View style={styles.moodPill}>
                        <Text style={styles.moodPillText}>
                          ⚡ {moodState.latest.energy}
                        </Text>
                      </View>
                      <View style={styles.moodPill}>
                        <Text style={styles.moodPillText}>
                          🎯 {moodState.latest.focus}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.moodConfidence}>
                    {Math.round(moodState.latest.confidence * 100)}%
                  </Text>
                </View>
              ) : (
                <Text style={styles.moodNone}>
                  {moodLoading ? "Reading your state…" : "No mood detected yet"}
                </Text>
              )}

              {moodState.history.length > 0 && (
                <View style={styles.miniSparkline}>
                  {moodState.history.slice(-5).map((snap, i) => {
                    const meta = getMoodMeta(snap.mood);
                    return (
                      <View
                        key={i}
                        style={[styles.miniDot, { backgroundColor: meta.color }]}
                      />
                    );
                  })}
                </View>
              )}

              <Text style={styles.moodTapHint}>Tap for insight & suggestions →</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Recent</Text>
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.session_id}
              renderItem={renderSession}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No conversations yet</Text>
              }
            />
          </>
        ) : (
          /* ── Memories tab ────────────────────────────────────────────────── */
          <View style={styles.memoriesContainer}>
            {!currentSessionId ? (
              <View style={styles.noSessionContainer}>
                <Text style={styles.emptyText}>Start a chat to use pinned memories.</Text>
              </View>
            ) : (
              <>
                {/* Add new memory */}
                <View style={styles.addMemoryRow}>
                  <TextInput
                    style={styles.addMemoryInput}
                    value={newMemory}
                    onChangeText={setNewMemory}
                    placeholder="Add a memory…"
                    placeholderTextColor="#555"
                    multiline
                    maxLength={400}
                  />
                  <TouchableOpacity
                    style={[styles.addMemoryBtn, !newMemory.trim() && styles.addMemoryBtnDisabled]}
                    onPress={handleAddMemory}
                    disabled={!newMemory.trim() || addingMemory}
                    activeOpacity={0.75}
                  >
                    {addingMemory ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.addMemoryBtnText}>＋</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {loadingMemories ? (
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 24 }} />
                ) : pinnedMemories.length === 0 ? (
                  <Text style={[styles.emptyText, { marginTop: 20 }]}>
                    No pinned memories yet.{"\n"}Say "remember this…" in chat or add one above.
                  </Text>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                    {pinnedMemories.map((memory) => (
                      <View key={memory.id} style={styles.memoryItem}>
                        {editingId === memory.id ? (
                          <View style={styles.memoryEditContainer}>
                            <TextInput
                              style={styles.memoryEditInput}
                              value={editText}
                              onChangeText={setEditText}
                              multiline
                              autoFocus
                              maxLength={400}
                            />
                            <View style={styles.memoryEditActions}>
                              <TouchableOpacity
                                style={styles.editSaveBtn}
                                onPress={() => handleSaveEdit(memory.id)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.editSaveBtnText}>Save</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.editCancelBtn}
                                onPress={handleCancelEdit}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.editCancelBtnText}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <>
                            <Text style={styles.memoryContent} numberOfLines={3}>
                              {memory.content}
                            </Text>
                            <View style={styles.memoryActions}>
                              <TouchableOpacity
                                onPress={() => handleStartEdit(memory)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                <Text style={styles.memoryActionIcon}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setDeleteConfirmMemoryId(memory.id)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                <Text style={[styles.memoryActionIcon, styles.memoryDeleteIcon]}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        )}
      </Animated.View>

      {/* Mood Insight Modal */}
      <MoodInsightModal
        visible={insightVisible}
        onClose={() => setInsightVisible(false)}
        sessionId={currentSessionId}
        latest={moodState.latest}
        trend={moodState.trend}
        history={moodState.history}
      />

      {/* ── Delete Memory Confirm Modal ───────────────────────────────────────── */}
      <Modal
        visible={!!deleteConfirmMemoryId}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmMemoryId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Delete Memory?</Text>
            <Text style={styles.confirmBody}>
              This memory will be permanently removed and no longer referenced in future conversations.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setDeleteConfirmMemoryId(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() =>
                  deleteConfirmMemoryId !== null &&
                  handleDeleteMemory(deleteConfirmMemoryId)
                }
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 10,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 300,
    backgroundColor: "#0f0f14",
    zIndex: 11,
    borderRightWidth: 1,
    borderRightColor: "#1e1e28",
    paddingTop: 52,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  drawerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1e1e28",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    color: "#666",
    fontSize: 11,
    fontWeight: "700",
  },

  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 16,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: colors.accent + "18",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent + "33",
  },
  newChatIcon: {
    color: colors.accent,
    fontSize: 13,
  },
  newChatText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Mood panel ──────────────────────────────────────────────────────────────
  moodPanel: {
    marginHorizontal: 14,
    marginBottom: 16,
    backgroundColor: "#131320",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252530",
    padding: 14,
    gap: 10,
  },
  moodPanelTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  moodPanelHeading: {
    color: "#888",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  moodPanelArrow: {
    color: "#555",
    fontSize: 18,
    lineHeight: 18,
  },
  moodPanelContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  moodIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  moodEmoji: { fontSize: 22 },
  moodPanelInfo: { flex: 1, gap: 5 },
  moodName: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  moodPills: {
    flexDirection: "row",
    gap: 5,
  },
  moodPill: {
    backgroundColor: "#1e1e2a",
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  moodPillText: {
    color: "#aaa",
    fontSize: 10,
    fontWeight: "500",
  },
  moodConfidence: {
    color: "#555",
    fontSize: 11,
    fontWeight: "600",
  },
  moodNone: {
    color: "#555",
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 4,
  },

  // Mini sparkline dots
  miniSparkline: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  miniDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    opacity: 0.8,
  },

  moodTapHint: {
    color: "#444",
    fontSize: 11,
    fontStyle: "italic",
  },

  // ── Session list ────────────────────────────────────────────────────────────
  sectionLabel: {
    color: "#555",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 10, paddingBottom: 24 },
  emptyText: {
    color: "#444",
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
    fontStyle: "italic",
  },

  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  sessionItemActive: {
    backgroundColor: "#1a1a26",
  },
  sessionIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#1a1a22",
    justifyContent: "center",
    alignItems: "center",
  },
  sessionIconText: { fontSize: 14 },
  sessionInfo: { flex: 1, gap: 2 },
  sessionPreview: {
    color: "#ccc",
    fontSize: 13,
    fontWeight: "500",
  },
  sessionTime: {
    color: "#555",
    fontSize: 11,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnText: {
    color: "#444",
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Tabs ───────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e28",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    gap: 6,
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    color: "#555",
    fontSize: 14,
    fontWeight: "500",
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  // ── Memories tab ───────────────────────────────────────────────────────────
  memoriesContainer: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 12,
    flexDirection: "column",
  },
  noSessionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  addMemoryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 14,
  },
  addMemoryInput: {
    flex: 1,
    backgroundColor: "#131320",
    borderWidth: 1,
    borderColor: "#252530",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: "#ccc",
    fontSize: 14,
    maxHeight: 90,
  },
  addMemoryBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  addMemoryBtnDisabled: {
    backgroundColor: "#252530",
  },
  addMemoryBtnText: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },
  memoryItem: {
    backgroundColor: "#131320",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#252530",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  memoryContent: {
    flex: 1,
    color: "#ccc",
    fontSize: 13,
    lineHeight: 19,
  },
  memoryActions: {
    flexDirection: "column",
    gap: 6,
    marginLeft: 4,
    alignItems: "center",
  },
  memoryActionIcon: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555",
  },
  memoryDeleteIcon: {
    color: "#ef4444",
    opacity: 0.8,
  },
  memoryEditContainer: {
    flex: 1,
    gap: 8,
  },
  memoryEditInput: {
    backgroundColor: "#0f0f14",
    borderWidth: 1,
    borderColor: colors.accent + "88",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: "#ccc",
    fontSize: 13,
    maxHeight: 100,
  },
  memoryEditActions: {
    flexDirection: "row",
    gap: 8,
  },
  editSaveBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
  },
  editSaveBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  editCancelBtn: {
    flex: 1,
    backgroundColor: "#1e1e28",
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
  },
  editCancelBtnText: {
    color: "#888",
    fontSize: 13,
    fontWeight: "500",
  },

  // ── Confirm modal ──────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  confirmModal: {
    backgroundColor: "#0f0f14",
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: "#1e1e28",
  },
  confirmTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  confirmBody: {
    color: "#888",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#1a1a22",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#252530",
  },
  confirmCancelText: {
    color: "#ccc",
    fontSize: 15,
    fontWeight: "500",
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  confirmDeleteText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});