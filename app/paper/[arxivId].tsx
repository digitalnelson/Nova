import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { ArxivPaper, SavedPaper, ReadingStatus, ArticleIdea } from '../../src/lib/types';
import { fetchPaperById, formatAuthors, formatArxivDate } from '../../src/lib/arxiv';
import { getSavedPaper, savePaper, deleteSavedPaper, saveIdea, getSettings } from '../../src/lib/storage';
import { summarizePaperForClinicians, generateBlogIdeasFromPaper, AIDebugInfo } from '../../src/lib/ai';
import AIDebugModal from '../../src/components/AIDebugModal';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const READING_STATUSES: { value: ReadingStatus; label: string; color: string; icon: string }[] = [
  { value: 'to-read', label: 'To Read', color: Colors.textMuted, icon: '📌' },
  { value: 'reading', label: 'Reading', color: Colors.warning, icon: '📖' },
  { value: 'read', label: 'Read', color: Colors.success, icon: '✓' },
];

export default function PaperDetailScreen() {
  const { arxivId } = useLocalSearchParams<{ arxivId: string }>();
  const decodedId = decodeURIComponent(arxivId ?? '');

  const [paper, setPaper] = useState<ArxivPaper | null>(null);
  const [savedPaper, setSavedPaper] = useState<SavedPaper | null>(null);
  const [loadingPaper, setLoadingPaper] = useState(true);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ReadingStatus>('to-read');
  const [abstractExpanded, setAbstractExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // AI state
  const [loadingAI, setLoadingAI] = useState<'summary' | 'ideas' | null>(null);
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [blogIdeas, setBlogIdeas] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);
  const [errorModal, setErrorModal] = useState<{ error: string; debugInfo?: AIDebugInfo } | null>(null);

  const [azureConfig, setAzureConfig] = useState({ endpoint: '', apiKey: '', deployment: '' });

  useEffect(() => {
    getSettings().then((s) => setAzureConfig({
      endpoint: s.azureEndpoint,
      apiKey: s.azureApiKey,
      deployment: s.azureDeployment,
    }));
  }, []);

  const loadPaper = useCallback(async () => {
    setLoadingPaper(true);
    try {
      // Try saved first
      const saved = await getSavedPaper(decodedId);
      if (saved) {
        setPaper(saved.paper);
        setSavedPaper(saved);
        setNotes(saved.notes);
        setStatus(saved.status);
        setIsSaved(true);
        if (saved.clinicalSummary) setClinicalSummary(saved.clinicalSummary);
        if (saved.blogIdeas) setBlogIdeas(saved.blogIdeas);
      } else {
        // Fetch from ArXiv
        const fetched = await fetchPaperById(decodedId);
        if (fetched) {
          setPaper(fetched);
        } else {
          Alert.alert('Paper not found', 'Could not load this paper.');
          router.back();
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not load paper.');
    } finally {
      setLoadingPaper(false);
    }
  }, [decodedId]);

  useEffect(() => {
    loadPaper();
  }, [loadPaper]);

  const persistSave = useCallback(async (
    p: ArxivPaper,
    s: ReadingStatus,
    n: string,
    summary?: string,
    ideas?: string,
  ) => {
    const now = new Date().toISOString();
    const updated: SavedPaper = {
      paper: p,
      status: s,
      notes: n,
      savedAt: savedPaper?.savedAt ?? now,
      updatedAt: now,
      clinicalSummary: summary ?? savedPaper?.clinicalSummary,
      blogIdeas: ideas ?? savedPaper?.blogIdeas,
    };
    await savePaper(updated);
    setSavedPaper(updated);
    setIsSaved(true);
  }, [savedPaper]);

  const handleSaveToggle = async () => {
    if (!paper) return;
    if (isSaved) {
      Alert.alert('Remove Paper', 'Remove this paper from your saved list?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteSavedPaper(paper.id);
            setSavedPaper(null);
            setIsSaved(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]);
    } else {
      await persistSave(paper, status, notes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleStatusChange = async (s: ReadingStatus) => {
    setStatus(s);
    Haptics.selectionAsync();
    if (paper) {
      await persistSave(paper, s, notes);
    }
  };

  const handleNotesSave = async () => {
    if (paper && isSaved) {
      await persistSave(paper, status, notes);
    }
  };

  const handleClinicalSummary = async () => {
    if (!paper) return;
    if (!azureConfig.endpoint || !azureConfig.apiKey) {
      Alert.alert('AI not configured', 'Add your Azure AI credentials in Settings.');
      return;
    }
    setLoadingAI('summary');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await summarizePaperForClinicians(
      azureConfig,
      paper.title,
      paper.abstract,
      paper.categories,
    );
    setLoadingAI(null);
    if (res.error) {
      setErrorModal({ error: res.error, debugInfo: res.debugInfo });
      return;
    }
    setClinicalSummary(res.content);
    setShowSummary(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Auto-save if already saved
    if (paper && isSaved) {
      await persistSave(paper, status, notes, res.content, blogIdeas);
    }
  };

  const handleGenerateIdeas = async () => {
    if (!paper) return;
    if (!azureConfig.endpoint || !azureConfig.apiKey) {
      Alert.alert('AI not configured', 'Add your Azure AI credentials in Settings.');
      return;
    }
    setLoadingAI('ideas');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await generateBlogIdeasFromPaper(
      azureConfig,
      paper.title,
      paper.abstract,
      notes,
    );
    setLoadingAI(null);
    if (res.error) {
      setErrorModal({ error: res.error, debugInfo: res.debugInfo });
      return;
    }
    setBlogIdeas(res.content);
    setShowIdeas(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Auto-save if already saved
    if (paper && isSaved) {
      await persistSave(paper, status, notes, clinicalSummary, res.content);
    }
  };

  const handleCreateBlogIdea = async () => {
    if (!paper) return;
    const now = new Date().toISOString();
    const ideaNotes = [
      `Source: arXiv:${paper.id}`,
      `Authors: ${paper.authors.join(', ')}`,
      `Published: ${formatArxivDate(paper.published)}`,
      notes ? `\nNotes: ${notes}` : '',
      blogIdeas ? `\nBlog Ideas:\n${blogIdeas}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const idea: ArticleIdea = {
      id: generateId(),
      title: paper.title,
      notes: ideaNotes,
      content: '',
      tags: paper.categories.map((c) => c.toLowerCase().replace('.', '-')),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    await saveIdea(idea);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push(`/idea/${idea.id}`);
  };

  if (loadingPaper) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading paper…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!paper) return null;

  const shortAbstract = paper.abstract.slice(0, 280);
  const hasMoreAbstract = paper.abstract.length > 280;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AIDebugModal
        visible={!!errorModal}
        error={errorModal?.error ?? ''}
        debugInfo={errorModal?.debugInfo}
        onClose={() => setErrorModal(null)}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* ── Nav ── */}
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Pressable
            style={[styles.saveToggleBtn, isSaved && styles.saveToggleBtnActive]}
            onPress={handleSaveToggle}
          >
            <Text style={[styles.saveToggleIcon, isSaved && styles.saveToggleIconActive]}>
              {isSaved ? '★' : '☆'}
            </Text>
            <Text style={[styles.saveToggleText, isSaved && styles.saveToggleTextActive]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Categories ── */}
          <View style={styles.categoriesRow}>
            {paper.categories.slice(0, 4).map((cat) => (
              <View key={cat} style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{cat}</Text>
              </View>
            ))}
            <Text style={styles.dateText}>{formatArxivDate(paper.published)}</Text>
          </View>

          {/* ── Title ── */}
          <Text style={styles.title}>{paper.title}</Text>

          {/* ── Authors ── */}
          <Text style={styles.authors}>{paper.authors.join(', ')}</Text>

          {/* ── ArXiv ID + PDF ── */}
          <View style={styles.linksRow}>
            <Text style={styles.arxivId}>arXiv:{paper.id}</Text>
            <Pressable
              style={styles.pdfBtn}
              onPress={() => Linking.openURL(paper.pdfUrl)}
            >
              <Text style={styles.pdfBtnText}>📄 PDF</Text>
            </Pressable>
            <Pressable
              style={styles.pdfBtn}
              onPress={() => Linking.openURL(paper.abstractUrl)}
            >
              <Text style={styles.pdfBtnText}>🔗 Abstract</Text>
            </Pressable>
          </View>

          {/* ── Abstract ── */}
          <View style={styles.abstractBox}>
            <Text style={styles.sectionLabel}>Abstract</Text>
            <Text style={styles.abstractText}>
              {abstractExpanded ? paper.abstract : shortAbstract}
              {!abstractExpanded && hasMoreAbstract && '…'}
            </Text>
            {hasMoreAbstract && (
              <Pressable onPress={() => setAbstractExpanded((v) => !v)} style={styles.expandBtn}>
                <Text style={styles.expandBtnText}>
                  {abstractExpanded ? 'Show less' : 'Read full abstract'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* ── Reading status ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Reading Status</Text>
            <View style={styles.statusRow}>
              {READING_STATUSES.map((s) => (
                <Pressable
                  key={s.value}
                  style={[
                    styles.statusBtn,
                    status === s.value && { borderColor: s.color, backgroundColor: `${s.color}18` },
                  ]}
                  onPress={() => handleStatusChange(s.value)}
                >
                  <Text style={styles.statusBtnIcon}>{s.icon}</Text>
                  <Text style={[styles.statusBtnLabel, status === s.value && { color: s.color }]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Notes ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add your thoughts, key takeaways, questions…"
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              onBlur={handleNotesSave}
              returnKeyType="default"
            />
            {!isSaved && notes.length > 0 && (
              <Pressable style={styles.saveNotesBtn} onPress={() => paper && persistSave(paper, status, notes)}>
                <Text style={styles.saveNotesBtnText}>Save paper & notes</Text>
              </Pressable>
            )}
          </View>

          {/* ── AI Tools ── */}
          <View style={styles.aiSection}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiHeaderIcon}>⚡</Text>
              <Text style={styles.aiHeaderLabel}>AI Tools</Text>
              {(!azureConfig.endpoint || !azureConfig.apiKey) && (
                <Text style={styles.aiKeyHint}>  Configure Azure in Settings</Text>
              )}
            </View>

            <View style={styles.aiBtnsRow}>
              <Pressable
                style={[styles.aiBtn, showSummary && styles.aiBtnActive]}
                onPress={clinicalSummary ? () => setShowSummary((v) => !v) : handleClinicalSummary}
                disabled={loadingAI === 'summary'}
              >
                {loadingAI === 'summary' ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.aiBtnIcon}>{clinicalSummary ? '🩺' : '🩺'}</Text>
                )}
                <Text style={styles.aiBtnText}>
                  {clinicalSummary ? 'Clinical Summary' : 'Summarize for Clinicians'}
                </Text>
                {clinicalSummary && <Text style={styles.aiBtnDone}>✓</Text>}
              </Pressable>

              <Pressable
                style={[styles.aiBtn, showIdeas && styles.aiBtnActive]}
                onPress={blogIdeas ? () => setShowIdeas((v) => !v) : handleGenerateIdeas}
                disabled={loadingAI === 'ideas'}
              >
                {loadingAI === 'ideas' ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.aiBtnIcon}>💡</Text>
                )}
                <Text style={styles.aiBtnText}>
                  {blogIdeas ? 'Blog Ideas' : 'Generate Blog Ideas'}
                </Text>
                {blogIdeas && <Text style={styles.aiBtnDone}>✓</Text>}
              </Pressable>
            </View>

            {showSummary && clinicalSummary && (
              <View style={styles.aiResultBox}>
                <Text style={styles.aiResultLabel}>Clinical Summary</Text>
                <Text style={styles.aiResultText}>{clinicalSummary}</Text>
              </View>
            )}

            {showIdeas && blogIdeas && (
              <View style={styles.aiResultBox}>
                <Text style={styles.aiResultLabel}>Blog Post Ideas</Text>
                <Text style={styles.aiResultText}>{blogIdeas}</Text>
              </View>
            )}
          </View>

          {/* ── Create blog idea ── */}
          <Pressable style={styles.createIdeaBtn} onPress={handleCreateBlogIdea}>
            <LinearGradient
              colors={[Colors.gradientStart, Colors.gradientEnd]}
              style={styles.createIdeaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.createIdeaIcon}>✦</Text>
              <Text style={styles.createIdeaText}>Create Blog Post Idea</Text>
            </LinearGradient>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { color: Colors.textMuted, fontSize: 15 },
  // Nav
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: { paddingVertical: 4 },
  backText: { color: Colors.accent, fontSize: 17, fontWeight: '500' },
  saveToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveToggleBtnActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderColor: Colors.warning,
  },
  saveToggleIcon: { fontSize: 16, color: Colors.textMuted },
  saveToggleIconActive: { color: Colors.warning },
  saveToggleText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  saveToggleTextActive: { color: Colors.warning },
  // Content
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  categoriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  catBadge: {
    backgroundColor: 'rgba(74, 158, 234, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catBadgeText: { color: '#4A9EEA', fontSize: 11, fontWeight: '600' },
  dateText: { color: Colors.textMuted, fontSize: 12, marginLeft: 4 },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  authors: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 18,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  arxivId: { color: Colors.textMuted, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pdfBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pdfBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  // Abstract
  abstractBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  abstractText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  expandBtn: { marginTop: 8 },
  expandBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  // Section
  section: { marginBottom: 20 },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  // Reading status
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBtnIcon: { fontSize: 14 },
  statusBtnLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  // Notes
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
  },
  saveNotesBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  saveNotesBtnText: { color: Colors.accentBright, fontSize: 13, fontWeight: '600' },
  // AI
  aiSection: {
    backgroundColor: Colors.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 20,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  aiHeaderIcon: { fontSize: 14 },
  aiHeaderLabel: {
    color: Colors.accentBright,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  aiKeyHint: { color: Colors.textMuted, fontSize: 12 },
  aiBtnsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  aiBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 140,
  },
  aiBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  aiBtnIcon: { fontSize: 16 },
  aiBtnText: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  aiBtnDone: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  aiResultBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  aiResultLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  aiResultText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  // Create idea button
  createIdeaBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  createIdeaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  createIdeaIcon: { color: Colors.white, fontSize: 16 },
  createIdeaText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
