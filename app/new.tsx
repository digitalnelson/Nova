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
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../src/constants/colors';
import { saveIdea, getSettings } from '../src/lib/storage';
import { ArticleIdea } from '../src/lib/types';
import TagPill from '../src/components/TagPill';
import AIPanel from '../src/components/AIPanel';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function NewIdeaScreen() {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 300);
    getSettings().then((s) => setApiKey(s.anthropicApiKey));
  }, []);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setTagInput('');
  };

  const handleTagInputSubmit = () => {
    if (tagInput.trim()) addTag(tagInput);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your idea a title before saving.');
      return;
    }
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const now = new Date().toISOString();
    const idea: ArticleIdea = {
      id: generateId(),
      title: title.trim(),
      notes: notes.trim(),
      tags,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    await saveIdea(idea);
    setSaving(false);
    router.back();
  };

  const handleAITagsGenerated = (suggested: string[]) => {
    setTags((prev) => {
      const merged = [...prev];
      for (const tag of suggested) {
        if (!merged.includes(tag)) merged.push(tag);
      }
      return merged.slice(0, 10);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
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
          {/* Title input */}
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

          {/* Notes input */}
          <TextInput
            style={styles.notesInput}
            placeholder="Add some notes, context, or a quick outline…"
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />

          {/* Tags section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                placeholder="Add a tag and press return"
                placeholderTextColor={Colors.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleTagInputSubmit}
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

          {/* AI toggle */}
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

          {/* AI Panel */}
          {showAI && (
            <View style={styles.aiPanelWrapper}>
              <AIPanel
                title={title}
                notes={notes}
                apiKey={apiKey}
                onTagsGenerated={handleAITagsGenerated}
              />
            </View>
          )}
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
  cancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  navTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  saveBtnDisabled: {
    opacity: 0.5,
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
    paddingBottom: 40,
  },
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
    minHeight: 100,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tagInput: {
    flex: 1,
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
});
