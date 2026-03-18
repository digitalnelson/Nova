import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { AIAction } from '../lib/types';
import {
  generateOutline,
  improveTitles,
  suggestTags,
  writeIntro,
} from '../lib/ai';

interface AIActionItem {
  action: AIAction;
  icon: string;
  label: string;
  description: string;
}

const AI_ACTIONS: AIActionItem[] = [
  {
    action: 'outline',
    icon: '📋',
    label: 'Generate Outline',
    description: 'Full article structure with sections',
  },
  {
    action: 'titles',
    icon: '✏️',
    label: 'Improve Title',
    description: '5 attention-grabbing alternatives',
  },
  {
    action: 'tags',
    icon: '🏷️',
    label: 'Suggest Tags',
    description: 'Relevant categories and keywords',
  },
  {
    action: 'intro',
    icon: '🖊️',
    label: 'Write Intro',
    description: 'A compelling opening paragraph',
  },
];

interface AIPanelProps {
  title: string;
  notes: string;
  apiKey: string;
  onTagsGenerated?: (tags: string[]) => void;
}

export default function AIPanel({ title, notes, apiKey, onTagsGenerated }: AIPanelProps) {
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [resultAction, setResultAction] = useState<AIAction | null>(null);

  const runAction = async (action: AIAction) => {
    if (!apiKey) {
      Alert.alert(
        'API Key Required',
        'Add your Anthropic API key in Settings to use AI features.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title Required', 'Add a title before using AI features.');
      return;
    }

    setActiveAction(action);
    setLoading(true);
    setResult('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let res;
    switch (action) {
      case 'outline':
        res = await generateOutline(apiKey, title, notes);
        break;
      case 'titles':
        res = await improveTitles(apiKey, title, notes);
        break;
      case 'tags':
        res = await suggestTags(apiKey, title, notes);
        break;
      case 'intro':
        res = await writeIntro(apiKey, title, notes);
        break;
    }

    setLoading(false);

    if (res.error) {
      Alert.alert('AI Error', res.error);
      setActiveAction(null);
      return;
    }

    setActiveAction(null);
    setResult(res.content);
    setResultAction(action);

    if (action === 'tags' && onTagsGenerated) {
      const tags = res.content
        .split(',')
        .map((t: string) => t.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 8);
      onTagsGenerated(tags);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.accentSoft, 'transparent']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerIcon}>⚡</Text>
        <View>
          <Text style={styles.headerTitle}>AI Tools</Text>
          <Text style={styles.headerSub}>Powered by Claude</Text>
        </View>
      </LinearGradient>

      {/* Action buttons */}
      <View style={styles.actionsGrid}>
        {AI_ACTIONS.map((item) => {
          const isActive = activeAction === item.action;
          const isLoading = loading && isActive;
          return (
            <Pressable
              key={item.action}
              style={[styles.actionBtn, isActive && styles.actionBtnActive]}
              onPress={() => runAction(item.action)}
              disabled={loading}
            >
              <View style={styles.actionIconContainer}>
                {isLoading ? (
                  <ActivityIndicator color={Colors.accent} size="small" />
                ) : (
                  <Text style={styles.actionIcon}>{item.icon}</Text>
                )}
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionLabel, isActive && styles.actionLabelActive]}>
                  {item.label}
                </Text>
                <Text style={styles.actionDesc}>{item.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Result */}
      {!!result && (
        <View style={styles.resultBox}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultLabel}>
              {AI_ACTIONS.find((a) => a.action === resultAction)?.icon}{' '}
              {AI_ACTIONS.find((a) => a.action === resultAction)?.label}
            </Text>
          </View>
          <ScrollView
            style={styles.resultScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <Text style={styles.resultText}>{result}</Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  actionsGrid: {
    padding: 12,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  actionIconContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 20,
    textAlign: 'center',
  },
  actionText: {
    flex: 1,
  },
  actionLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionLabelActive: {
    color: Colors.accentBright,
  },
  actionDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  resultBox: {
    margin: 12,
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  resultHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultLabel: {
    color: Colors.accentBright,
    fontSize: 13,
    fontWeight: '600',
  },
  resultScroll: {
    maxHeight: 260,
  },
  resultText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    padding: 12,
  },
});
