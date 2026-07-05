/**
 * Extracts the Google Drive File ID from standard sharing and export links.
 * Works with URLs like:
 * - docs.google.com/uc?export=download&id=FILE_ID
 * - drive.google.com/open?id=FILE_ID
 * - drive.google.com/file/d/FILE_ID/view
 */
export function getDriveFileId(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Transforms a Google Drive file link into a direct thumbnail embedding URL
 * that bypasses third-party cookie restrictions and does not trigger downloads.
 * Returns the original URL if it's not a Google Drive link or is empty.
 */
export function getEmbeddableImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  // Only transform Google Drive links
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const fileId = getDriveFileId(url);
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }
  
  return url;
}

/**
 * Transforms a Google Drive video link into its preview format to embed
 * inside a responsive <iframe> component.
 * Returns the original URL if not a Google Drive link.
 */
export function getEmbeddableVideoUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const fileId = getDriveFileId(url);
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  }
  
  return url;
}
