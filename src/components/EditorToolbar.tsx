import React from 'react';
import {
  ScrollView,
  Pressable,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'code'
  | 'hr';

interface ToolbarButton {
  action: FormatAction;
  label: string;
  style?: 'bold' | 'italic' | 'strike';
  group: number;
}

const BUTTONS: ToolbarButton[] = [
  { action: 'bold', label: 'B', style: 'bold', group: 1 },
  { action: 'italic', label: 'I', style: 'italic', group: 1 },
  { action: 'strikethrough', label: 'S', style: 'strike', group: 1 },
  { action: 'h1', label: 'H1', group: 2 },
  { action: 'h2', label: 'H2', group: 2 },
  { action: 'h3', label: 'H3', group: 2 },
  { action: 'bullet', label: '•', group: 3 },
  { action: 'numbered', label: '1.', group: 3 },
  { action: 'quote', label: '\u201C', group: 3 },
  { action: 'code', label: '<>', group: 4 },
  { action: 'hr', label: '\u2015', group: 4 },
];

interface EditorToolbarProps {
  onFormat: (action: FormatAction) => void;
}

export default function EditorToolbar({ onFormat }: EditorToolbarProps) {
  const handlePress = (action: FormatAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFormat(action);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="always"
      >
        {BUTTONS.map((btn, idx) => {
          const prevGroup = idx > 0 ? BUTTONS[idx - 1].group : btn.group;
          const showDivider = idx > 0 && prevGroup !== btn.group;
          return (
            <React.Fragment key={btn.action}>
              {showDivider && <View style={styles.divider} />}
              <Pressable
                style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                onPress={() => handlePress(btn.action)}
              >
                <Text
                  style={[
                    styles.btnText,
                    btn.style === 'bold' && styles.boldText,
                    btn.style === 'italic' && styles.italicText,
                    btn.style === 'strike' && styles.strikeText,
                  ]}
                >
                  {btn.label}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.elevated,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 6,
  },
  btn: {
    minWidth: 36,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  btnPressed: {
    backgroundColor: Colors.accentSoft,
  },
  btnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  boldText: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  italicText: {
    color: Colors.textPrimary,
    fontStyle: 'italic',
    fontSize: 15,
  },
  strikeText: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
    fontSize: 15,
  },
});
