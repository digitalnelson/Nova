import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';

interface EmptyStateProps {
  searching?: boolean;
}

export default function EmptyState({ searching }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.accentSoft, 'transparent']}
        style={styles.iconBg}
      >
        <Text style={styles.icon}>{searching ? '🔍' : '✨'}</Text>
      </LinearGradient>
      <Text style={styles.title}>
        {searching ? 'No results found' : 'Your ideas start here'}
      </Text>
      <Text style={styles.subtitle}>
        {searching
          ? 'Try different keywords or clear your search'
          : 'Tap the + button to capture your first article idea. Nova will help you develop it with AI.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
