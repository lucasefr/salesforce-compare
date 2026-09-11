import * as fs from 'fs/promises';
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
   * Returns the workspace folder that contains the URI.
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
   * @deprecated Prefer {@link resolveProjectContext} so nested `sfdx-project.json` roots work.
   */
  public static getRelativeSourcePath(uri: vscode.Uri): string | undefined {
    const folder = this.getWorkspaceFolder(uri);
    if (!folder) {
      return undefined;
    }
    return path.relative(folder.uri.fsPath, uri.fsPath).split(path.sep).join('/');
  }

  // SALEXT-0004 - start
  /**
   * Finds the Salesforce DX project root that contains `sfdx-project.json`.
   * Walks up from `startFsPath` (file or directory). If that fails and
   * `startFsPath` is a directory, also checks immediate child folders
   * (common when the workspace opens a parent of the DX project).
   *
   * @param startFsPath - Absolute file or directory path to start from.
   * @returns Absolute project root path, or undefined when not found.
   */
  public static async findSalesforceProjectRoot(
    startFsPath: string
  ): Promise<string | undefined> {
    let current = startFsPath;
    try {
      const stat = await fs.stat(current);
      if (stat.isFile()) {
        current = path.dirname(current);
      }
    } catch {
      current = path.dirname(startFsPath);
    }

    const visited = new Set<string>();
    for (;;) {
      const normalized = path.normalize(current);
      if (visited.has(normalized)) {
        break;
      }
      visited.add(normalized);

      if (await this.hasSfdxProjectJson(normalized)) {
        return normalized;
      }

      const parent = path.dirname(normalized);
      if (parent === normalized) {
        break;
      }
      current = parent;
    }

    // Workspace opened on parent folder (e.g. .../devLucas with project in .../devLucas/devLucas).
    try {
      const startStat = await fs.stat(startFsPath);
      if (startStat.isDirectory()) {
        const children = await fs.readdir(startFsPath, { withFileTypes: true });
        for (const child of children) {
          if (!child.isDirectory() || child.name.startsWith('.')) {
            continue;
          }
          const childPath = path.join(startFsPath, child.name);
          if (await this.hasSfdxProjectJson(childPath)) {
            return childPath;
          }
        }
      }
    } catch {
      // Ignore directory scan failures.
    }

    return undefined;
  }

  /**
   * Resolves the DX project root and the source path relative to that root for a file.
   *
   * @param uri - Local Salesforce source file URI.
   * @returns Project root + relative posix path, or undefined when unresolved.
   */
  public static async resolveProjectContext(
    uri: vscode.Uri
  ): Promise<{ projectRoot: string; relativeSourcePath: string } | undefined> {
    const projectRoot = await this.findSalesforceProjectRoot(uri.fsPath);
    if (!projectRoot) {
      return undefined;
    }
    const relativeSourcePath = path
      .relative(projectRoot, uri.fsPath)
      .split(path.sep)
      .join('/');
    if (
      !relativeSourcePath ||
      relativeSourcePath.startsWith('..') ||
      path.isAbsolute(relativeSourcePath)
    ) {
      return undefined;
    }
    return { projectRoot, relativeSourcePath };
  }

  /**
   * Returns whether `dir` contains an `sfdx-project.json` file.
   *
   * @param dir - Absolute directory path.
   * @returns True when the DX project manifest exists.
   */
  private static async hasSfdxProjectJson(dir: string): Promise<boolean> {
    try {
      await fs.access(path.join(dir, 'sfdx-project.json'));
      return true;
    } catch {
      return false;
    }
  }
  // SALEXT-0004 - end

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
