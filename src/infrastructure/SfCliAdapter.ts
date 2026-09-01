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
      const parsed = JSON.parse(stdout) as {
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
   * @param workspacePath - Salesforce project root (contains sfdx-project.json).
   * @param relativeSourcePath - Path relative to the workspace for --source-dir.
   * @param absoluteLocalPath - Absolute path of the local file (seed + basename).
   * @param targetOrg - Optional org alias/username override.
   * @returns Retrieved file path and content.
   * @throws Error when CLI fails or the retrieved file cannot be read.
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

      const args = [
        'project',
        'retrieve',
        'start',
        '--source-dir',
        relativeSourcePath,
        '--wait',
        '10',
        '--json',
      ];
      if (targetOrg) {
        args.push('--target-org', targetOrg);
      }

      await this.runSf(args, tempProject);

      const content = await fs.readFile(destFile, 'utf8');
      return { retrievedFilePath: destFile, content };
    } finally {
      void fs.rm(tempProject, { recursive: true, force: true }).catch(() => undefined);
    }
  }

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
      const details = [err.stderr, err.stdout, err.message].filter(Boolean).join('\n');
      throw new Error(details || 'sf command failed');
    }
  }

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
}
