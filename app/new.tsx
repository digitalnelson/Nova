import React, { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../src/constants/colors';
import { saveIdea, getSettings } from '../src/lib/storage';
import { ArticleIdea, AIContent } from '../src/lib/types';
import { generateOutline, improveTitles, suggestTags, writeIntro } from '../src/lib/ai';
import TagPill from '../src/components/TagPill';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

type AIAction = 'outline' | 'titles' | 'tags' | 'intro';

const AI_ACTIONS: { action: AIAction; icon: string; label: string }[] = [
  { action: 'outline', icon: '📋', label: 'Outline' },
  { action: 'titles', icon: '✏️', label: 'Titles' },
  { action: 'tags', icon: '🏷️', label: 'Tags' },
  { action: 'intro', icon: '🖊️', label: 'Intro' },
];

export default function NewIdeaScreen() {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // AI state
  const [loadingAction, setLoadingAction] = useState<AIAction | null>(null);
  const [aiResults, setAiResults] = useState<Partial<Record<AIAction, string>>>({});
  const [expandedResult, setExpandedResult] = useState<AIAction | null>(null);

  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 300);
    getSettings().then((s) => setApiKey(s.anthropicApiKey));
  }, []);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
    setTagInput('');
  };

  const runAI = async (action: AIAction) => {
    if (!apiKey) {
      Alert.alert('API Key Required', 'Add your Anthropic API key in Settings to use AI features.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Add a title first', 'Give your idea a title before running AI tools.');
      return;
    }

    setLoadingAction(action);
    setExpandedResult(action);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let res;
    switch (action) {
      case 'outline': res = await generateOutline(apiKey, title, notes); break;
      case 'titles':  res = await improveTitles(apiKey, title, notes);   break;
      case 'tags':    res = await suggestTags(apiKey, title, notes);     break;
      case 'intro':   res = await writeIntro(apiKey, title, notes);      break;
    }

    setLoadingAction(null);

    if (res.error) {
      Alert.alert('AI Error', res.error);
      return;
    }

    setAiResults((prev) => ({ ...prev, [action]: res.content }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Auto-apply tags
    if (action === 'tags') {
      const suggested = res.content
        .split(',')
        .map((t: string) => t.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 8);
      setTags((prev) => {
        const merged = [...prev];
        for (const tag of suggested) {
          if (!merged.includes(tag)) merged.push(tag);
        }
        return merged.slice(0, 10);
      });
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your idea a title before saving.');
      return;
    }
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const aiContent: AIContent = {};
    if (aiResults.outline) aiContent.outline = aiResults.outline;
    if (aiResults.intro) aiContent.intro = aiResults.intro;
    if (aiResults.titles) {
      aiContent.improvedTitles = aiResults.titles
        .split('\n')
        .filter((l: string) => l.trim())
        .slice(0, 5);
    }
    if (aiResults.tags) {
      aiContent.suggestedTags = aiResults.tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);
    }

    const now = new Date().toISOString();
    const idea: ArticleIdea = {
      id: generateId(),
      title: title.trim(),
      notes: notes.trim(),
      tags,
      status: 'draft',
      aiContent: Object.keys(aiContent).length ? aiContent : undefined,
      createdAt: now,
      updatedAt: now,
    };

    await saveIdea(idea);
    setSaving(false);
    router.back();
  };

  const hasAnyResult = Object.keys(aiResults).length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Nav bar */}
        <View style={styles.navBar}>
          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.navTitle}>New Idea</Text>
          <Pressable
            style={[styles.saveBtn, (!title.trim() || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!title.trim() || saving}
          >
            <LinearGradient
              colors={title.trim() ? [Colors.gradientStart, Colors.gradientEnd] : [Colors.border, Colors.border]}
              style={styles.saveBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <TextInput
            ref={titleRef}
            style={styles.titleInput}
            placeholder="What's your idea?"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            multiline
            returnKeyType="next"
            blurOnSubmit
          />

          {/* Notes */}
          <TextInput
            style={styles.notesInput}
            placeholder="Add some notes, context, or a rough outline…"
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />

          {/* ── AI Quick Actions ── always visible, part of the flow */}
          <View style={styles.aiSection}>
            <View style={styles.aiSectionHeader}>
              <Text style={styles.aiSectionIcon}>⚡</Text>
              <Text style={styles.aiSectionLabel}>AI</Text>
              {!apiKey && (
                <Text style={styles.aiKeyHint}>  Add API key in Settings</Text>
              )}
            </View>
            <View style={styles.aiActionsRow}>
              {AI_ACTIONS.map(({ action, icon, label }) => {
                const isLoading = loadingAction === action;
                const isDone = !!aiResults[action];
                const isExpanded = expandedResult === action && isDone;
                return (
                  <Pressable
                    key={action}
                    style={[
                      styles.aiActionChip,
                      isDone && styles.aiActionChipDone,
                      isExpanded && styles.aiActionChipExpanded,
                    ]}
                    onPress={() => {
                      if (isDone && expandedResult === action) {
                        setExpandedResult(null);
                      } else if (isDone) {
                        setExpandedResult(action);
                      } else {
                        runAI(action);
                      }
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={Colors.accent} />
                    ) : (
                      <Text style={styles.aiActionIcon}>{isDone ? '✓' : icon}</Text>
                    )}
                    <Text style={[styles.aiActionLabel, isDone && styles.aiActionLabelDone]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Expanded result */}
            {expandedResult && aiResults[expandedResult] && (
              <View style={styles.resultBox}>
                <Text style={styles.resultText}>{aiResults[expandedResult]}</Text>
              </View>
            )}
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                placeholder="Add a tag and press return"
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
                    onRemove={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.modal,
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
  cancelBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  cancelText: { color: Colors.textSecondary, fontSize: 16 },
  navTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  saveBtn: { borderRadius: 20, overflow: 'hidden' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnGradient: { paddingHorizontal: 18, paddingVertical: 8 },
  saveText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  titleInput: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 16,
    padding: 0,
  },
  notesInput: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 90,
    padding: 0,
    marginBottom: 20,
  },
  // AI section
  aiSection: {
    backgroundColor: Colors.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 20,
  },
  aiSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 5,
  },
  aiSectionIcon: { fontSize: 14 },
  aiSectionLabel: {
    color: Colors.accentBright,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  aiKeyHint: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  aiActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  aiActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiActionChipDone: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  aiActionChipExpanded: {
    borderColor: Colors.accentBright,
  },
  aiActionIcon: { fontSize: 14 },
  aiActionLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  aiActionLabelDone: { color: Colors.accentBright, fontWeight: '600' },
  resultBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  resultText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  // Tags
  section: { marginBottom: 20 },
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
  tagInput: { color: Colors.textPrimary, fontSize: 15, padding: 0 },
  tagsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
