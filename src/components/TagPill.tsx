import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Colors } from '../constants/colors';

interface TagPillProps {
  label: string;
  onRemove?: () => void;
  small?: boolean;
}

export default function TagPill({ label, onRemove, small }: TagPillProps) {
  return (
    <View style={[styles.pill, small && styles.pillSmall]}>
      <Text style={[styles.label, small && styles.labelSmall]}>#{label}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
          <Text style={styles.removeIcon}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentSoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(124, 106, 247, 0.2)',
  },
  pillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    color: Colors.accentBright,
    fontSize: 13,
    fontWeight: '500',
  },
  labelSmall: {
    fontSize: 11,
  },
  removeBtn: {
    marginLeft: 4,
  },
  removeIcon: {
    color: Colors.accentBright,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '300',
  },
});
