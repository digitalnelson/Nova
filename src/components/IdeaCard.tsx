import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { ArticleIdea } from '../lib/types';
import { Colors, StatusColors, StatusLabels } from '../constants/colors';
import TagPill from './TagPill';

interface IdeaCardProps {
  idea: ArticleIdea;
  onPress: () => void;
  onLongPress?: () => void;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function IdeaCard({ idea, onPress, onLongPress }: IdeaCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const hasAI = !!(
    idea.aiContent?.outline ||
    idea.aiContent?.intro ||
    idea.aiContent?.improvedTitles?.length
  );

  const statusColor = StatusColors[idea.status] ?? Colors.statusDraft;
  const visibleTags = idea.tags.slice(0, isTablet ? 4 : 3);
  const extraTags = idea.tags.length - visibleTags.length;

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <Pressable
        style={styles.card}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Status bar on left edge */}
        <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

        <View style={styles.content}>
          {/* Top row: title + AI badge */}
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={2}>
              {idea.title}
            </Text>
            {hasAI && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>⚡</Text>
              </View>
            )}
          </View>

          {/* Notes preview */}
          {!!idea.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {idea.notes}
            </Text>
          )}

          {/* Tags */}
          {idea.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {visibleTags.map((tag) => (
                <TagPill key={tag} label={tag} small />
              ))}
              {extraTags > 0 && (
                <Text style={styles.moreTags}>+{extraTags}</Text>
              )}
            </View>
          )}

          {/* Footer: status + date */}
          <View style={styles.footer}>
            <View style={[styles.statusPill, { borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {StatusLabels[idea.status]}
              </Text>
            </View>
            <Text style={styles.date}>{formatDate(idea.updatedAt)}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  statusBar: {
    width: 3,
    borderRadius: 2,
    margin: 12,
    marginRight: 0,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    minHeight: 40,
  },
  content: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  aiBadge: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 1,
  },
  aiBadgeText: {
    fontSize: 12,
  },
  notes: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  moreTags: {
    color: Colors.textMuted,
    fontSize: 11,
    alignSelf: 'center',
    marginLeft: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    opacity: 0.85,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  date: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
