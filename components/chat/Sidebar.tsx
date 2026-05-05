import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import {
  fetchSessions,
  fetchPinnedMemories,
  addPinnedMemory,
  updatePinnedMemory,
  deletePinnedMemoryById,
  deleteConversation,
  SessionItem,
  PinnedMemory,
} from "../../lib/services/api";
import { colors } from "../../lib/theme/colors";

const SIDEBAR_WIDTH = Dimensions.get("window").width * 0.78;
type Tab = "chats" | "memories";

interface Props {
  visible: boolean;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  /** Called after a conversation is deleted so the parent can reset state */
  onConversationDeleted: (sessionId: string) => void;
}

export const Sidebar: React.FC<Props> = ({
  visible,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onClose,
  onConversationDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [pinnedMemories, setPinnedMemories] = useState<PinnedMemory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  // New memory input
  const [newMemory, setNewMemory] = useState("");
  const [addingMemory, setAddingMemory] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // Delete conversation confirm modal
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<string | null>(null);
  // Delete memory confirm modal
  const [deleteConfirmMemoryId, setDeleteConfirmMemoryId] = useState<number | null>(null);

  const slideAnim = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;

  // ── Animations ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      fetchSessions().then(setSessions).catch(() => {});
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
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
  }, [visible]);

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

  // ── Pinned memory actions ────────────────────────────────────────────────────

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

  // ── Delete conversation ──────────────────────────────────────────────────────

  const handleDeleteConversation = async (sessionId: string) => {
    try {
      await deleteConversation(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      setDeleteConfirmSession(null);
      onConversationDeleted(sessionId);
      if (sessionId === currentSessionId) {
        onClose();
      }
    } catch {
      setDeleteConfirmSession(null);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const renderChats = () => (
    <FlatList
      data={sessions}
      keyExtractor={(item) => item.session_id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No previous chats yet.</Text>
      }
      renderItem={({ item }) => {
        const isActive = item.session_id === currentSessionId;
        return (
          <View style={[styles.sessionItem, isActive && styles.sessionItemActive]}>
            <TouchableOpacity
              style={styles.sessionItemMain}
              onPress={() => {
                onSelectSession(item.session_id);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.sessionPreview} numberOfLines={2}>
                {item.preview}
              </Text>
              <Text style={styles.sessionDate}>{formatDate(item.last_at)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteSessionBtn}
              onPress={() => setDeleteConfirmSession(item.session_id)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteSessionIcon}>Delete</Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );

  const renderMemories = () => {
    if (!currentSessionId) {
      return (
        <View style={styles.noSessionContainer}>
          <Text style={styles.emptyText}>Start a chat to use pinned memories.</Text>
        </View>
      );
    }

    return (
      <View style={styles.memoriesContainer}>
        {/* Add new memory */}
        <View style={styles.addMemoryRow}>
          <TextInput
            style={styles.addMemoryInput}
            value={newMemory}
            onChangeText={setNewMemory}
            placeholder="Add a memory…"
            placeholderTextColor={colors.textMuted}
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

        {/* Memory list */}
        {loadingMemories ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={{ marginTop: 24 }}
          />
        ) : pinnedMemories.length === 0 ? (
          <Text style={[styles.emptyText, { marginTop: 20 }]}>
            No pinned memories yet.{"\n"}Say "remember this…" in chat or add one above.
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {pinnedMemories.map((memory) => (
              <View key={memory.id} style={styles.memoryItem}>
                {editingId === memory.id ? (
                  // ── Edit mode ────────────────────────────────────────────
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
                  // ── View mode ─────────────────────────────────────────────
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
      </View>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          pointerEvents={visible ? "auto" : "none"}
          style={[styles.backdrop, { opacity: backdropAnim }]}
        />
      </TouchableWithoutFeedback>

      {/* Sidebar panel */}
      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}
      >
        {/* Header */}
        <View style={styles.sidebarHeader}>
          <View style={styles.headerTop}>
            <Text style={styles.sidebarTitle}>Menu</Text>
            <TouchableOpacity
              style={styles.newChatBtn}
              onPress={onNewChat}
              activeOpacity={0.75}
            >
              <Text style={styles.newChatIcon}>✎</Text>
              <Text style={styles.newChatText}>New Chat</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "chats" && styles.tabActive]}
              onPress={() => setActiveTab("chats")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "chats" && styles.tabTextActive,
                ]}
              >
                Chats
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "memories" && styles.tabActive]}
              onPress={() => setActiveTab("memories")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "memories" && styles.tabTextActive,
                ]}
              >
                Memories
              </Text>
              {pinnedMemories.length > 0 && activeTab !== "memories" && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pinnedMemories.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab content */}
        {activeTab === "chats" ? renderChats() : renderMemories()}
      </Animated.View>

      {/* ── Delete Conversation Confirm Modal ─────────────────────────────────── */}
      <Modal
        visible={!!deleteConfirmSession}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmSession(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Delete Conversation?</Text>
            <Text style={styles.confirmBody}>
              This will permanently remove all messages in this chat. Pinned memories will be kept.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setDeleteConfirmSession(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() =>
                  deleteConfirmSession &&
                  handleDeleteConversation(deleteConfirmSession)
                }
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.surface,
    zIndex: 11,
    borderRightWidth: 1,
    borderRightColor: colors.borderSubtle,
    display: "flex",
    flexDirection: "column",
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  sidebarHeader: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sidebarTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentDim,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.accent + "44",
  },
  newChatIcon: {
    color: colors.accent,
    fontSize: 14,
  },
  newChatText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Tabs ───────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: "row",
    gap: 4,
    paddingBottom: 0,
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
    color: colors.textSecondary,
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

  // ── Chat list ──────────────────────────────────────────────────────────────
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  sessionItem: {
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  sessionItemActive: {
    backgroundColor: colors.accentDim,
  },
  sessionItemMain: {
    flex: 1,
    gap: 3,
  },
  sessionPreview: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  sessionDate: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  deleteSessionBtn: {
    padding: 6,
    borderRadius: 6,
    marginLeft: 4,
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  deleteSessionIcon: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ef4444",
    opacity: 0.8,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 16,
    lineHeight: 20,
  },

  // ── Memories tab ───────────────────────────────────────────────────────────
  memoriesContainer: {
    flex: 1,
    paddingTop: 14,
    paddingHorizontal: 12,
    display: "flex",
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.textPrimary,
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
    backgroundColor: colors.sendButtonDisabled ?? colors.borderSubtle,
  },
  addMemoryBtnText: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },

  memoryItem: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  memoryContent: {
    flex: 1,
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  memoryDeleteIcon: {
    color: "#ef4444",
    opacity: 0.8,
  },

  // Edit mode
  memoryEditContainer: {
    flex: 1,
    gap: 8,
  },
  memoryEditInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent + "88",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: colors.textPrimary,
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
    backgroundColor: colors.borderSubtle,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
  },
  editCancelBtnText: {
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  confirmBody: {
    color: colors.textSecondary,
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
    backgroundColor: colors.background,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: {
    color: colors.textPrimary,
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