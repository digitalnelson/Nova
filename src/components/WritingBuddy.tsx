import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { buddyAssist, BuddyResponse, AIDebugInfo } from '../lib/ai';
import AIDebugModal from './AIDebugModal';

interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

interface WritingBuddyProps {
  title: string;
  notes: string;
  azureConfig: AzureConfig;
  getArticleHtml: () => Promise<string>;
  onInsertContent: (html: string) => void;
  onReplaceContent: (html: string) => void;
}

const QUICK_CHIPS = [
  { label: 'Write intro', command: 'Write a compelling introduction for this article' },
  { label: 'Generate outline', command: 'Generate a full article outline with sections and bullet points' },
  { label: 'Improve writing', command: 'Improve the writing quality, clarity, and flow throughout the article' },
  { label: 'Suggest titles', command: 'Suggest 5 improved article titles' },
  { label: 'Strengthen intro', command: 'Rewrite and strengthen the introduction to hook readers immediately' },
  { label: 'SEO optimize', command: 'SEO optimize the article headings and structure' },
];

export default function WritingBuddy({
  title,
  notes,
  azureConfig,
  getArticleHtml,
  onInsertContent,
  onReplaceContent,
}: WritingBuddyProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'working' | 'done' | 'error' | 'info' } | null>(null);
  const [infoResult, setInfoResult] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{ error: string; debugInfo?: AIDebugInfo } | null>(null);

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (text: string, type: 'working' | 'done' | 'error' | 'info', duration = 3000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, type });
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (type !== 'working') {
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
          setToast(null)
        );
      }, duration);
    }
  };

  const dismissToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setToast(null)
    );
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const runCommand = async (cmd: string) => {
    if (!cmd.trim()) return;
    if (!azureConfig.endpoint || !azureConfig.apiKey) {
      setErrorModal({ error: 'Configure your Azure AI settings in Settings before using the Writing Buddy.' });
      return;
    }
    if (!title.trim()) {
      setErrorModal({ error: 'Add an article title before using the Writing Buddy.' });
      return;
    }

    setSheetOpen(false);
    setCommand('');
    setInfoResult(null);
    setBusy(true);
    showToast('✦ Working…', 'working');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const html = await getArticleHtml();
    const res: BuddyResponse = await buddyAssist(azureConfig, cmd, title, notes, html);

    setBusy(false);
    dismissToast();

    if (res.error) {
      setErrorModal({ error: res.error, debugInfo: res.debugInfo });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (res.action === 'insert') {
      onInsertContent(res.content);
      showToast(`✓ ${res.label}`, 'done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (res.action === 'replace') {
      onReplaceContent(res.content);
      showToast(`✓ ${res.label}`, 'done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // info — show in sheet
      setInfoResult(res.content);
      setSheetOpen(true);
      showToast(`✓ ${res.label}`, 'done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const toastBg =
    toast?.type === 'done' ? 'rgba(78,205,196,0.15)' :
    toast?.type === 'error' ? 'rgba(255,107,107,0.15)' :
    toast?.type === 'info' ? Colors.accentSoft :
    Colors.accentSoft;

  const toastBorder =
    toast?.type === 'done' ? Colors.success :
    toast?.type === 'error' ? Colors.danger :
    Colors.accent;

  return (
    <>
      <AIDebugModal
        visible={!!errorModal}
        error={errorModal?.error ?? ''}
        debugInfo={errorModal?.debugInfo}
        onClose={() => setErrorModal(null)}
      />

      {/* Toast */}
      {toast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity, backgroundColor: toastBg, borderColor: toastBorder }]}>
          {toast.type === 'working' && <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: 8 }} />}
          <Text style={[styles.toastText, toast.type === 'done' && { color: Colors.success }, toast.type === 'error' && { color: Colors.danger }]}>
            {toast.text}
          </Text>
        </Animated.View>
      )}

      {/* FAB */}
      <Pressable
        style={[styles.fab, busy && styles.fabBusy]}
        onPress={() => {
          if (!busy) {
            setSheetOpen(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }}
        disabled={busy}
      >
        <LinearGradient
          colors={busy ? ['#3A3A5A', '#2A2A4A'] : [Colors.gradientStart, Colors.gradientEnd]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={Colors.accentBright} />
          ) : (
            <Text style={styles.fabIcon}>✦</Text>
          )}
        </LinearGradient>
      </Pressable>

      {/* Bottom sheet */}
      <Modal
        visible={sheetOpen}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                style={styles.sheetHeaderIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={{ fontSize: 14 }}>✦</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Writing Buddy</Text>
                <Text style={styles.sheetSub}>What can I help you write?</Text>
              </View>
              <Pressable onPress={() => setSheetOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Info result */}
            {infoResult && (
              <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                <Text style={styles.infoText}>{infoResult}</Text>
              </ScrollView>
            )}

            {/* Quick chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
              contentContainerStyle={styles.chipsContent}
            >
              {QUICK_CHIPS.map((chip) => (
                <Pressable
                  key={chip.label}
                  style={styles.chip}
                  onPress={() => runCommand(chip.command)}
                >
                  <Text style={styles.chipText}>{chip.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Input row */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={command}
                onChangeText={setCommand}
                placeholder="Ask anything about your article…"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={300}
                returnKeyType="send"
                onSubmitEditing={() => runCommand(command)}
              />
              <Pressable
                style={[styles.sendBtn, !command.trim() && styles.sendBtnDisabled]}
                onPress={() => runCommand(command)}
                disabled={!command.trim()}
              >
                <LinearGradient
                  colors={command.trim() ? [Colors.gradientStart, Colors.gradientEnd] : ['#2A2A3A', '#2A2A3A']}
                  style={styles.sendBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.sendBtnIcon}>↑</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const FAB_SIZE = 52;

const styles = StyleSheet.create({
  // Toast
  toast: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    zIndex: 999,
    maxWidth: 280,
  },
  toastText: {
    color: Colors.accentBright,
    fontSize: 14,
    fontWeight: '600',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 62,
    right: 16,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  fabBusy: {
    shadowOpacity: 0.1,
  },
  fabGradient: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  // Bottom sheet
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: Colors.elevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  sheetSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  // Info result
  infoScroll: {
    maxHeight: 160,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    padding: 12,
  },
  // Quick chips
  chipsScroll: {
    marginTop: 12,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    color: Colors.accentBright,
    fontSize: 13,
    fontWeight: '600',
  },
  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnGradient: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnIcon: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
});
