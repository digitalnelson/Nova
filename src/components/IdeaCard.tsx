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

function estimateReadTime(idea: ArticleIdea): string {
  const text = [
    idea.title,
    idea.notes,
    idea.aiContent?.outline ?? '',
    idea.aiContent?.intro ?? '',
  ].join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

interface AIChip {
  label: string;
}

function getAIChips(idea: ArticleIdea): AIChip[] {
  const chips: AIChip[] = [];
  if (idea.aiContent?.outline) chips.push({ label: 'Outline' });
  if (idea.aiContent?.intro) chips.push({ label: 'Intro' });
  if (idea.aiContent?.improvedTitles?.length) {
    chips.push({ label: `${idea.aiContent.improvedTitles.length} titles` });
  }
  if (idea.aiContent?.suggestedTags?.length) chips.push({ label: 'Tags' });
  return chips;
}

export default function IdeaCard({ idea, onPress, onLongPress }: IdeaCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 20 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }).start();
  };

  const statusColor = StatusColors[idea.status] ?? Colors.statusDraft;
  const aiChips = getAIChips(idea);
  const hasAI = aiChips.length > 0;
  const visibleTags = idea.tags.slice(0, isTablet ? 4 : 3);
  const extraTags = idea.tags.length - visibleTags.length;
  const readTime = estimateReadTime(idea);

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <Pressable
        style={styles.card}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Colored top border — status accent */}
        <View style={[styles.topAccent, { backgroundColor: statusColor }]} />

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {idea.title}
          </Text>

          {/* Notes preview */}
          {!!idea.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {idea.notes}
            </Text>
          )}

          {/* AI content row — what has been generated */}
          {hasAI && (
            <View style={styles.aiRow}>
              <Text style={styles.aiRowIcon}>⚡</Text>
              <Text style={styles.aiRowText}>
                {aiChips.map((c) => c.label).join('  ·  ')}
              </Text>
            </View>
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

          {/* Footer */}
          <View style={styles.footer}>
            <View style={[styles.statusPill, { borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {StatusLabels[idea.status]}
              </Text>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.readTime}>{readTime}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.date}>{formatDate(idea.updatedAt)}</Text>
            </View>
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
    overflow: 'hidden',
  },
  topAccent: {
    height: 3,
  },
  content: {
    padding: 14,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  notes: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  // AI content strip
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  aiRowIcon: {
    fontSize: 12,
  },
  aiRowText: {
    color: Colors.accentBright,
    fontSize: 12,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
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
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  readTime: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  dot: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  date: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
