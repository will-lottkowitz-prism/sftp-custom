import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import app from '../app';
import logger from '../logger';
import { reportError } from '../helper';
import { IN_PATH_CONFIG_FILENAME } from '../constants';
import { readConfigsFromFile } from './config';
import { createFileService, findAllFileService, disposeFileService } from './serviceManager';

// Config folders we've already turned into FileServices (normalized fsPath).
const registeredDirs = new Set<string>();
// Profile names contributed by single-server in-path configs, so `SFTP: Set
// Profile` can list them (a single-server config exposes no `profiles` of its own).
const discoveredSingleProfiles = new Set<string>();

function norm(p: string): string {
  return path.normalize(p);
}

function lc(p: string): string {
  return norm(p).toLowerCase();
}

function samePath(a: string, b: string): boolean {
  return lc(a) === lc(b);
}

function isUnderOrEqual(child: string, parent: string): boolean {
  const c = lc(child);
  const p = lc(parent);
  if (c === p) {
    return true;
  }
  const prefix = p.endsWith(path.sep) ? p : p + path.sep;
  return c.startsWith(prefix);
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

// The folder to begin the walk-up from: the path itself when it's a directory
// (e.g. a right-clicked folder), otherwise the containing folder of a file.
function startDirFor(fsPath: string): string {
  try {
    if (fs.statSync(fsPath).isDirectory()) {
      return fsPath;
    }
  } catch {
    // Non-existent / unreadable: fall back to the parent folder.
  }
  return path.dirname(fsPath);
}

// Walk up from the target's own folder to the workspace root (inclusive),
// returning the nearest `.sftp.json` path, or null if none. When the target is
// itself a directory, its own `.sftp.json` is considered first.
function findNearestInPathConfig(fileFsPath: string, wsRoot: string): string | null {
  let dir = startDirFor(fileFsPath);
  while (isUnderOrEqual(dir, wsRoot)) {
    const candidate = path.join(dir, IN_PATH_CONFIG_FILENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    if (samePath(dir, wsRoot)) {
      break;
    }
    const parent = path.dirname(dir);
    if (samePath(parent, dir)) {
      break;
    }
    dir = parent;
  }
  return null;
}

// The profile name for a single-server config: its own `name` if it declares
// one, otherwise its folder relative to the project root (POSIX style), e.g.
// "sub/area" - falling back to the workspace folder name at the root.
function profileNameFor(
  configDir: string,
  wsRoot: string,
  declaredName?: string
): string {
  if (declaredName && declaredName.trim()) {
    return declaredName.trim();
  }
  const rel = toPosix(path.relative(wsRoot, configDir));
  return rel === '' ? path.basename(wsRoot) : rel;
}

// The default profile to fall back to when a file is outside every in-path
// config: whatever the project-root config declares as `defaultProfile`.
function getWorkspaceDefaultProfile(wsRoot: string): string | null {
  const roots = findAllFileService(
    service => samePath(service.workspace, wsRoot) && samePath(service.baseDir, wsRoot)
  );
  for (const service of roots) {
    const def = service.getDefaultProfile();
    if (def) {
      return def;
    }
  }
  return null;
}

export function getDiscoveredProfileNames(): string[] {
  return Array.from(discoveredSingleProfiles);
}

async function registerAndActivate(configPath: string, wsRoot: string): Promise<void> {
  const configDir = path.dirname(configPath);
  const normDir = norm(configDir);
  // "Subfolder is the root": root each in-path service at its own folder so
  // remote paths map relative to where the `.sftp.json` lives.
  const context = toPosix(path.relative(wsRoot, configDir));

  const configs = await readConfigsFromFile(configPath);
  if (configs.length === 0) {
    return;
  }

  const hasProfiles = configs.length === 1 && Boolean(configs[0].profiles);
  const isSingleServer = configs.length === 1 && !configs[0].profiles;

  if (!registeredDirs.has(normDir)) {
    if (hasProfiles) {
      // A full config-with-profiles for this subtree. createFileService exposes
      // its profiles via getAvailableProfiles and honors its defaultProfile.
      createFileService({ ...configs[0], context }, wsRoot);
    } else if (isSingleServer) {
      const name = profileNameFor(configDir, wsRoot, configs[0].name);
      createFileService({ ...configs[0], context, name }, wsRoot);
      discoveredSingleProfiles.add(name);
    } else {
      // Array of servers: register each, named by its own `name` or by index.
      configs.forEach((cfg, index) => {
        const name = cfg.name || `${profileNameFor(configDir, wsRoot)} [${index}]`;
        createFileService({ ...cfg, context, name }, wsRoot);
        discoveredSingleProfiles.add(name);
      });
    }
    registeredDirs.add(normDir);
    logger.info(`[profile-discovery] registered ${configPath}`);
  }

  // Switch the active profile to this config.
  if (hasProfiles) {
    const ownProfiles = Object.keys(configs[0].profiles || {});
    const current = app.state.profile;
    // Respect a manual selection: when this config defines multiple profiles and
    // the active profile is already one of them, leave it alone. Otherwise fall
    // back to the config's declared default.
    const currentIsOwnProfile = Boolean(current) && ownProfiles.includes(current as string);
    if (!currentIsOwnProfile && configs[0].defaultProfile) {
      app.state.profile = configs[0].defaultProfile;
    }
  } else if (isSingleServer) {
    app.state.profile = profileNameFor(configDir, wsRoot, configs[0].name);
  } else {
    app.state.profile = configs[0].name || `${profileNameFor(configDir, wsRoot)} [0]`;
  }
}

// Triggered on file open and on right-click file commands: find the nearest
// in-path `.sftp.json`, register it (once) and switch to its profile. When the
// file sits outside every in-path config, revert to the project default.
export async function discoverForFile(uri: vscode.Uri): Promise<void> {
  if (!uri || uri.scheme !== 'file') {
    return;
  }

  const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!wsFolder) {
    return;
  }
  const wsRoot = wsFolder.uri.fsPath;

  const configPath = findNearestInPathConfig(uri.fsPath, wsRoot);
  if (!configPath) {
    app.state.profile = getWorkspaceDefaultProfile(wsRoot);
    return;
  }

  try {
    await registerAndActivate(configPath, wsRoot);
  } catch (error) {
    reportError(error);
  }
}

// Drop every in-path FileService rooted at `dir` and forget the folder was ever
// registered, so the next discovery re-reads it from disk. Every service from a
// single `.sftp.json` is rooted at that file's folder, so an exact-path match
// covers them all; nested in-path configs and the workspace-root config
// (baseDir === its own workspace) are left untouched.
function unregisterDir(dir: string): void {
  const normDir = norm(dir);

  findAllFileService(
    service => samePath(service.baseDir, normDir) && !samePath(service.baseDir, service.workspace)
  ).forEach(service => {
    if (service.name) {
      discoveredSingleProfiles.delete(service.name);
    }
    disposeFileService(service);
  });

  registeredDirs.delete(normDir);
}

// An in-path `.sftp.json` was saved, created, or deleted. Rebuild the
// FileService for its folder from disk and re-activate its profile; if the file
// is gone, drop it and fall back to the project default. This is the in-path
// equivalent of the root config's save-triggered reload, so a change takes
// effect without a window reload.
export async function reloadInPathConfig(uri: vscode.Uri): Promise<void> {
  if (!uri || uri.scheme !== 'file') {
    return;
  }

  const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!wsFolder) {
    return;
  }
  const wsRoot = wsFolder.uri.fsPath;
  const configDir = path.dirname(uri.fsPath);

  unregisterDir(configDir);

  try {
    if (fs.existsSync(uri.fsPath)) {
      await registerAndActivate(uri.fsPath, wsRoot);
      logger.info(`[profile-discovery] reloaded ${uri.fsPath}`);
    } else {
      app.state.profile = getWorkspaceDefaultProfile(wsRoot);
      logger.info(`[profile-discovery] dropped ${uri.fsPath}`);
    }
  } catch (error) {
    reportError(error);
  } finally {
    if (app.remoteExplorer) {
      app.remoteExplorer.refresh();
    }
  }
}
