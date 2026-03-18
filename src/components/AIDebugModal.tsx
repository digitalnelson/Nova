import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Share,
  StyleSheet,
} from 'react-native';
import { Colors } from '../constants/colors';
import { AIDebugInfo } from '../lib/ai';

interface Props {
  visible: boolean;
  error: string;
  debugInfo?: AIDebugInfo;
  onClose: () => void;
}

export default function AIDebugModal({ visible, error, debugInfo, onClose }: Props) {
  const shareText = debugInfo
    ? [
        `=== AI Request Failed ===`,
        `Error: ${error}`,
        ``,
        `--- Request ---`,
        `Endpoint: ${debugInfo.endpoint || '(empty)'}`,
        `Deployment: ${debugInfo.deployment || '(empty)'}`,
        `Key length: ${debugInfo.keyLength} chars`,
        `Key prefix: ${debugInfo.keyLength > 8 ? '(see Settings)' : '(too short or empty)'}`,
        ``,
        `--- Response ---`,
        `HTTP Status: ${debugInfo.status || 'N/A (network error)'}`,
        `Body: ${debugInfo.rawResponse || '(none)'}`,
      ].join('\n')
    : error;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>AI Request Failed</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Error summary */}
            <View style={styles.errorBadge}>
              <Text style={styles.errorBadgeText}>{error}</Text>
            </View>

            {debugInfo && (
              <>
                {/* Request section */}
                <Text style={styles.sectionLabel}>REQUEST</Text>
                <Row label="Endpoint" value={debugInfo.endpoint || '(not set)'} highlight={!debugInfo.endpoint} />
                <Row label="Deployment" value={debugInfo.deployment || '(not set)'} highlight={!debugInfo.deployment} />
                <Row label="Key length" value={`${debugInfo.keyLength} chars`} highlight={debugInfo.keyLength === 0} />

                {/* Response section */}
                <Text style={styles.sectionLabel}>RESPONSE</Text>
                <Row label="HTTP Status" value={debugInfo.status ? String(debugInfo.status) : 'N/A'} highlight={debugInfo.status >= 400} />
                <Text style={styles.responseLabel}>Body</Text>
                <TextInput
                  style={styles.responseBody}
                  value={debugInfo.rawResponse || '(empty)'}
                  multiline
                  editable={false}
                  selectTextOnFocus
                  scrollEnabled={false}
                />
              </>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={styles.shareBtn}
              onPress={() => Share.share({ message: shareText })}
            >
              <Text style={styles.shareBtnText}>Share Debug Info</Text>
            </Pressable>
            <Pressable style={styles.okBtn} onPress={onClose}>
              <Text style={styles.okBtnText}>OK</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <TextInput
        style={[rowStyles.value, highlight && rowStyles.valueHighlight]}
        value={value}
        editable={false}
        selectTextOnFocus
        multiline={false}
        scrollEnabled={false}
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    marginBottom: 8,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  value: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  valueHighlight: {
    borderColor: Colors.warning,
    color: Colors.warning,
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: Colors.modal,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  scroll: {
    padding: 20,
  },
  errorBadge: {
    backgroundColor: Colors.dangerSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  errorBadgeText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  responseLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  responseBody: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    minHeight: 80,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: Colors.accentSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingVertical: 13,
    alignItems: 'center',
  },
  shareBtnText: {
    color: Colors.accentBright,
    fontSize: 14,
    fontWeight: '600',
  },
  okBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 13,
    alignItems: 'center',
  },
  okBtnText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
