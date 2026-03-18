import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { generateHeroImage, HeroImageResponse } from '../lib/ai';

interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

interface ImageConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

interface HeroImagePanelProps {
  title: string;
  notes: string;
  claudeConfig: AzureConfig;
  imageConfig: ImageConfig;
  currentDataUri?: string;
  onImageGenerated: (dataUri: string) => void;
}

export default function HeroImagePanel({
  title,
  notes,
  claudeConfig,
  imageConfig,
  currentDataUri,
  onImageGenerated,
}: HeroImagePanelProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Add an article title before generating a hero image.');
      return;
    }
    if (!claudeConfig.endpoint || !claudeConfig.apiKey) {
      Alert.alert('AI not configured', 'Configure your Azure AI settings in Settings first.');
      return;
    }
    if (!imageConfig.endpoint || !imageConfig.apiKey) {
      Alert.alert(
        'Image generation not configured',
        'Add your Azure OpenAI endpoint and key in Settings → Image Generation.'
      );
      return;
    }

    setGenerating(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result: HeroImageResponse = await generateHeroImage(
      claudeConfig,
      imageConfig,
      title,
      notes
    );

    setGenerating(false);

    if (result.error) {
      setError(result.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (result.dataUri) {
      onImageGenerated(result.dataUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <View style={styles.container}>
      {currentDataUri ? (
        // Show existing hero image
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: currentDataUri }}
            style={styles.image}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(9,9,15,0.7)']}
            style={styles.imageGradient}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={styles.imageOverlay}>
            <View style={styles.imageBadge}>
              <Text style={styles.imageBadgeText}>🖼️ Hero Image</Text>
            </View>
            <Pressable
              style={[styles.regenBtn, generating && styles.regenBtnDisabled]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.regenBtnText}>↺ Regenerate</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        // Empty state — prompt to generate
        <Pressable
          style={[styles.emptyState, generating && styles.emptyStateGenerating]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <ActivityIndicator color={Colors.accentBright} size="large" />
              <Text style={styles.generatingTitle}>Generating hero image…</Text>
              <Text style={styles.generatingSubtitle}>
                Claude is crafting a prompt, then DALL·E 3 is painting it
              </Text>
            </>
          ) : (
            <>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                style={styles.emptyIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.emptyIconText}>🎨</Text>
              </LinearGradient>
              <Text style={styles.emptyTitle}>Generate Hero Image</Text>
              <Text style={styles.emptySubtitle}>
                Claude writes the prompt · DALL·E 3 generates the image
              </Text>
            </>
          )}
        </Pressable>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠ {error}</Text>
          <Pressable onPress={() => setError(null)}>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 4,
  },
  // Image display
  imageWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    aspectRatio: 16 / 7,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  regenBtn: {
    backgroundColor: 'rgba(124, 106, 247, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 44,
    alignItems: 'center',
  },
  regenBtnDisabled: {
    opacity: 0.6,
  },
  regenBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  // Empty state
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.surface,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyStateGenerating: {
    borderStyle: 'solid',
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: {
    fontSize: 26,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  generatingTitle: {
    color: Colors.accentBright,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  generatingSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Colors.dangerSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    padding: 12,
    marginTop: 8,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  errorDismiss: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
