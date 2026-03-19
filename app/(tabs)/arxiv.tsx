import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { ArxivPaper, SavedPaper, ReadingStatus } from '../../src/lib/types';
import { searchArxiv, ARXIV_CATEGORIES, formatAuthors, formatArxivDate } from '../../src/lib/arxiv';
import { getSavedPapers, savePaper, deleteSavedPaper } from '../../src/lib/storage';

type ViewMode = 'search' | 'saved';

const DEFAULT_QUERY = 'psychiatry OR mental health';
const DEFAULT_CATEGORY = 'cs.AI';

const READING_STATUS_COLORS: Record<ReadingStatus, string> = {
  'to-read': Colors.textMuted,
  'reading': Colors.warning,
  'read': Colors.success,
};

const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  'to-read': 'To Read',
  'reading': 'Reading',
  'read': 'Read',
};

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PaperCard({
  paper,
  savedPaper,
  onPress,
  onSaveToggle,
}: {
  paper: ArxivPaper;
  savedPaper?: SavedPaper;
  onPress: () => void;
  onSaveToggle: () => void;
}) {
  const isSaved = !!savedPaper;
  const status = savedPaper?.status;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>{formatArxivDate(paper.published)}</Text>
          {paper.categories.slice(0, 3).map((cat) => (
            <View key={cat} style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{cat}</Text>
            </View>
          ))}
        </View>
        <Pressable
          style={[styles.saveBtn, isSaved && styles.saveBtnActive]}
          onPress={(e) => {
            e.stopPropagation();
            onSaveToggle();
          }}
          hitSlop={8}
        >
          <Text style={[styles.saveBtnIcon, isSaved && styles.saveBtnIconActive]}>
            {isSaved ? '★' : '☆'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.cardTitle} numberOfLines={3}>{paper.title}</Text>
      <Text style={styles.cardAuthors} numberOfLines={1}>{formatAuthors(paper.authors)}</Text>
      <Text style={styles.cardAbstract} numberOfLines={2}>{paper.abstract}</Text>

      {isSaved && status && (
        <View style={[styles.statusPill, { borderColor: READING_STATUS_COLORS[status] }]}>
          <View style={[styles.statusDot, { backgroundColor: READING_STATUS_COLORS[status] }]} />
          <Text style={[styles.statusText, { color: READING_STATUS_COLORS[status] }]}>
            {READING_STATUS_LABELS[status]}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function ArxivScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [searchResults, setSearchResults] = useState<ArxivPaper[]>([]);
  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);

  const loadSaved = useCallback(async () => {
    const papers = await getSavedPapers();
    setSavedPapers(papers);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved])
  );

  const doSearch = useCallback(async (q: string, cat: string) => {
    const effectiveQuery = q.trim() || DEFAULT_QUERY;
    setLoading(true);
    setHasSearched(true);
    try {
      const results = await searchArxiv({
        query: q.trim() || undefined,
        category: cat || undefined,
        maxResults: 25,
        sortBy: q.trim() ? 'relevance' : 'submittedDate',
      });
      setSearchResults(results);
    } catch (e: any) {
      Alert.alert('Search Error', e.message ?? 'Could not reach ArXiv. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    doSearch(query, selectedCategory);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    Haptics.selectionAsync();
    if (hasSearched || cat) {
      doSearch(query, cat);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (viewMode === 'saved') {
      await loadSaved();
    } else {
      await doSearch(query, selectedCategory);
    }
    setRefreshing(false);
  };

  const handleSaveToggle = useCallback(async (paper: ArxivPaper) => {
    const existing = savedPapers.find((s) => s.paper.id === paper.id);
    if (existing) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Remove Paper', `Remove "${paper.title.slice(0, 60)}..." from saved?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteSavedPaper(paper.id);
            await loadSaved();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]);
    } else {
      const now = new Date().toISOString();
      const saved: SavedPaper = {
        paper,
        status: 'to-read',
        notes: '',
        savedAt: now,
        updatedAt: now,
      };
      await savePaper(saved);
      await loadSaved();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [savedPapers, loadSaved]);

  const handlePaperPress = (paper: ArxivPaper) => {
    router.push(`/paper/${encodeURIComponent(paper.id)}`);
  };

  const toReadCount = savedPapers.filter((p) => p.status === 'to-read').length;
  const readCount = savedPapers.filter((p) => p.status === 'read').length;

  const savedPaperMap = new Map(savedPapers.map((s) => [s.paper.id, s]));

  const displayedPapers: ArxivPaper[] =
    viewMode === 'saved'
      ? savedPapers.map((s) => s.paper)
      : searchResults;

  const ListHeader = (
    <>
      {/* ── Hero ── */}
      <LinearGradient
        colors={['rgba(74, 158, 234, 0.18)', 'rgba(74, 158, 234, 0.06)', 'transparent']}
        style={styles.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroIcon}>📄</Text>
            <Text style={styles.heroName}>arXiv</Text>
          </View>
          <Text style={styles.heroTagline}>Research papers → blog post ideas</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statValue}>{savedPapers.length}</Text>
            <Text style={styles.statLabel}>saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBadge}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{toReadCount}</Text>
            <Text style={styles.statLabel}>to read</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBadge}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{readCount}</Text>
            <Text style={styles.statLabel}>read</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── View mode toggle ── */}
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleBtn, viewMode === 'search' && styles.toggleBtnActive]}
          onPress={() => { setViewMode('search'); Haptics.selectionAsync(); }}
        >
          <Text style={[styles.toggleText, viewMode === 'search' && styles.toggleTextActive]}>
            🔍 Search
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, viewMode === 'saved' && styles.toggleBtnActive]}
          onPress={() => { setViewMode('saved'); Haptics.selectionAsync(); }}
        >
          <Text style={[styles.toggleText, viewMode === 'saved' && styles.toggleTextActive]}>
            ★ Saved ({savedPapers.length})
          </Text>
        </Pressable>
      </View>

      {/* ── Search bar (search mode only) ── */}
      {viewMode === 'search' && (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder="Search papers..."
                placeholderTextColor={Colors.textMuted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              {!!query && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Text style={styles.clearBtn}>✕</Text>
                </Pressable>
              )}
            </View>
            <Pressable style={styles.searchSubmit} onPress={handleSearch}>
              <LinearGradient
                colors={['#4A9EEA', '#3A7BC8']}
                style={styles.searchSubmitGradient}
              >
                <Text style={styles.searchSubmitText}>Go</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Category chips */}
          <FlatList
            horizontal
            data={ARXIV_CATEGORIES}
            keyExtractor={(item) => item.value || 'all'}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipList}
            renderItem={({ item }) => (
              <CategoryChip
                label={item.label}
                active={selectedCategory === item.value}
                onPress={() => handleCategoryChange(item.value)}
              />
            )}
            style={styles.chipBar}
          />
        </>
      )}
    </>
  );

  const EmptySearch = () => (
    <View style={styles.emptyState}>
      {loading ? (
        <ActivityIndicator color={Colors.accent} size="large" />
      ) : hasSearched ? (
        <>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No papers found</Text>
          <Text style={styles.emptySubtitle}>Try different keywords or a broader category</Text>
        </>
      ) : (
        <>
          <Text style={styles.emptyIcon}>🔬</Text>
          <Text style={styles.emptyTitle}>Search arXiv</Text>
          <Text style={styles.emptySubtitle}>
            Search for papers or pick a category above, then tap Go
          </Text>
          <Pressable style={styles.defaultSearchBtn} onPress={() => doSearch('', DEFAULT_CATEGORY)}>
            <Text style={styles.defaultSearchText}>Browse recent cs.AI papers</Text>
          </Pressable>
        </>
      )}
    </View>
  );

  const EmptySaved = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>★</Text>
      <Text style={styles.emptyTitle}>No saved papers</Text>
      <Text style={styles.emptySubtitle}>
        Search for papers and tap the star to save them for later
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={displayedPapers}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.list, displayedPapers.length === 0 && styles.listEmpty]}
        renderItem={({ item }) => (
          <PaperCard
            paper={item}
            savedPaper={savedPaperMap.get(item.id)}
            onPress={() => handlePaperPress(item)}
            onSaveToggle={() => handleSaveToggle(item)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        ListEmptyComponent={viewMode === 'saved' ? <EmptySaved /> : <EmptySearch />}
        showsVerticalScrollIndicator={false}
      />
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
  heroTop: { marginBottom: 20 },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  heroIcon: { fontSize: 28 },
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
    marginLeft: 36,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
  },
  statBadge: { alignItems: 'center', flex: 1 },
  statValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 1, fontWeight: '500' },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  // Toggle
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.elevated,
  },
  toggleText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  // Search
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  searchBox: {
    flex: 1,
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
  searchSubmit: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  searchSubmitGradient: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSubmitText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  // Category chips
  chipBar: { flexGrow: 0, marginBottom: 12 },
  chipList: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: 'rgba(74, 158, 234, 0.15)',
    borderColor: '#4A9EEA',
  },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#4A9EEA', fontWeight: '600' },
  // Paper card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  cardDate: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  catBadge: {
    backgroundColor: 'rgba(74, 158, 234, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catBadgeText: {
    color: '#4A9EEA',
    fontSize: 10,
    fontWeight: '600',
  },
  saveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
  },
  saveBtnIcon: {
    fontSize: 18,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  saveBtnIconActive: {
    color: Colors.warning,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  cardAuthors: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  cardAbstract: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // List
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  listEmpty: { flex: 1 },
  // Empty states
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  defaultSearchBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 158, 234, 0.15)',
    borderWidth: 1,
    borderColor: '#4A9EEA',
  },
  defaultSearchText: {
    color: '#4A9EEA',
    fontSize: 14,
    fontWeight: '600',
  },
});
