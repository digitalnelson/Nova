import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  RichText,
  Toolbar,
  useEditorBridge,
  useBridgeState,
  TenTapStartKit,
} from '@10play/tentap-editor';
import { Colors, StatusColors, StatusLabels } from '../../src/constants/colors';
import { ArticleIdea, IdeaStatus } from '../../src/lib/types';
import { getIdeas, saveIdea, deleteIdea } from '../../src/lib/storage';
import { getSettings } from '../../src/lib/storage';
import TagPill from '../../src/components/TagPill';
import AIPanel from '../../src/components/AIPanel';
import HeroImagePanel from '../../src/components/HeroImagePanel';
import AICollaborator from '../../src/components/AICollaborator';
import WritingBuddy from '../../src/components/WritingBuddy';
import { createLogger, initLogger } from '../../src/lib/logger';

const log = createLogger('[IdeaScreen]');

// ─── Editor CSS ──────────────────────────────────────────────────────────────
const EDITOR_CSS = `
  * { background-color: #09090F !important; margin: 0; }
  body { background-color: #09090F !important; }
  .ProseMirror {
    padding: 16px;
    min-height: 280px;
    font-size: 16px;
    line-height: 1.75;
    font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', sans-serif;
    color: #9090B8;
    background-color: #09090F !important;
    outline: none;
  }
  .ProseMirror p { color: #9090B8; margin-bottom: 10px; }
  .ProseMirror h1 {
    color: #F0EEFF; font-size: 26px; font-weight: 700;
    margin: 20px 0 8px; line-height: 1.3;
  }
  .ProseMirror h2 {
    color: #F0EEFF; font-size: 21px; font-weight: 700;
    margin: 18px 0 6px; line-height: 1.35;
  }
  .ProseMirror h3 {
    color: #F0EEFF; font-size: 17px; font-weight: 600;
    margin: 14px 0 4px; line-height: 1.4;
  }
  .ProseMirror strong { color: #F0EEFF; font-weight: 700; }
  .ProseMirror em { font-style: italic; }
  .ProseMirror u { text-decoration: underline; }
  .ProseMirror s { text-decoration: line-through; color: #5A5A78; }
  .ProseMirror code {
    background: #111119; color: #9B8DFF;
    border-radius: 4px; padding: 2px 5px;
    font-size: 14px; font-family: 'Menlo', 'Monaco', monospace;
  }
  .ProseMirror pre {
    background: #111119; border-radius: 10px;
    padding: 14px; margin: 12px 0; overflow: auto;
  }
  .ProseMirror pre code { background: transparent; padding: 0; font-size: 13px; color: #9B8DFF; }
  .ProseMirror blockquote {
    border-left: 3px solid #7C6AF7;
    padding-left: 14px; margin: 12px 0 12px 0;
    color: #9090B8; font-style: italic;
  }
  .ProseMirror ul, .ProseMirror ol {
    color: #9090B8; padding-left: 22px; margin-bottom: 10px;
  }
  .ProseMirror li { margin-bottom: 4px; }
  .ProseMirror hr {
    border: none; border-top: 1px solid #252538; margin: 20px 0;
  }
  .ProseMirror a { color: #7C6AF7; text-decoration: underline; }
  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left; color: #5A5A78; pointer-events: none; height: 0;
  }
  /* Task list */
  .ProseMirror ul[data-type="taskList"] { padding-left: 4px; }
  .ProseMirror ul[data-type="taskList"] li {
    display: flex; align-items: flex-start; gap: 8px;
  }
  .ProseMirror ul[data-type="taskList"] li > label {
    margin-top: 2px; flex-shrink: 0;
  }
  .ProseMirror ul[data-type="taskList"] input[type="checkbox"] {
    accent-color: #7C6AF7; width: 15px; height: 15px;
  }
`;

// ─── Toolbar theme ────────────────────────────────────────────────────────────
const TOOLBAR_THEME = {
  toolbar: {
    toolbarBody: {
      backgroundColor: '#1A1A2A',
      borderTopColor: '#252538',
      borderTopWidth: 1,
      borderBottomWidth: 0,
      minWidth: '100%' as const,
      height: 44,
      flex: 1,
    },
    toolbarButton: {
      backgroundColor: '#1A1A2A',
      paddingHorizontal: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    icon: {
      tintColor: '#9090B8',
      height: 24,
      width: 24,
    },
    iconActive: {
      tintColor: '#9B8DFF',
    },
    iconDisabled: {
      tintColor: '#5A5A78',
    },
    iconWrapper: {
      borderRadius: 6,
      backgroundColor: '#1A1A2A',
    },
    iconWrapperActive: {
      backgroundColor: 'rgba(124, 106, 247, 0.15)',
      borderRadius: 6,
    },
    iconWrapperDisabled: {
      opacity: 0.35,
    },
    hidden: {
      display: 'none' as const,
    },
    keyboardAvoidingView: {
      position: 'absolute' as const,
      width: '100%' as const,
      bottom: 0,
    },
  },
  webview: {
    backgroundColor: '#09090F',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Very simple markdown → HTML for inserting AI-generated text into the editor */
function mdToHtml(md: string): string {
  const blocks = md.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const t = block.trim();
      if (!t) return '';
      if (t.startsWith('### ')) return `<h3>${t.slice(4)}</h3>`;
      if (t.startsWith('## ')) return `<h2>${t.slice(3)}</h2>`;
      if (t.startsWith('# ')) return `<h1>${t.slice(2)}</h1>`;
      const lines = t.split('\n');
      if (lines.every((l) => /^[-*]\s/.test(l.trim()))) {
        const items = lines.map((l) => `<li>${l.replace(/^[-*]\s/, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      if (lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
        const items = lines.map((l) => `<li>${l.replace(/^\d+\.\s/, '')}</li>`).join('');
        return `<ol>${items}</ol>`;
      }
      // Inline markdown within a paragraph
      const html = t
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      return `<p>${html}</p>`;
    })
    .filter(Boolean)
    .join('');
}

function wordCount(html: string): number {
  if (!html || html === '<p></p>') return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

const STATUSES: IdeaStatus[] = ['draft', 'outlined', 'in-progress', 'published'];

// ─── Component ────────────────────────────────────────────────────────────────
export default function IdeaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [idea, setIdea] = useState<ArticleIdea | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<IdeaStatus>('draft');
  const [tagInput, setTagInput] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [azureConfig, setAzureConfig] = useState({ endpoint: '', apiKey: '', deployment: '' });
  const [imageConfig, setImageConfig] = useState({ endpoint: '', apiKey: '', deployment: 'dall-e-3' });
  const [heroImageDataUri, setHeroImageDataUri] = useState<string | undefined>(undefined);
  const [htmlContent, setHtmlContent] = useState('');
  const cssInjected = useRef(false);
  const contentSetInEditor = useRef(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Initialise logger on mount
  useEffect(() => {
    initLogger();
    log.info('Screen mounted, id:', id);
  }, []);

  const editor = useEditorBridge({
    autofocus: false,
    dynamicHeight: false,
    theme: TOOLBAR_THEME,
    onChange: () => {
      setIsDirty(true);
    },
  });

  const editorState = useBridgeState(editor);

  // ── Phase 1: Load idea data from storage immediately, independent of editor ──
  useEffect(() => {
    if (!id) {
      log.error('No id param — cannot load idea');
      setLoadError('No idea ID provided.');
      return;
    }

    log.info('Starting data load for id:', id);

    async function loadData() {
      try {
        log.debug('Fetching all ideas from AsyncStorage...');
        const all = await getIdeas();
        log.info('Fetched', all.length, 'total ideas from storage');

        const found = all.find((i) => i.id === id);
        if (found) {
          log.info('Found idea:', JSON.stringify({ id: found.id, title: found.title, status: found.status, contentLength: (found.content || '').length }));
          setIdea(found);
          setTitle(found.title);
          setNotes(found.notes);
          setTags(found.tags);
          setStatus(found.status);
          setHeroImageDataUri(found.heroImageDataUri);
          const initial = found.content || '';
          setHtmlContent(initial);
          log.debug('Idea state populated. Content length:', initial.length);
        } else {
          log.error('Idea not found for id:', id, '— available ids:', all.map((i) => i.id).join(', '));
          setLoadError(`Idea "${id}" not found in storage.`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error('Exception while loading ideas:', msg);
        setLoadError('Failed to load idea: ' + msg);
      }

      try {
        log.debug('Fetching settings from AsyncStorage...');
        const settings = await getSettings();
        log.info('Settings loaded — endpoint:', settings.azureEndpoint ? settings.azureEndpoint.replace(/\/+$/, '').split('/').slice(-1)[0] + '/...' : '(empty)', '| deployment:', settings.azureDeployment || '(empty)');
        setAzureConfig({
          endpoint: settings.azureEndpoint,
          apiKey: settings.azureApiKey,
          deployment: settings.azureDeployment,
        });
        setImageConfig({
          endpoint: settings.imageEndpoint || '',
          apiKey: settings.imageApiKey || '',
          deployment: settings.imageDeployment || 'dall-e-3',
        });
        log.debug('Azure config set. Image endpoint:', settings.imageEndpoint ? 'set' : '(empty)');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error('Exception while loading settings:', msg);
      }
    }

    loadData();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 2: Track editor readiness and inject CSS ────────────────────────
  useEffect(() => {
    log.debug('editorState.isReady changed:', editorState.isReady);
    if (editorState.isReady && !cssInjected.current) {
      cssInjected.current = true;
      log.info('Editor became ready — injecting CSS and placeholder');
      editor.injectCSS(EDITOR_CSS, 'nova-theme');
      editor.setPlaceholder('Start writing your article…');
    }
  }, [editorState.isReady, editor]);

  // ── Phase 3: Once both idea data AND editor are ready, set content ─────────
  useEffect(() => {
    if (editorState.isReady && htmlContent && !contentSetInEditor.current) {
      contentSetInEditor.current = true;
      log.info('Setting initial content in editor — length:', htmlContent.length);
      editor.setContent(htmlContent);
    }
  }, [editorState.isReady, htmlContent, editor]);

  const markDirty = () => setIsDirty(true);

  const handleSave = async () => {
    if (!idea) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Please add a title.');
      return;
    }
    log.info('Saving idea:', idea.id);
    try {
      const content = await editor.getHTML();
      const cleanContent = content === '<p></p>' ? '' : content;
      log.debug('Got HTML from editor, length:', cleanContent.length);

      const updated: ArticleIdea = {
        ...idea,
        title: title.trim(),
        notes: notes.trim(),
        content: cleanContent,
        heroImageDataUri,
        tags,
        status,
        updatedAt: new Date().toISOString(),
      };
      await saveIdea(updated);
      log.info('Idea saved successfully');
      setIdea(updated);
      setHtmlContent(cleanContent);
      setIsDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('Save failed:', msg);
      Alert.alert('Save Failed', msg);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Idea', `Delete "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (idea) {
            log.info('Deleting idea:', idea.id);
            await deleteIdea(idea.id);
          }
          router.back();
        },
      },
    ]);
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
      markDirty();
    }
    setTagInput('');
  };

  const handleAITagsGenerated = (suggested: string[]) => {
    log.debug('AI tags generated:', suggested.join(', '));
    setTags((prev) => {
      const merged = [...prev];
      for (const tag of suggested) {
        if (!merged.includes(tag)) merged.push(tag);
      }
      return merged.slice(0, 10);
    });
    markDirty();
  };

  const handleInsertContent = async (markdownOrHtml: string) => {
    log.debug('Inserting AI content, length:', markdownOrHtml.length);
    const current = await editor.getHTML();
    const isEmpty = !current || current === '<p></p>';
    // If it looks like HTML (from buddy), use as-is; otherwise convert markdown
    const isHtml = /^<[a-z]/.test(markdownOrHtml.trim());
    const newHtml = isHtml ? markdownOrHtml : mdToHtml(markdownOrHtml);
    editor.setContent(isEmpty ? newHtml : current + newHtml);
    markDirty();
    setTimeout(() => editor.focus('end'), 100);
  };

  const handleCollaboratorApply = (newHtml: string) => {
    log.debug('Applying collaborator changes, length:', newHtml.length);
    editor.setContent(newHtml);
    markDirty();
  };

  const handleHeroImageGenerated = (dataUri: string) => {
    log.info('Hero image generated, dataUri length:', dataUri.length);
    setHeroImageDataUri(dataUri);
    markDirty();
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadErrorText}>Failed to load idea</Text>
          <Text style={styles.loadErrorDetail}>{loadError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!idea) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
          <Text style={styles.loadingSubtext}>Fetching idea from storage</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = StatusColors[status];
  const words = wordCount(htmlContent);
  const readMins = Math.max(1, Math.round(words / 200));

  const editorSection = (
    <>
      {/* Hero image — compact strip on mobile, full panel on tablet */}
      <HeroImagePanel
        title={title}
        notes={notes}
        claudeConfig={azureConfig}
        imageConfig={imageConfig}
        currentDataUri={heroImageDataUri}
        onImageGenerated={handleHeroImageGenerated}
        compact={!isTablet}
      />

      {/* Article section header */}
      <View style={[styles.sectionHeader, { marginTop: 12 }]}>
        <Text style={styles.sectionHeaderText}>ARTICLE</Text>
        {words > 0 && (
          <View style={styles.wordCountBadge}>
            <Text style={styles.wordCountText}>
              {words.toLocaleString()} words · {readMins} min read
            </Text>
          </View>
        )}
      </View>

      {/* The editor card */}
      <View style={styles.editorCard}>
        <RichText
          editor={editor}
          style={styles.editorWebview}
        />
      </View>
    </>
  );

  const detailsSection = (
    <>
      <Pressable
        style={[styles.sectionToggle, showDetails && styles.sectionToggleOpen]}
        onPress={() => {
          setShowDetails((v) => !v);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <Text style={styles.sectionToggleIcon}>📋</Text>
        <Text style={[styles.sectionToggleText, showDetails && styles.sectionToggleTextOpen]}>
          Details
        </Text>
        <View style={styles.sectionToggleMeta}>
          <View style={[styles.statusDotSmall, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabelSmall, { color: statusColor }]}>
            {StatusLabels[status]}
          </Text>
        </View>
        <Text style={styles.sectionChevron}>{showDetails ? '▲' : '▼'}</Text>
      </Pressable>

      {showDetails && (
        <View style={styles.detailsBody}>
          {/* Status */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>STATUS</Text>
            <Pressable
              style={[styles.statusRow, { borderColor: statusColor }]}
              onPress={() => setShowStatusPicker((v) => !v)}
            >
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>
                {StatusLabels[status]}
              </Text>
              <Text style={styles.chevron}>{showStatusPicker ? '▲' : '▼'}</Text>
            </Pressable>
            {showStatusPicker && (
              <View style={styles.statusMenu}>
                {STATUSES.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.statusOption, status === s && styles.statusOptionActive]}
                    onPress={() => {
                      setStatus(s);
                      setShowStatusPicker(false);
                      markDirty();
                    }}
                  >
                    <View style={[styles.statusDot, { backgroundColor: StatusColors[s] }]} />
                    <Text style={[styles.statusOptionText, { color: StatusColors[s] }]}>
                      {StatusLabels[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Notes / Brief */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>BRIEF / NOTES</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={(v) => { setNotes(v); markDirty(); }}
              multiline
              placeholder="Context, target audience, key points to cover…"
              placeholderTextColor={Colors.textMuted}
              textAlignVertical="top"
            />
          </View>

          {/* Tags */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TAGS</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                placeholder="Add tag and press return"
                placeholderTextColor={Colors.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={() => { if (tagInput.trim()) addTag(tagInput); }}
                returnKeyType="done"
                autoCapitalize="none"
              />
            </View>
            {tags.length > 0 && (
              <View style={styles.tagsList}>
                {tags.map((tag) => (
                  <TagPill
                    key={tag}
                    label={tag}
                    onRemove={() => {
                      setTags((prev) => prev.filter((t) => t !== tag));
                      markDirty();
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </>
  );

  const mainContent = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Document title */}
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={(v) => { setTitle(v); markDirty(); }}
        multiline
        placeholder="Article title"
        placeholderTextColor={Colors.textMuted}
      />

      {editorSection}

      <View style={styles.metaSections}>
        {detailsSection}
      </View>

      {/* Danger zone */}
      <View style={styles.dangerZone}>
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Idea</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <View style={styles.navRight}>
          {isDirty && (
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                style={styles.saveBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.saveText}>Save</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.keyboardView}>
        {isTablet ? (
          <View style={styles.tabletRow}>
            <View style={styles.tabletMain}>{mainContent}</View>
            <View style={styles.tabletSide}>
              <Text style={styles.sideHeader}>AI Tools</Text>
              <AIPanel
                title={title}
                notes={notes}
                azureConfig={azureConfig}
                onTagsGenerated={handleAITagsGenerated}
                onInsertContent={handleInsertContent}
              />
              <Text style={[styles.sideHeader, { marginTop: 20 }]}>AI Collaborator</Text>
              <AICollaborator
                title={title}
                notes={notes}
                azureConfig={azureConfig}
                getArticleHtml={() => editor.getHTML()}
                onApplyChanges={handleCollaboratorApply}
              />
            </View>
          </View>
        ) : (
          mainContent
        )}
        <Toolbar editor={editor} />
      </View>

      {/* Writing Buddy FAB — mobile only */}
      {!isTablet && (
        <WritingBuddy
          title={title}
          notes={notes}
          azureConfig={azureConfig}
          getArticleHtml={() => editor.getHTML()}
          onInsertContent={handleInsertContent}
          onReplaceContent={handleCollaboratorApply}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  loadingSubtext: {
    color: Colors.textMuted,
    fontSize: 13,
    opacity: 0.7,
  },
  loadErrorText: {
    color: Colors.danger ?? '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  loadErrorDetail: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backText: {
    color: Colors.accent,
    fontSize: 17,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  // Title
  titleInput: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    padding: 0,
  },
  // Editor section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
  },
  sectionHeaderText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  wordCountBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  wordCountText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  editorCard: {
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  editorWebview: {
    backgroundColor: Colors.bg,
    height: 320,
  },
  // Meta sections wrapper
  metaSections: {
    paddingHorizontal: 12,
    gap: 8,
  },
  // Collapsible section toggle
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sectionToggleOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: 'transparent',
    borderColor: Colors.border,
  },
  sectionToggleIcon: {
    fontSize: 16,
  },
  sectionToggleText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionToggleTextOpen: {
    color: Colors.textPrimary,
  },
  sectionToggleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabelSmall: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionChevron: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  // Details body
  detailsBody: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.border,
    padding: 16,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
  },
  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: Colors.elevated,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chevron: {
    color: Colors.textMuted,
    fontSize: 10,
    marginLeft: 4,
  },
  statusMenu: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  statusOptionActive: {
    backgroundColor: Colors.accentSoft,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Notes
  notesInput: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 90,
    padding: 12,
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: 'top',
  },
  // Tags
  tagInputRow: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  tagInput: {
    color: Colors.textPrimary,
    fontSize: 14,
    padding: 0,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // AI Panel
  aiPanelWrapper: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  // Danger
  dangerZone: {
    marginHorizontal: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.dangerSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  deleteText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  // Tablet layout
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletMain: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  tabletSide: {
    width: 380,
    padding: 20,
  },
  sideHeader: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
});
