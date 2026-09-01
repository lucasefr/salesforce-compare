import * as path from 'path';
import * as vscode from 'vscode';
import { DEFAULT_SUPPORTED_EXTENSIONS, SALESFORCE_PATH_MARKERS } from './constants';

/**
 * Maps local Salesforce DX source paths to metadata retrieve hints
 * and decides whether a file is eligible for Org comparison.
 */
export class SalesforcePathMapper {
  /**
   * Returns whether the URI is a Salesforce source file eligible for comparison.
   *
   * @param uri - File URI to evaluate.
   * @param supportedExtensions - Optional override list of extensions (with leading dot).
   * @returns True when the path looks like Salesforce metadata under a package directory.
   */
  public static isEligibleFile(
    uri: vscode.Uri,
    supportedExtensions?: readonly string[]
  ): boolean {
    if (uri.scheme !== 'file') {
      return false;
    }

    const filePath = uri.fsPath;
    const ext = path.extname(filePath).toLowerCase();
    const extensions = supportedExtensions ?? DEFAULT_SUPPORTED_EXTENSIONS;

    if (!extensions.map((e) => e.toLowerCase()).includes(ext)) {
      return false;
    }

    // Skip standalone -meta.xml companions unless they are object meta files.
    if (filePath.endsWith('-meta.xml') && !filePath.endsWith('.object-meta.xml')) {
      return false;
    }

    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const hasSalesforceLayout = SALESFORCE_PATH_MARKERS.some((marker) =>
      normalized.includes(marker.replace(/\\/g, '/').toLowerCase())
    );

    if (!hasSalesforceLayout) {
      return false;
    }

    // LWC/Aura assets must live under their folders.
    if (['.js', '.html', '.css'].includes(ext)) {
      return normalized.includes('/lwc/') || normalized.includes('/aura/');
    }

    return true;
  }

  /**
   * Resolves the workspace folder that owns the given file.
   *
   * @param uri - File URI.
   * @returns Workspace folder or undefined when the file is outside the workspace.
   */
  public static getWorkspaceFolder(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.getWorkspaceFolder(uri);
  }

  /**
   * Returns the relative path from the workspace root (posix-style separators).
   *
   * @param uri - File URI.
   * @returns Relative path string, or undefined when not in a workspace.
   */
  public static getRelativeSourcePath(uri: vscode.Uri): string | undefined {
    const folder = this.getWorkspaceFolder(uri);
    if (!folder) {
      return undefined;
    }
    return path.relative(folder.uri.fsPath, uri.fsPath).split(path.sep).join('/');
  }

  /**
   * Builds a stable cache key for a file URI.
   *
   * @param uri - File URI.
   * @returns Cache key string.
   */
  public static toCacheKey(uri: vscode.Uri): string {
    return uri.toString();
  }
}
