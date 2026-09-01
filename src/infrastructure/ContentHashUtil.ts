import * as crypto from 'crypto';

/**
 * Utilities for normalizing file content and computing comparison hashes.
 */
export class ContentHashUtil {
  /**
   * Normalizes line endings to LF and strips a trailing BOM so local vs Org
   * comparisons are not affected by platform EOL differences.
   *
   * @param content - Raw file content.
   * @returns Normalized content string.
   */
  public static normalize(content: string): string {
    let normalized = content.replace(/^\uFEFF/, '');
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalized;
  }

  /**
   * Computes a SHA-256 hex digest of the normalized content.
   *
   * @param content - Raw or already normalized content.
   * @returns Hex-encoded SHA-256 hash.
   */
  public static hash(content: string): string {
    const normalized = this.normalize(content);
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /**
   * Compares two content strings using normalized hashes.
   *
   * @param left - First content string.
   * @param right - Second content string.
   * @returns True when both normalize to the same hash.
   */
  public static areEqual(left: string, right: string): boolean {
    return this.hash(left) === this.hash(right);
  }
}
