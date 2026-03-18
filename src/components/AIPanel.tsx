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
  AIDebugInfo,
} from '../lib/ai';
import AIDebugModal from './AIDebugModal';

interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

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
  azureConfig: AzureConfig;
  onTagsGenerated?: (tags: string[]) => void;
  onInsertContent?: (content: string) => void;
}

export default function AIPanel({ title, notes, azureConfig, onTagsGenerated, onInsertContent }: AIPanelProps) {
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [resultAction, setResultAction] = useState<AIAction | null>(null);
  const [errorModal, setErrorModal] = useState<{ error: string; debugInfo?: AIDebugInfo } | null>(null);

  const runAction = async (action: AIAction) => {
    if (!azureConfig.endpoint || !azureConfig.apiKey) {
      Alert.alert(
        'Azure Configuration Required',
        'Add your Azure AI Foundry endpoint and API key in Settings to use AI features.',
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
        res = await generateOutline(azureConfig, title, notes);
        break;
      case 'titles':
        res = await improveTitles(azureConfig, title, notes);
        break;
      case 'tags':
        res = await suggestTags(azureConfig, title, notes);
        break;
      case 'intro':
        res = await writeIntro(azureConfig, title, notes);
        break;
    }

    setLoading(false);

    if (res.error) {
      setErrorModal({ error: res.error, debugInfo: res.debugInfo });
      setActiveAction(null);
      return;
    }

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
      <AIDebugModal
        visible={!!errorModal}
        error={errorModal?.error ?? ''}
        debugInfo={errorModal?.debugInfo}
        onClose={() => setErrorModal(null)}
      />
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
              {isLoading ? (
                <ActivityIndicator color={Colors.accent} size="small" />
              ) : (
                <Text style={styles.actionIcon}>{item.icon}</Text>
              )}
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
            {onInsertContent && (resultAction === 'outline' || resultAction === 'intro') && (
              <Pressable
                style={styles.insertBtn}
                onPress={() => {
                  onInsertContent(result);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Text style={styles.insertBtnText}>↙ Insert</Text>
              </Pressable>
            )}
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
  actionIcon: {
    fontSize: 20,
    width: 28,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultLabel: {
    color: Colors.accentBright,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  insertBtn: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  insertBtnText: {
    color: Colors.accentBright,
    fontSize: 12,
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
