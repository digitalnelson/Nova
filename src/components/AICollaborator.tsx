import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import {
  collaborateOnArticle,
  CollaboratorOperation,
  AIDebugInfo,
} from '../lib/ai';
import AIDebugModal from './AIDebugModal';

interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

interface Operation {
  id: CollaboratorOperation;
  icon: string;
  label: string;
  description: string;
  hasInput?: boolean;
  inputPlaceholder?: string;
}

const OPERATIONS: Operation[] = [
  {
    id: 'improve',
    icon: '✨',
    label: 'Improve Writing',
    description: 'Polish clarity, flow & style throughout',
  },
  {
    id: 'strengthen-intro',
    icon: '🎯',
    label: 'Strengthen Intro',
    description: 'Rewrite the opening to hook readers immediately',
  },
  {
    id: 'medical-review',
    icon: '🩺',
    label: 'Medical Review',
    description: 'Add clinical nuance, accuracy & appropriate caveats',
  },
  {
    id: 'seo-optimize',
    icon: '📈',
    label: 'SEO Optimize',
    description: 'Sharpen headings & keywords for search',
  },
  {
    id: 'add-section',
    icon: '➕',
    label: 'Add Section',
    description: 'Insert a new section about a topic',
    hasInput: true,
    inputPlaceholder: 'What should the new section cover?',
  },
  {
    id: 'custom',
    icon: '💬',
    label: 'Custom Instruction',
    description: 'Tell the AI exactly what to change',
    hasInput: true,
    inputPlaceholder: 'e.g. "Add a clinical case example to the second section"',
  },
];

interface AICollaboratorProps {
  title: string;
  notes: string;
  azureConfig: AzureConfig;
  getArticleHtml: () => Promise<string>;
  onApplyChanges: (newHtml: string, label: string) => void;
}

export default function AICollaborator({
  title,
  notes,
  azureConfig,
  getArticleHtml,
  onApplyChanges,
}: AICollaboratorProps) {
  const [selectedOp, setSelectedOp] = useState<CollaboratorOperation | null>(null);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    error: string;
    debugInfo?: AIDebugInfo;
  } | null>(null);

  const selectedOpDef = OPERATIONS.find((o) => o.id === selectedOp);

  const handleRun = async () => {
    if (!selectedOp) return;
    if (!azureConfig.endpoint || !azureConfig.apiKey) {
      setErrorModal({ error: 'Azure AI is not configured. Go to Settings to add your credentials.' });
      return;
    }
    if (!title.trim()) {
      setErrorModal({ error: 'Add an article title before using the AI Collaborator.' });
      return;
    }
    if (selectedOpDef?.hasInput && !instruction.trim()) {
      setErrorModal({ error: `Please describe ${selectedOp === 'add-section' ? 'the new section' : 'your instruction'} before running.` });
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const html = await getArticleHtml();
    if (!html || html === '<p></p>') {
      setLoading(false);
      setErrorModal({ error: 'The article is empty. Write some content before collaborating with AI.' });
      return;
    }

    const res = await collaborateOnArticle(
      azureConfig,
      selectedOp,
      html,
      title,
      notes,
      instruction.trim() || undefined
    );

    setLoading(false);

    if (res.error) {
      setErrorModal({ error: res.error, debugInfo: res.debugInfo });
      return;
    }
    if (res.content) {
      setPreviewHtml(res.content);
      setPreviewVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleApply = () => {
    if (previewHtml) {
      onApplyChanges(previewHtml, selectedOpDef?.label ?? 'AI Revision');
      setPreviewVisible(false);
      setPreviewHtml(null);
      setInstruction('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleDiscard = () => {
    setPreviewVisible(false);
    setPreviewHtml(null);
  };

  return (
    <View style={styles.container}>
      <AIDebugModal
        visible={!!errorModal}
        error={errorModal?.error ?? ''}
        debugInfo={errorModal?.debugInfo}
        onClose={() => setErrorModal(null)}
      />

      {/* Preview Modal */}
      <Modal
        visible={previewVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleDiscard}
      >
        <View style={styles.previewModal}>
          <View style={styles.previewHeader}>
            <View>
              <Text style={styles.previewTitle}>AI Revision Preview</Text>
              <Text style={styles.previewSubtitle}>
                {selectedOpDef?.icon} {selectedOpDef?.label}
              </Text>
            </View>
            <Pressable style={styles.discardBtn} onPress={handleDiscard}>
              <Text style={styles.discardBtnText}>Discard</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.previewNote}>
              <Text style={styles.previewNoteText}>
                📝 This is the AI's revision of your article. Review it below, then apply or discard.
              </Text>
            </View>
            {/* Show raw HTML for preview — clean text extraction */}
            <Text style={styles.previewText}>
              {previewHtml
                ?.replace(/<\/?(h[1-6])[^>]*>/gi, (_, tag) => tag.toLowerCase().startsWith('h') ? '\n\n' : '\n')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<li>/gi, '\n• ')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&nbsp;/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim()}
            </Text>
          </ScrollView>

          <View style={styles.previewFooter}>
            <Pressable style={styles.discardFooterBtn} onPress={handleDiscard}>
              <Text style={styles.discardFooterText}>Discard</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={handleApply}>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                style={styles.applyBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.applyBtnText}>✓ Apply to Article</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <LinearGradient
        colors={['rgba(124,106,247,0.15)', 'transparent']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerIcon}>🤝</Text>
        <View>
          <Text style={styles.headerTitle}>AI Collaborator</Text>
          <Text style={styles.headerSub}>Revise, expand & refine your article</Text>
        </View>
      </LinearGradient>

      {/* Operation grid */}
      <View style={styles.opsGrid}>
        {OPERATIONS.map((op) => {
          const isSelected = selectedOp === op.id;
          return (
            <Pressable
              key={op.id}
              style={[styles.opBtn, isSelected && styles.opBtnSelected]}
              onPress={() => {
                setSelectedOp(isSelected ? null : op.id);
                setInstruction('');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              disabled={loading}
            >
              <Text style={styles.opIcon}>{op.icon}</Text>
              <View style={styles.opText}>
                <Text style={[styles.opLabel, isSelected && styles.opLabelSelected]}>
                  {op.label}
                </Text>
                <Text style={styles.opDesc}>{op.description}</Text>
              </View>
              {isSelected && <Text style={styles.opCheck}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      {/* Input for operations that need it */}
      {selectedOp && selectedOpDef?.hasInput && (
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.instructionInput}
            value={instruction}
            onChangeText={setInstruction}
            placeholder={selectedOpDef.inputPlaceholder}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={400}
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Run button */}
      {selectedOp && (
        <View style={styles.runRow}>
          <Pressable
            style={[styles.runBtn, loading && styles.runBtnDisabled]}
            onPress={handleRun}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.runBtnInner}>
                <ActivityIndicator size="small" color={Colors.white} />
                <Text style={styles.runBtnText}>AI is revising…</Text>
              </View>
            ) : (
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                style={styles.runBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.runBtnText}>
                  {selectedOpDef?.icon} Run {selectedOpDef?.label}
                </Text>
              </LinearGradient>
            )}
          </Pressable>
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
  // Header
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
  // Operation grid
  opsGrid: {
    padding: 12,
    gap: 8,
  },
  opBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  opBtnSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  opIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  opText: {
    flex: 1,
  },
  opLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  opLabelSelected: {
    color: Colors.accentBright,
  },
  opDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  opCheck: {
    color: Colors.accentBright,
    fontSize: 14,
    fontWeight: '700',
  },
  // Instruction input
  inputWrapper: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  instructionInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 70,
  },
  // Run button
  runRow: {
    padding: 12,
    paddingTop: 4,
  },
  runBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  runBtnDisabled: {
    opacity: 0.6,
  },
  runBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  runBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accentSoft,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  runBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  // Preview modal
  previewModal: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  previewTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  previewSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  discardBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  discardBtnText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: 20,
    paddingBottom: 40,
  },
  previewNote: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  previewNoteText: {
    color: Colors.accentBright,
    fontSize: 13,
    lineHeight: 18,
  },
  previewText: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  previewFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  discardFooterBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  discardFooterText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  applyBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
