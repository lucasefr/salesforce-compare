import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export interface RetrieveResult {
  /** Absolute path to the retrieved file under the temp project. */
  retrievedFilePath: string;
  /** File content from the Org. */
  content: string;
}

// SALEXT-0004 - start
/**
 * Authenticated Salesforce Org entry returned by `sf org list`.
 */
export interface ListedOrg {
  /** Org alias when configured; otherwise username. */
  alias: string;
  /** Login username. */
  username: string;
  /** True when this is the CLI default target org. */
  isDefault: boolean;
  /** Connected / auth status label from the CLI when present. */
  status?: string;
}
// SALEXT-0004 - end

/**
 * Thin adapter around the Salesforce CLI (`sf`). This is the only module that
 * spawns CLI processes. The extension never runs deploy commands.
 */
export class SfCliAdapter {
  private cliAvailable: boolean | undefined;

  /**
   * Checks whether the `sf` binary is available on PATH.
   *
   * @returns True when `sf version` succeeds.
   */
  public async isCliAvailable(): Promise<boolean> {
    if (this.cliAvailable !== undefined) {
      return this.cliAvailable;
    }
    try {
      await this.runSf(['version', '--json'], undefined);
      this.cliAvailable = true;
    } catch {
      this.cliAvailable = false;
    }
    return this.cliAvailable;
  }

  /**
   * Reads the configured target-org from the Salesforce CLI for a project.
   *
   * @param workspacePath - Absolute path to the Salesforce project root.
   * @returns Target org alias/username, or undefined when not configured.
   */
  public async getTargetOrg(workspacePath: string): Promise<string | undefined> {
    try {
      const stdout = await this.runSf(
        ['config', 'get', 'target-org', '--json'],
        workspacePath
      );
      const parsed = this.parseJsonOutput(stdout) as {
        result?: Array<{ value?: string; name?: string }>;
      };
      const match = parsed.result?.find((row) => row.name === 'target-org');
      const value = match?.value ?? parsed.result?.[0]?.value;
      return value || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Retrieves a single source file from the Org without mutating the user's
   * workspace. Copies `sfdx-project.json` and the source path into an isolated
   * temp project, runs `sf project retrieve start --source-dir`, then reads
   * the overwritten file content.
   *
   * When the metadata does not exist in the target Org, returns empty `content`
   * (so Diff shows an empty Org side instead of the local seed file).
   *
   * @param workspacePath - Salesforce project root (contains sfdx-project.json).
   * @param relativeSourcePath - Path relative to the workspace for --source-dir.
   * @param absoluteLocalPath - Absolute path of the local file (seed + basename).
   * @param targetOrg - Optional org alias/username override.
   * @returns Retrieved file path and content (empty string when missing in Org).
   * @throws Error when CLI fails for reasons other than missing metadata.
   */
  public async retrieveMetadataToTemp(
    workspacePath: string,
    relativeSourcePath: string,
    absoluteLocalPath: string,
    targetOrg?: string
  ): Promise<RetrieveResult> {
    const tempProject = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-compare-proj-'));
    try {
      const sfdxProject = path.join(workspacePath, 'sfdx-project.json');
      try {
        await fs.access(sfdxProject);
      } catch {
        throw new Error(
          `sfdx-project.json not found at "${sfdxProject}". Open the Salesforce DX project root (or a parent folder that contains it).`
        );
      }
      await fs.copyFile(sfdxProject, path.join(tempProject, 'sfdx-project.json'));

      // Copy .sf / .sfdx auth config references are resolved from user home;
      // target-org flag supplies the org for this retrieve.
      const destFile = path.join(tempProject, relativeSourcePath);
      await fs.mkdir(path.dirname(destFile), { recursive: true });

      try {
        await fs.copyFile(absoluteLocalPath, destFile);
      } catch {
        await fs.writeFile(destFile, '', 'utf8');
      }

      const metaPath = `${absoluteLocalPath}-meta.xml`;
      try {
        await fs.copyFile(metaPath, `${destFile}-meta.xml`);
      } catch {
        // Companion meta is optional for some types.
      }

      // SALEXT-0005 - start
      // Seed is only a retrieve hint. If the Org lacks the component, CLI often
      // leaves the seed unchanged — never treat that leftover as Org content.
      const seedContent = await fs.readFile(destFile, 'utf8');
      // SALEXT-0005 - end

      const args = [
        'project',
        'retrieve',
        'start',
        '--source-dir',
        relativeSourcePath,
        '--wait',
        '10',
        '--json',
        // SALEXT-0004 - start
        // Isolated temp project only — always overwrite seed files with Org content.
        // Without this, sandboxes/scratch orgs raise SourceConflictError when local ≠ Org.
        '--ignore-conflicts',
        // SALEXT-0004 - end
      ];
      if (targetOrg) {
        args.push('--target-org', targetOrg);
      }

      // SALEXT-0005 - start
      let stdout = '';
      try {
        stdout = await this.runSf(args, tempProject);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (this.isMetadataMissingFromOrg(message)) {
          return { retrievedFilePath: destFile, content: '' };
        }
        throw error instanceof Error ? error : new Error(message);
      }

      let content = '';
      try {
        content = await fs.readFile(destFile, 'utf8');
      } catch {
        return { retrievedFilePath: destFile, content: '' };
      }

      if (
        this.shouldTreatRetrieveAsMissing(
          stdout,
          relativeSourcePath,
          seedContent,
          content
        )
      ) {
        return { retrievedFilePath: destFile, content: '' };
      }

      return { retrievedFilePath: destFile, content };
      // SALEXT-0005 - end
    } finally {
      void fs.rm(tempProject, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  // SALEXT-0005 - start
  /**
   * Returns whether CLI error/warning text indicates the metadata is absent
   * from the target Org (as opposed to auth or generic retrieve failures).
   *
   * @param message - CLI error message or concatenated retrieve messages.
   * @returns True when the component appears to be missing in the Org.
   */
  private isMetadataMissingFromOrg(message: string): boolean {
    const text = message.trim();
    if (!text) {
      return false;
    }
    if (/entity of type .+ cannot be found/i.test(text)) {
      return true;
    }
    if (/named ['"]?[^'"]+['"]? cannot be found/i.test(text)) {
      return true;
    }
    const lower = text.toLowerCase();
    const markers = [
      'cannot be found',
      'could not be found',
      'could not find',
      'not found in the org',
      'not found in org',
      'does not exist in the org',
      'no source-backed components',
      'no components retrieved',
      'nothing retrieved',
      'nothing to retrieve',
    ];
    return markers.some((marker) => lower.includes(marker));
  }

  /**
   * Decides whether an unchanged seed file after retrieve should be treated as
   * "missing in Org" (return empty) instead of Org content equal to local.
   *
   * @param stdout - Raw `sf project retrieve start --json` stdout.
   * @param relativeSourcePath - Relative source path requested for retrieve.
   * @param seedContent - Temp file content before retrieve.
   * @param content - Temp file content after retrieve.
   * @returns True when Org side should be shown as empty.
   */
  private shouldTreatRetrieveAsMissing(
    stdout: string,
    relativeSourcePath: string,
    seedContent: string,
    content: string
  ): boolean {
    if (content !== seedContent) {
      return false;
    }

    let parsed: {
      message?: string;
      name?: string;
      result?: {
        files?: Array<Record<string, unknown>>;
        fileProperties?: Array<Record<string, unknown>>;
        messages?: Array<Record<string, unknown> | string>;
        message?: string;
        status?: string;
      };
    };
    try {
      parsed = this.parseJsonOutput(stdout) as typeof parsed;
    } catch {
      return false;
    }

    const result = parsed.result ?? {};
    const messageParts = [
      parsed.message,
      parsed.name,
      result.message,
      ...(result.messages ?? []).map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        return String(
          entry.problem ?? entry.message ?? entry.fileName ?? ''
        );
      }),
    ].filter((part) => Boolean(part && String(part).trim()));

    if (this.isMetadataMissingFromOrg(messageParts.join('\n'))) {
      return true;
    }

    const files = [
      ...(Array.isArray(result.files) ? result.files : []),
      ...(Array.isArray(result.fileProperties) ? result.fileProperties : []),
    ];
    const baseName = path.basename(relativeSourcePath).toLowerCase();
    const normalizedRelative = relativeSourcePath.replace(/\\/g, '/').toLowerCase();

    const matching = files.filter((file) => {
      const candidate = String(
        file.filePath ?? file.fullName ?? file.path ?? file.fileName ?? ''
      )
        .replace(/\\/g, '/')
        .toLowerCase();
      return (
        candidate.endsWith(`/${baseName}`) ||
        candidate.endsWith(baseName) ||
        candidate.includes(normalizedRelative)
      );
    });

    if (matching.length === 0) {
      return true;
    }

    return matching.every((file) => {
      const state = String(file.state ?? file.status ?? '').toLowerCase();
      const errorText = String(file.error ?? file.problem ?? '');
      return (
        state === 'failed' ||
        state === 'error' ||
        this.isMetadataMissingFromOrg(errorText)
      );
    });
  }
  // SALEXT-0005 - end

  /**
   * Executes `sf` with the given arguments and returns stdout.
   *
   * @param args - CLI argument list (without the `sf` binary name).
   * @param cwd - Working directory for the process, or undefined.
   * @returns Stdout string.
   * @throws Error including stderr when the process exits non-zero.
   */
  private async runSf(args: string[], cwd: string | undefined): Promise<string> {
    const tryRun = async (command: string, useShell: boolean): Promise<string> => {
      const { stdout } = await execFileAsync(command, args, {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        shell: useShell,
      });
      return stdout;
    };

    try {
      if (process.platform === 'win32') {
        try {
          return await tryRun('sf.cmd', true);
        } catch {
          return await tryRun('sf', true);
        }
      }
      return await tryRun('sf', false);
    } catch (error) {
      const err = error as { stderr?: string; message?: string; stdout?: string };
      // SALEXT-0004 - start
      throw new Error(this.formatCliFailure(err));
      // SALEXT-0004 - end
    }
  }

  // SALEXT-0004 - start
  /**
   * Builds a concise user-facing error from Salesforce CLI stdout/stderr.
   * Strips update banners and prefers JSON `message` / `name` when present.
   *
   * @param err - Captured process error fields from execFile.
   * @returns Short error text for UI toasts and status.
   */
  private formatCliFailure(err: {
    stderr?: string;
    stdout?: string;
    message?: string;
  }): string {
    const combined = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n');
    if (!combined.trim()) {
      return 'sf command failed';
    }

    const withoutBanners = combined
      .replace(/^»\s*Warning:[\s\S]*?(?=\{|\n\{|$)/gim, '')
      .replace(/^Warning:[\s\S]*?(?=\{|\n\{|$)/gim, '')
      .trim();

    const jsonCandidate = withoutBanners.match(/\{[\s\S]*\}/);
    if (jsonCandidate) {
      try {
        const parsed = JSON.parse(jsonCandidate[0]) as {
          name?: string;
          message?: string;
          data?: unknown;
        };
        const name = parsed.name?.trim();
        const message = parsed.message?.trim();
        if (name && message) {
          return `${name}: ${message}`;
        }
        if (message) {
          return message;
        }
      } catch {
        // Fall through to truncated raw text.
      }
    }

    const compact = withoutBanners || combined;
    return compact.length > 500 ? `${compact.slice(0, 500)}…` : compact;
  }
  // SALEXT-0004 - end

  /**
   * Shows a user-facing warning when the Salesforce CLI is missing.
   *
   * @returns Promise that resolves after the message is shown.
   */
  public async notifyCliMissing(): Promise<void> {
    await vscode.window.showWarningMessage(
      'Salesforce Compare: Salesforce CLI (`sf`) was not found on PATH. Install it to enable Org comparison.'
    );
  }

  // SALEXT-0004 - start
  /**
   * Lists authenticated Salesforce Orgs available to the CLI.
   * Uses `--skip-connection-status` so the call stays fast (connection checks
   * can take a minute+ and block Authorize → sidebar updates).
   *
   * @returns Array of org alias/username entries (may be empty).
   * @throws Error when the CLI fails.
   */
  public async listOrgs(): Promise<ListedOrg[]> {
    const stdout = await this.runSf(
      ['org', 'list', '--skip-connection-status', '--json'],
      undefined
    );
    const parsed = this.parseJsonOutput(stdout) as {
      result?: {
        nonScratchOrgs?: Array<Record<string, unknown>>;
        scratchOrgs?: Array<Record<string, unknown>>;
        sandboxes?: Array<Record<string, unknown>>;
        devHubs?: Array<Record<string, unknown>>;
        other?: Array<Record<string, unknown>>;
      };
    };

    const rows = [
      ...(parsed.result?.nonScratchOrgs ?? []),
      ...(parsed.result?.scratchOrgs ?? []),
      ...(parsed.result?.sandboxes ?? []),
      ...(parsed.result?.devHubs ?? []),
      ...(parsed.result?.other ?? []),
    ];

    const orgs: ListedOrg[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const username = String(row.username ?? '').trim();
      const alias = String(row.alias ?? row.username ?? '').trim();
      if (!alias && !username) {
        continue;
      }
      const key = (alias || username).toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      orgs.push({
        alias: alias || username,
        username: username || alias,
        isDefault: Boolean(row.isDefaultUsername || row.isDefaultDevHubUsername),
        status: row.connectedStatus ? String(row.connectedStatus) : undefined,
      });
    }
    return orgs;
  }

  /**
   * Parses Salesforce CLI JSON stdout, stripping update banners that precede `{`.
   *
   * @param stdout - Raw CLI stdout (may include warning banners).
   * @returns Parsed JSON object.
   * @throws Error when no JSON object can be parsed.
   */
  private parseJsonOutput(stdout: string): unknown {
    const withoutBanners = stdout
      .replace(/^»\s*Warning:[\s\S]*?(?=\{)/gim, '')
      .replace(/^Warning:[\s\S]*?(?=\{)/gim, '')
      .trim();
    const jsonCandidate = withoutBanners.match(/\{[\s\S]*\}/);
    if (!jsonCandidate) {
      throw new Error('Salesforce CLI returned no JSON payload.');
    }
    return JSON.parse(jsonCandidate[0]);
  }

  /**
   * Opens an integrated terminal and starts `sf org login web` so the user
   * can authenticate a new Org. The extension never captures credentials.
   *
   * @returns Promise that resolves after the terminal command is sent.
   * @deprecated Prefer {@link loginOrgWeb} with alias + instance URL (Authorize an Org flow).
   */
  public async loginOrgViaTerminal(): Promise<void> {
    const terminal = vscode.window.createTerminal({
      name: 'Salesforce Compare — Org Login',
    });
    terminal.show(true);
    terminal.sendText('sf org login web');
  }

  /**
   * Runs `sf org login web` with alias and instance URL (same flags as
   * Salesforce Extension Pack "Authorize an Org"). Waits until the browser
   * OAuth flow completes. Never captures credentials.
   *
   * @param options - Alias, instance URL, and optional set-default flag.
   * @returns Promise that resolves when CLI login finishes successfully.
   * @throws Error when the CLI fails or the user cancels in the browser.
   */
  public async loginOrgWeb(options: {
    alias: string;
    instanceUrl: string;
    setDefault?: boolean;
  }): Promise<void> {
    const args = [
      'org',
      'login',
      'web',
      '--alias',
      options.alias,
      '--instance-url',
      options.instanceUrl,
      '--json',
    ];
    if (options.setDefault) {
      args.push('--set-default');
    }
    await this.runSf(args, undefined);
  }
  // SALEXT-0004 - end
}
