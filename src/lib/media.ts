import * as ImagePicker from 'expo-image-picker';
import { getUrl, remove, uploadData } from 'aws-amplify/storage';

/** Signed URLs are valid for an hour; re-signing on every render would be wasteful. */
const URL_TTL_MS = 45 * 60 * 1000;
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export type MediaFolder = 'catalog' | 'orders' | 'chat' | 'branding';

const uuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/**
 * Opens the picker and returns local URIs. Images are downscaled and re-encoded
 * before upload: phone cameras produce 4-8 MB files that would make the roadmap
 * crawl on a slow connection.
 */
export const pickImages = async (options?: {
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
}): Promise<string[]> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.72,
    allowsMultipleSelection: options?.allowsMultipleSelection ?? false,
    selectionLimit: options?.selectionLimit ?? 1,
    exif: false,
  });

  if (result.canceled) return [];
  return result.assets.map((asset) => asset.uri);
};

export const captureImage = async (): Promise<string | null> => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.72, exif: false });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
};

/** Uploads a local URI to S3 and returns the storage key to persist on the record. */
export const uploadImage = async (
  localUri: string,
  folder: MediaFolder,
  onProgress?: (fraction: number) => void,
): Promise<string> => {
  const response = await fetch(localUri);
  const blob = await response.blob();

  const extension = (localUri.split('.').pop() ?? 'jpg').split('?')[0].toLowerCase();
  const safeExtension = /^(jpg|jpeg|png|webp|heic)$/.test(extension) ? extension : 'jpg';
  const path = `${folder}/${uuid()}.${safeExtension}`;

  await uploadData({
    path,
    data: blob,
    options: {
      contentType: blob.type || `image/${safeExtension === 'jpg' ? 'jpeg' : safeExtension}`,
      onProgress: onProgress
        ? ({ transferredBytes, totalBytes }) => {
            if (totalBytes) onProgress(transferredBytes / totalBytes);
          }
        : undefined,
    },
  }).result;

  return path;
};

/** Resolves a storage key to a signed URL, memoised until shortly before expiry. */
export const resolveImageUrl = async (key: string): Promise<string | null> => {
  if (!key) return null;

  const cached = urlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  try {
    const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
    const href = url.toString();
    urlCache.set(key, { url: href, expiresAt: Date.now() + URL_TTL_MS });
    return href;
  } catch {
    return null;
  }
};

export const deleteImage = async (key: string): Promise<void> => {
  urlCache.delete(key);
  try {
    await remove({ path: key });
  } catch {
    // A dangling object is harmless; never block the user on cleanup.
  }
};
