import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import { Colors } from '../../src/constants/colors';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <View style={{ opacity: focused ? 1 : 0.5 }}>
        {/* icon rendered as text emoji placeholder; swap with vector icons if desired */}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: Platform.OS === 'ios' ? 0 : 6,
          height: Platform.OS === 'ios' ? 88 : 62,
          elevation: 0,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ideas',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <TabSymbol name="lightbulb" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="arxiv"
        options={{
          title: 'arXiv',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <TabSymbol name="papers" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <TabSymbol name="gear" color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

// Simple SVG-free icon using text — works cross-platform
function TabSymbol({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    lightbulb: '💡',
    papers: '📄',
    gear: '⚙️',
  };
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{icons[name] ?? '●'}</Text>;
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {},
});
