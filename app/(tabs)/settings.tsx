import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { AppSettings } from '../../src/lib/types';
import { getSettings, saveSettings } from '../../src/lib/storage';
import { generateOutline, AIDebugInfo } from '../../src/lib/ai';
import AIDebugModal from '../../src/components/AIDebugModal';

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

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({
    azureEndpoint: '',
    azureApiKey: '',
    azureDeployment: 'claude-opus-4-6',
    wordpressUrl: '',
    wordpressUsername: '',
    wordpressAppPassword: '',
  });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testModal, setTestModal] = useState<{ error: string; debugInfo?: AIDebugInfo } | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
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
            placeholder="https://<resource>.services.ai.azure.com/anthropic/v1/messages"
            hint="Full messages URL from Azure AI Foundry — includes /anthropic/v1/messages"
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
});
