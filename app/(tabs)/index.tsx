import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TextInput,
  useWindowDimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { ArticleIdea, IdeaStatus } from '../../src/lib/types';
import { getIdeas, deleteIdea } from '../../src/lib/storage';
import IdeaCard from '../../src/components/IdeaCard';
import EmptyState from '../../src/components/EmptyState';

const STATUS_FILTERS: { label: string; value: IdeaStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Outlined', value: 'outlined' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Published', value: 'published' },
];

function StatBadge({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={statStyles.badge}>
      <Text style={[statStyles.value, accent && statStyles.valueAccent]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  badge: { alignItems: 'center', flex: 1 },
  value: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  valueAccent: { color: Colors.accentBright },
  label: { color: Colors.textMuted, fontSize: 11, marginTop: 1, fontWeight: '500' },
});

export default function HomeScreen() {
  const [ideas, setIdeas] = useState<ArticleIdea[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<IdeaStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const numColumns = isTablet ? 2 : 1;

  const load = useCallback(async () => {
    const data = await getIdeas();
    setIdeas(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = (idea: ArticleIdea) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete Idea', `Delete "${idea.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteIdea(idea.id);
          await load();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const filtered = ideas.filter((idea) => {
    const matchesSearch =
      !search ||
      idea.title.toLowerCase().includes(search.toLowerCase()) ||
      idea.notes.toLowerCase().includes(search.toLowerCase()) ||
      idea.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === 'all' || idea.status === filter;
    return matchesSearch && matchesFilter;
  });

  // Stats for hero
  const aiCount = ideas.filter(
    (i) =>
      i.aiContent?.outline ||
      i.aiContent?.intro ||
      i.aiContent?.improvedTitles?.length
  ).length;
  const publishedCount = ideas.filter((i) => i.status === 'published').length;

  const renderItem = ({ item, index }: { item: ArticleIdea; index: number }) => (
    <View style={[styles.cardWrapper, isTablet && index % 2 === 0 && styles.cardWrapperLeft]}>
      <IdeaCard
        idea={item}
        onPress={() => router.push(`/idea/${item.id}`)}
        onLongPress={() => handleDelete(item)}
      />
    </View>
  );

  const ListHeader = (
    <>
      {/* ── Hero ── */}
      <LinearGradient
        colors={[
          'rgba(124, 106, 247, 0.18)',
          'rgba(124, 106, 247, 0.06)',
          'transparent',
        ]}
        style={styles.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroStar}>✦</Text>
            <Text style={styles.heroName}>Nova</Text>
          </View>
          <Text style={styles.heroTagline}>Article ideas, amplified by AI</Text>
        </View>

        <View style={styles.statsRow}>
          <StatBadge value={ideas.length} label="ideas" />
          <View style={styles.statDivider} />
          <StatBadge value={aiCount} label="AI enhanced" accent />
          <View style={styles.statDivider} />
          <StatBadge value={publishedCount} label="published" />
        </View>
      </LinearGradient>

      {/* ── Search ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search ideas..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Text style={styles.clearBtn}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Status filters ── */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => {
          const active = filter === item.value;
          return (
            <Pressable
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => {
                setFilter(item.value);
                Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
        style={styles.filterBar}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        key={numColumns}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        ListEmptyComponent={<EmptyState searching={!!search || filter !== 'all'} />}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/new');
        }}
      >
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    marginBottom: 4,
  },
  heroTop: {
    marginBottom: 20,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  heroStar: {
    color: Colors.accent,
    fontSize: 22,
  },
  heroName: {
    color: Colors.textPrimary,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 44,
  },
  heroTagline: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginLeft: 30,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  // Search
  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    padding: 0,
  },
  clearBtn: { color: Colors.textMuted, fontSize: 14 },
  // Filters
  filterBar: { flexGrow: 0, marginBottom: 12 },
  filterList: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  filterLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  filterLabelActive: { color: Colors.accentBright, fontWeight: '600' },
  // List
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  listEmpty: { flex: 1 },
  cardWrapper: { flex: 1 },
  cardWrapperLeft: { marginRight: 6 },
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    color: Colors.white,
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 38,
    marginTop: -2,
  },
});
