import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, StatusColors, StatusLabels } from '../../src/constants/colors';
import { ArticleIdea, IdeaStatus } from '../../src/lib/types';
import { getIdeas, saveIdea, deleteIdea } from '../../src/lib/storage';
import { getSettings } from '../../src/lib/storage';
import TagPill from '../../src/components/TagPill';
import AIPanel from '../../src/components/AIPanel';

const STATUSES: IdeaStatus[] = ['draft', 'outlined', 'in-progress', 'published'];

export default function IdeaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [idea, setIdea] = useState<ArticleIdea | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<IdeaStatus>('draft');
  const [tagInput, setTagInput] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [azureConfig, setAzureConfig] = useState({ endpoint: '', apiKey: '', deployment: '' });
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const load = useCallback(async () => {
    const all = await getIdeas();
    const found = all.find((i) => i.id === id);
    if (found) {
      setIdea(found);
      setTitle(found.title);
      setNotes(found.notes);
      setTags(found.tags);
      setStatus(found.status);
    }
    const settings = await getSettings();
    setAzureConfig({
      endpoint: settings.azureEndpoint,
      apiKey: settings.azureApiKey,
      deployment: settings.azureDeployment,
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const markDirty = () => setIsDirty(true);

  const handleSave = async () => {
    if (!idea) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Please add a title.');
      return;
    }
    const updated: ArticleIdea = {
      ...idea,
      title: title.trim(),
      notes: notes.trim(),
      tags,
      status,
      updatedAt: new Date().toISOString(),
    };
    await saveIdea(updated);
    setIdea(updated);
    setIsDirty(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = () => {
    Alert.alert('Delete Idea', `Delete "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (idea) await deleteIdea(idea.id);
          router.back();
        },
      },
    ]);
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
      markDirty();
    }
    setTagInput('');
  };

  const handleAITagsGenerated = (suggested: string[]) => {
    setTags((prev) => {
      const merged = [...prev];
      for (const tag of suggested) {
        if (!merged.includes(tag)) merged.push(tag);
      }
      return merged.slice(0, 10);
    });
    markDirty();
  };

  if (!idea) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.textMuted }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = StatusColors[status];

  const mainContent = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={(v) => { setTitle(v); markDirty(); }}
        multiline
        placeholder="Article title"
        placeholderTextColor={Colors.textMuted}
      />

      {/* Status picker */}
      <Pressable
        style={[styles.statusRow, { borderColor: statusColor }]}
        onPress={() => setShowStatusPicker((v) => !v)}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusLabel, { color: statusColor }]}>
          {StatusLabels[status]}
        </Text>
        <Text style={styles.chevron}>{showStatusPicker ? '▲' : '▼'}</Text>
      </Pressable>

      {showStatusPicker && (
        <View style={styles.statusMenu}>
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              style={[styles.statusOption, status === s && styles.statusOptionActive]}
              onPress={() => {
                setStatus(s);
                setShowStatusPicker(false);
                markDirty();
              }}
            >
              <View style={[styles.statusDot, { backgroundColor: StatusColors[s] }]} />
              <Text style={[styles.statusOptionText, { color: StatusColors[s] }]}>
                {StatusLabels[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Notes */}
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={(v) => { setNotes(v); markDirty(); }}
        multiline
        placeholder="Notes, context, rough outline…"
        placeholderTextColor={Colors.textMuted}
        textAlignVertical="top"
      />

      {/* Tags */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Tags</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            style={styles.tagInput}
            placeholder="Add tag and press return"
            placeholderTextColor={Colors.textMuted}
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={() => { if (tagInput.trim()) addTag(tagInput); }}
            returnKeyType="done"
            autoCapitalize="none"
          />
        </View>
        {tags.length > 0 && (
          <View style={styles.tagsList}>
            {tags.map((tag) => (
              <TagPill
                key={tag}
                label={tag}
                onRemove={() => {
                  setTags((prev) => prev.filter((t) => t !== tag));
                  markDirty();
                }}
              />
            ))}
          </View>
        )}
      </View>

      {/* AI Panel toggle */}
      <Pressable
        style={[styles.aiToggle, showAI && styles.aiToggleActive]}
        onPress={() => {
          setShowAI((v) => !v);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <Text style={styles.aiToggleIcon}>⚡</Text>
        <Text style={[styles.aiToggleText, showAI && styles.aiToggleTextActive]}>
          {showAI ? 'Hide AI Tools' : 'AI Tools'}
        </Text>
        <Text style={styles.aiChevron}>{showAI ? '▲' : '▼'}</Text>
      </Pressable>

      {showAI && (
        <View style={styles.aiPanelWrapper}>
          <AIPanel
            title={title}
            notes={notes}
            azureConfig={azureConfig}
            onTagsGenerated={handleAITagsGenerated}
          />
        </View>
      )}

      {/* Danger zone */}
      <View style={styles.dangerZone}>
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Idea</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Nav bar */}
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          {isDirty && (
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                style={styles.saveBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.saveText}>Save</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {isTablet ? (
          // Tablet: side-by-side layout
          <View style={styles.tabletRow}>
            <View style={styles.tabletMain}>{mainContent}</View>
            <View style={styles.tabletSide}>
              <Text style={styles.sideHeader}>AI Tools</Text>
              <AIPanel
                title={title}
                notes={notes}
                azureConfig={azureConfig}
                onTagsGenerated={handleAITagsGenerated}
              />
            </View>
          </View>
        ) : (
          mainContent
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backText: {
    color: Colors.accent,
    fontSize: 17,
  },
  saveBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  titleInput: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 16,
    padding: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chevron: {
    color: Colors.textMuted,
    fontSize: 10,
    marginLeft: 4,
  },
  statusMenu: {
    backgroundColor: Colors.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  statusOptionActive: {
    backgroundColor: Colors.accentSoft,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesInput: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    padding: 0,
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  tagInputRow: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tagInput: {
    color: Colors.textPrimary,
    fontSize: 15,
    padding: 0,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  aiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  aiToggleActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  aiToggleIcon: {
    fontSize: 18,
  },
  aiToggleText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  aiToggleTextActive: {
    color: Colors.accentBright,
  },
  aiChevron: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  aiPanelWrapper: {
    marginBottom: 20,
  },
  dangerZone: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.dangerSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  deleteText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  // Tablet layout
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletMain: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  tabletSide: {
    width: 380,
    padding: 20,
  },
  sideHeader: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
});
