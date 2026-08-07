import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { StorageImage } from './StorageImage';
import { captureImage, deleteImage, pickImages, uploadImage, type MediaFolder } from '../lib/media';

/**
 * Adds and removes images, storing S3 keys. Upload happens immediately on pick so
 * the caller only ever deals with committed keys — a half-saved form can never
 * leave a photo stranded on the device.
 */
export const ImagesField = ({
  label,
  hint,
  value,
  onChange,
  folder,
  max = 6,
  disabled = false,
  disabledHint,
}: {
  label?: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  folder: MediaFolder;
  max?: number;
  disabled?: boolean;
  disabledHint?: string;
}) => {
  const palette = usePalette();
  const { d } = useI18n();
  const [busy, setBusy] = useState(false);

  const remaining = Math.max(0, max - value.length);

  const addFrom = async (source: 'library' | 'camera') => {
    if (remaining === 0 || busy) return;
    setBusy(true);
    try {
      const uris =
        source === 'camera'
          ? await captureImage().then((uri) => (uri ? [uri] : []))
          : await pickImages({ allowsMultipleSelection: remaining > 1, selectionLimit: remaining });

      if (uris.length === 0) return;

      const keys: string[] = [];
      for (const uri of uris.slice(0, remaining)) {
        keys.push(await uploadImage(uri, folder));
      }
      onChange([...value, ...keys]);
    } catch {
      Alert.alert(d.common.somethingWentWrong, d.common.tryAgain);
    } finally {
      setBusy(false);
    }
  };

  const promptAdd = () => {
    if (disabled) {
      if (disabledHint) Alert.alert(disabledHint);
      return;
    }
    Alert.alert(d.common.addPhoto, undefined, [
      { text: d.common.photos, onPress: () => void addFrom('library') },
      { text: d.common.photo, onPress: () => void addFrom('camera') },
      { text: d.common.cancel, style: 'cancel' },
    ]);
  };

  const removeAt = (key: string) => {
    Alert.alert(d.common.remove, undefined, [
      { text: d.common.cancel, style: 'cancel' },
      {
        text: d.common.remove,
        style: 'destructive',
        onPress: () => {
          onChange(value.filter((item) => item !== key));
          void deleteImage(key);
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {value.map((key) => (
          <View key={key}>
            <StorageImage storageKey={key} style={styles.tile} />
            {!disabled ? (
              <Pressable
                onPress={() => removeAt(key)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={d.common.remove}
                style={[styles.removeBadge, { backgroundColor: palette.danger }]}
              >
                <Ionicons name="close" size={13} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        ))}

        {remaining > 0 ? (
          <Pressable
            onPress={promptAdd}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={d.common.addPhoto}
            style={[
              styles.tile,
              styles.addTile,
              {
                borderColor: disabled ? palette.border : palette.primary,
                backgroundColor: palette.surfaceAlt,
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <>
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={disabled ? palette.textFaint : palette.primary}
                />
                <Text variant="micro" tone={disabled ? 'faint' : 'primary'} align="center">
                  {d.common.addPhoto}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      {hint ? (
        <Text variant="micro" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { gap: spacing.sm, paddingVertical: 2 },
  tile: { width: 92, height: 74, borderRadius: radius.md },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    insetInlineEnd: -6,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
