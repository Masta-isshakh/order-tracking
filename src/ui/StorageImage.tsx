import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageContentFit, type ImageStyle } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { resolveImageUrl } from '../lib/media';

/**
 * Renders an S3 object from its storage key, signing the URL on demand.
 * Falls back to a themed placeholder so a missing or expired image never
 * leaves a blank hole in a card.
 */
export const StorageImage = ({
  storageKey,
  style,
  contentFit = 'cover',
  placeholderIcon = 'image-outline',
  rounded = radius.md,
}: {
  storageKey?: string | null;
  /** Sized like an image; the placeholder reuses the same box. */
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  rounded?: number;
}) => {
  const palette = usePalette();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUrl(null);

    if (!storageKey) return;
    resolveImageUrl(storageKey).then((resolved) => {
      if (cancelled) return;
      if (resolved) setUrl(resolved);
      else setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  if (!storageKey || failed) {
    return (
      <View
        style={[
          styles.placeholder,
          { backgroundColor: palette.surfaceAlt, borderRadius: rounded },
          // Only sizing/radius is ever passed in, which both style types share.
          style as StyleProp<ViewStyle>,
        ]}
      >
        <Ionicons name={placeholderIcon} size={22} color={palette.textFaint} />
      </View>
    );
  }

  return (
    <Image
      source={url ? { uri: url } : undefined}
      style={[{ backgroundColor: palette.skeleton, borderRadius: rounded }, style]}
      contentFit={contentFit}
      transition={180}
      onError={() => setFailed(true)}
      cachePolicy="memory-disk"
    />
  );
};

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
