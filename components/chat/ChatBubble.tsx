import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors } from "../../lib/theme/colors";

interface Props {
  role: "user" | "assistant";
  content: string;
}

// ── Markdown parser ───────────────────────────────────────────────────────────

type Segment = { text: string; bold?: boolean; italic?: boolean };

/** Parse inline **bold** and *italic* markers into segments. */
function parseInline(raw: string): Segment[] {
  const segments: Segment[] = [];
  // Match **bold**, *italic* — order matters (bold first)
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined) {
      segments.push({ text: match[2], italic: true });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    segments.push({ text: raw.slice(lastIndex) });
  }
  return segments;
}

function InlineText({ segments, baseStyle }: { segments: Segment[]; baseStyle: object }) {
  return (
    <Text>
      {segments.map((seg, i) => (
        <Text
          key={i}
          style={[
            baseStyle,
            seg.bold && styles.bold,
            seg.italic && styles.italic,
          ]}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

type Block =
  | { type: "paragraph"; segments: Segment[] }
  | { type: "bullet"; segments: Segment[] }
  | { type: "numbered"; n: number; segments: Segment[] }
  | { type: "header"; segments: Segment[] };

/** Split content into semantic blocks. */
function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    // Numbered list: "1. " or "12. "
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      blocks.push({
        type: "numbered",
        n: parseInt(numberedMatch[1], 10),
        segments: parseInline(numberedMatch[2]),
      });
      continue;
    }

    // Bullet: "• " or "- "
    const bulletMatch = line.match(/^[•\-]\s+(.+)/);
    if (bulletMatch) {
      blocks.push({ type: "bullet", segments: parseInline(bulletMatch[1]) });
      continue;
    }

    // Header: "**Header:**" pattern (bold line ending with colon)
    const headerMatch = line.match(/^\*\*(.+:)\*\*$/);
    if (headerMatch) {
      blocks.push({ type: "header", segments: [{ text: headerMatch[1] }] });
      continue;
    }

    blocks.push({ type: "paragraph", segments: parseInline(line) });
  }

  return blocks;
}

function MarkdownBody({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <View>
      {blocks.map((block, i) => {
        if (block.type === "header") {
          return (
            <Text key={i} style={styles.headerText}>
              {block.segments[0].text}
            </Text>
          );
        }
        if (block.type === "bullet") {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <View style={styles.bulletContent}>
                <InlineText segments={block.segments} baseStyle={styles.assistantText} />
              </View>
            </View>
          );
        }
        if (block.type === "numbered") {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.numberedIndex}>{block.n}.</Text>
              <View style={styles.bulletContent}>
                <InlineText segments={block.segments} baseStyle={styles.assistantText} />
              </View>
            </View>
          );
        }
        // paragraph
        return (
          <Text key={i} style={[styles.assistantText, i > 0 && styles.paragraphSpacing]}>
            {block.segments.map((seg, j) => (
              <Text
                key={j}
                style={[
                  styles.assistantText,
                  seg.bold && styles.bold,
                  seg.italic && styles.italic,
                ]}
              >
                {seg.text}
              </Text>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

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
            <MarkdownBody content={content} />
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
  bold: {
    fontWeight: "700",
    color: "#ffffff",
  },
  italic: {
    fontStyle: "italic",
    color: "#d0d0d0",
  },
  headerText: {
    color: colors.accent ?? "#a78bfa",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 4,
    marginTop: 6,
    textTransform: "uppercase",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 2,
    gap: 8,
  },
  bulletDot: {
    color: colors.accent ?? "#a78bfa",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "700",
  },
  numberedIndex: {
    color: colors.accent ?? "#a78bfa",
    fontSize: 14,
    lineHeight: 24,
    fontWeight: "700",
    minWidth: 20,
  },
  bulletContent: {
    flex: 1,
  },
  paragraphSpacing: {
    marginTop: 6,
  },
});