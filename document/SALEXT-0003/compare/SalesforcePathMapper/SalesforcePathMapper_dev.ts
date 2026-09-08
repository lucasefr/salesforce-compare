import * as path from 'path';
import * as vscode from 'vscode';
import {
  COMPANION_META_SUFFIXES,
  DEFAULT_SUPPORTED_EXTENSIONS,
  SALESFORCE_PATH_MARKERS,
} from './constants';

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

    // SALEXT-0003 - start
    // Skip companion -meta.xml files (Apex/LWC/Aura/VF companions).
    // Accept standalone metadata XML (object, layout, flow, permissionset, etc.).
    if (this.isCompanionMetaXml(filePath)) {
      return false;
    }
    // SALEXT-0003 - end

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
   * Returns whether the path is a companion `-meta.xml` that accompanies a
   * primary source file (e.g. `MyClass.cls-meta.xml`), as opposed to
   * standalone Salesforce metadata such as `.object-meta.xml` or `.layout-meta.xml`.
   *
   * @param filePath - Absolute or relative file path to evaluate.
   * @returns True when the file should not be compared independently.
   */
  // SALEXT-0003 - start
  public static isCompanionMetaXml(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    if (COMPANION_META_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
      return true;
    }

    // Aura `.app-meta.xml` is a companion; `applications/*.app-meta.xml` is CustomApplication.
    if (lower.endsWith('.app-meta.xml')) {
      const normalized = lower.replace(/\\/g, '/');
      return normalized.includes('/aura/');
    }

    return false;
  }
  // SALEXT-0003 - end

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
