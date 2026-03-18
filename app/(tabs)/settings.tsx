import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { AppSettings } from '../../src/lib/types';
import { getSettings, saveSettings } from '../../src/lib/storage';
import { generateOutline, AIDebugInfo } from '../../src/lib/ai';
import AIDebugModal from '../../src/components/AIDebugModal';
import {
  getLogs,
  clearLogs,
  subscribeToLogs,
  initLogger,
  LogEntry,
} from '../../src/lib/logger';

interface SettingRowProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  hint?: string;
}

function SettingRow({ label, value, onChangeText, placeholder, secure, hint }: SettingRowProps) {
  const [hidden, setHidden] = useState(secure ?? false);

  return (
    <View style={rowStyles.container}>
      <Text style={rowStyles.label}>{label}</Text>
      <View style={rowStyles.inputRow}>
        <TextInput
          style={rowStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
        {secure && (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8}>
            <Text style={rowStyles.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        )}
      </View>
      {hint && <Text style={rowStyles.hint}>{hint}</Text>}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    padding: 0,
  },
  toggleText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
});

// ─── Log level colours ────────────────────────────────────────────────────────
const LOG_LEVEL_COLORS: Record<string, string> = {
  info: Colors.textSecondary,
  debug: Colors.textMuted,
  warn: Colors.warning,
  error: Colors.danger,
};

function LogRow({ entry }: { entry: LogEntry }) {
  const ts = entry.ts.replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
  const color = LOG_LEVEL_COLORS[entry.level] ?? Colors.textMuted;
  return (
    <View style={logStyles.row}>
      <Text style={logStyles.ts}>{ts}</Text>
      <Text style={[logStyles.level, { color }]}>{entry.level.toUpperCase()}</Text>
      <Text style={[logStyles.tag, { color }]}>{entry.tag}</Text>
      <Text style={logStyles.message}>{entry.message}</Text>
    </View>
  );
}

const logStyles = StyleSheet.create({
  row: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 2,
  },
  ts: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  level: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  tag: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: 16,
  },
});

// Need Platform for font selection
import { Platform } from 'react-native';

// ─── Main Settings Screen ─────────────────────────────────────────────────────
export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({
    azureEndpoint: '',
    azureApiKey: '',
    azureDeployment: 'claude-opus-4-6',
    imageEndpoint: '',
    imageApiKey: '',
    imageDeployment: 'dall-e-3',
    wordpressUrl: '',
    wordpressUsername: '',
    wordpressAppPassword: '',
  });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testModal, setTestModal] = useState<{ error: string; debugInfo?: AIDebugInfo } | null>(null);

  // Debug logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');

  useEffect(() => {
    initLogger();
    getSettings().then(setSettings);
  }, []);

  // Subscribe to live log updates
  useEffect(() => {
    setLogs(getLogs());
    const unsub = subscribeToLogs(() => setLogs(getLogs()));
    return unsub;
  }, []);

  const update = (key: keyof AppSettings) => (value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!settings.azureEndpoint || !settings.azureApiKey) {
      Alert.alert('Missing Config', 'Enter an endpoint URL and API key first.');
      return;
    }
    setTesting(true);
    const config = {
      endpoint: settings.azureEndpoint,
      apiKey: settings.azureApiKey,
      deployment: settings.azureDeployment || 'claude-opus-4-6',
    };
    const res = await generateOutline(config, 'Connection test', '');
    setTesting(false);
    if (res.error) {
      setTestModal({ error: res.error, debugInfo: res.debugInfo });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Connection OK', 'Successfully connected to Azure AI Foundry.');
    }
  };

  const handleClearLogs = () => {
    Alert.alert('Clear Logs', 'Delete all debug logs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearLogs();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleShareLogs = async () => {
    const text = logs
      .slice()
      .reverse()
      .map((e) => `${e.ts} [${e.level.toUpperCase()}] ${e.tag} ${e.message}`)
      .join('\n');
    try {
      await Share.share({ message: text || '(no logs)', title: 'Nova Debug Logs' });
    } catch {
      // ignore
    }
  };

  const filteredLogs = logFilter === 'all' ? logs : logs.filter((e) => e.level === logFilter);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AIDebugModal
        visible={!!testModal}
        error={testModal?.error ?? ''}
        debugInfo={testModal?.debugInfo}
        onClose={() => setTestModal(null)}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* AI Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⚡</Text>
            <Text style={styles.sectionTitle}>AI — Azure AI Foundry</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Nova uses Claude via Azure AI Foundry. Your credentials are stored locally on your device.
          </Text>
          <SettingRow
            label="Endpoint URL"
            value={settings.azureEndpoint}
            onChangeText={update('azureEndpoint')}
            placeholder="https://<resource>.services.ai.azure.com/anthropic/"
            hint="Base URL ending in /anthropic/ — the app appends v1/messages?api-version automatically"
          />
          <SettingRow
            label="API Key"
            value={settings.azureApiKey}
            onChangeText={update('azureApiKey')}
            placeholder="Your Azure AI Foundry API key"
            secure
            hint="Found in Azure AI Foundry → your project → Keys and Endpoints"
          />
          <SettingRow
            label="Deployment Name"
            value={settings.azureDeployment}
            onChangeText={update('azureDeployment')}
            placeholder="claude-opus-4-6"
            hint="The model deployment name in your Azure AI Foundry project"
          />
          <View style={styles.testRow}>
            <Pressable
              style={[styles.testBtn, testing && styles.testBtnDisabled]}
              onPress={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator size="small" color={Colors.accentBright} />
              ) : (
                <Text style={styles.testBtnText}>Test Connection</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.linkBtn}
              onPress={() => Linking.openURL('https://ai.azure.com')}
            >
              <Text style={styles.linkText}>Open Azure AI Foundry →</Text>
            </Pressable>
          </View>
        </View>

        {/* Image Generation Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎨</Text>
            <Text style={styles.sectionTitle}>Image Generation — DALL·E 3</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Generates AI hero images for your articles using Azure OpenAI's DALL·E 3. Requires a separate Azure OpenAI resource (different from the Claude endpoint above).
          </Text>
          <SettingRow
            label="Azure OpenAI Endpoint"
            value={settings.imageEndpoint}
            onChangeText={update('imageEndpoint')}
            placeholder="https://<resource>.openai.azure.com/"
            hint="Azure OpenAI resource endpoint — ends in .openai.azure.com/"
          />
          <SettingRow
            label="API Key"
            value={settings.imageApiKey}
            onChangeText={update('imageApiKey')}
            placeholder="Azure OpenAI API key"
            secure
            hint="Found in Azure OpenAI resource → Keys and Endpoint"
          />
          <SettingRow
            label="Deployment Name"
            value={settings.imageDeployment}
            onChangeText={update('imageDeployment')}
            placeholder="dall-e-3"
            hint="Your DALL·E 3 deployment name in Azure OpenAI Studio"
          />
          <Pressable
            style={styles.linkBtn}
            onPress={() => Linking.openURL('https://oai.azure.com')}
          >
            <Text style={styles.linkText}>Open Azure OpenAI Studio →</Text>
          </Pressable>
        </View>

        {/* WordPress Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🌐</Text>
            <Text style={styles.sectionTitle}>WordPress</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Connect to your WordPress site to publish ideas directly. Uses the WordPress REST API with an application password.
          </Text>
          <SettingRow
            label="Site URL"
            value={settings.wordpressUrl}
            onChangeText={update('wordpressUrl')}
            placeholder="https://yoursite.com"
          />
          <SettingRow
            label="Username"
            value={settings.wordpressUsername}
            onChangeText={update('wordpressUsername')}
            placeholder="your-wp-username"
          />
          <SettingRow
            label="Application Password"
            value={settings.wordpressAppPassword}
            onChangeText={update('wordpressAppPassword')}
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            secure
            hint="Generate in WordPress → Users → Profile → Application Passwords"
          />
        </View>

        {/* ── Debug Logs Section ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Pressable
            style={styles.logsToggleRow}
            onPress={() => {
              setShowLogs((v) => !v);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🪲</Text>
              <Text style={styles.sectionTitle}>Debug Logs</Text>
            </View>
            <View style={styles.logsToggleRight}>
              <View style={styles.logCountBadge}>
                <Text style={styles.logCountText}>{logs.length}</Text>
              </View>
              <Text style={styles.logsChevron}>{showLogs ? '▲' : '▼'}</Text>
            </View>
          </Pressable>

          {!showLogs && (
            <Text style={styles.sectionDesc}>
              Real-time logs from the editing screen and AI calls. Tap to expand.
            </Text>
          )}

          {showLogs && (
            <>
              {/* Filter row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterRow}
              >
                {(['all', 'info', 'debug', 'warn', 'error'] as const).map((level) => (
                  <Pressable
                    key={level}
                    style={[
                      styles.filterChip,
                      logFilter === level && styles.filterChipActive,
                    ]}
                    onPress={() => setLogFilter(level)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        logFilter === level && styles.filterChipTextActive,
                        level !== 'all' && { color: LOG_LEVEL_COLORS[level] },
                      ]}
                    >
                      {level === 'all' ? 'All' : level.toUpperCase()}
                      {level !== 'all' && (
                        <Text style={styles.filterChipCount}>
                          {' '}({logs.filter((e) => e.level === level).length})
                        </Text>
                      )}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Action buttons */}
              <View style={styles.logsActionRow}>
                <Pressable style={styles.logsActionBtn} onPress={handleShareLogs}>
                  <Text style={styles.logsActionText}>Share Logs</Text>
                </Pressable>
                <Pressable style={[styles.logsActionBtn, styles.logsActionBtnDanger]} onPress={handleClearLogs}>
                  <Text style={[styles.logsActionText, styles.logsActionTextDanger]}>Clear</Text>
                </Pressable>
              </View>

              {/* Log entries */}
              <View style={styles.logsContainer}>
                {filteredLogs.length === 0 ? (
                  <View style={styles.logsEmpty}>
                    <Text style={styles.logsEmptyText}>No logs yet. Open an idea to start logging.</Text>
                  </View>
                ) : (
                  filteredLogs.map((entry, idx) => (
                    <LogRow key={idx} entry={entry} />
                  ))
                )}
              </View>
            </>
          )}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>✨</Text>
            <Text style={styles.sectionTitle}>About Nova</Text>
          </View>
          <View style={styles.aboutCard}>
            <Text style={styles.aboutAppName}>Nova</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
            <Text style={styles.aboutDesc}>
              AI-first article idea capture for WordPress writers.{'\n'}Built with Expo + Claude.
            </Text>
          </View>
        </View>

        {/* Save button */}
        <Pressable
          style={[styles.saveBtn, saved && styles.saveBtnSaved]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  testBtn: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 130,
    alignItems: 'center',
  },
  testBtnDisabled: {
    opacity: 0.5,
  },
  testBtnText: {
    color: Colors.accentBright,
    fontSize: 13,
    fontWeight: '600',
  },
  linkBtn: {
    alignSelf: 'flex-start',
    marginTop: -4,
  },
  linkText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  aboutCard: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  aboutAppName: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  aboutVersion: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 10,
  },
  aboutDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnSaved: {
    backgroundColor: Colors.success,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Debug logs ──────────────────────────────────────────────────────────────
  logsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logsToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logCountBadge: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logCountText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  logsChevron: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  filterChip: {
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  filterChipText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.accentBright,
  },
  filterChipCount: {
    fontWeight: '400',
  },
  logsActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  logsActionBtn: {
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  logsActionBtnDanger: {
    borderColor: 'rgba(255,107,107,0.4)',
    backgroundColor: Colors.dangerSoft,
  },
  logsActionText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  logsActionTextDanger: {
    color: Colors.danger,
  },
  logsContainer: {
    backgroundColor: Colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 400,
    overflow: 'hidden',
  },
  logsEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  logsEmptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
