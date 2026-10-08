import * as vscode from 'vscode';
import logger from '../logger';
import { FileEntry, FileSystem, FileType } from './fs';

// Size placeholders: a remote file/folder over a size limit is not downloaded;
// an empty `<name><suffix>` marker is left on the local side instead.
//   - marker without the original  -> the name is skipped in both directions
//   - original present             -> syncs normally; a 0-byte marker beside it is stale and removed

export const DEFAULT_PLACEHOLDER_SUFFIX = '.placeholder';
// Out-of-the-box limits (package.json `default`s must match; see placeholder-defaults-test).
export const DEFAULT_PLACEHOLDER_FILE_SIZE = '1GB';
export const DEFAULT_PLACEHOLDER_DIRECTORY_SIZE = '10GB';

// number of bytes, or a string such as "500MB" / "1.5 GB". Empty or 0 disables.
export type PlaceholderSize = number | string;

export interface PlaceholderConfig {
  fileSize?: PlaceholderSize;
  directorySize?: PlaceholderSize;
  suffix?: string;
}

export interface PlaceholderOption {
  // in bytes; 0 = off
  fileSize: number;
  directorySize: number;
  suffix: string;
  // directory path -> total size, filled while measuring, valid for one operation
  dirSizeCache: Map<string, number>;
}

export const SIZE_PATTERN = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?\s*$/i;

const SIZE_UNITS = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };

// bytes, or undefined when the value is not a valid size. "" means 0 (off).
export function parseSize(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
  }
  const match = typeof value === 'string' ? SIZE_PATTERN.exec(value) : null;
  if (!match) {
    return undefined;
  }
  const unit = (match[2] || 'b').toLowerCase();
  return Math.floor(parseFloat(match[1]) * SIZE_UNITS[unit]);
}

// Returns undefined when the feature is off (both limits 0 / invalid).
export function createPlaceholderOption(config?: PlaceholderConfig): PlaceholderOption | undefined {
  if (!config) {
    return undefined;
  }
  const fileSize = parseSize(config.fileSize) || 0;
  const directorySize = parseSize(config.directorySize) || 0;
  if (fileSize <= 0 && directorySize <= 0) {
    return undefined;
  }
  return {
    fileSize,
    directorySize,
    suffix: config.suffix || DEFAULT_PLACEHOLDER_SUFFIX,
    dirSizeCache: new Map(),
  };
}

// Matches on the last path segment; used to keep markers out of every transfer.
export function isPlaceholderPath(fsPath: string, option: PlaceholderOption): boolean {
  const name = fsPath.split(/[\\/]/).pop() || '';
  return name.length > option.suffix.length && name.endsWith(option.suffix);
}

export interface ResolvedListing {
  // the listing without marker files
  entries: FileEntry[];
  // original name -> marker, for markers whose original is absent from this listing
  held: Map<string, FileEntry>;
}

// Splits marker files out of a directory listing. When `prune` is set (local side
// only - never delete on the remote) a 0-byte marker next to its original is removed.
export async function resolvePlaceholders(
  fs: FileSystem,
  listing: FileEntry[],
  option: PlaceholderOption,
  prune: boolean
): Promise<ResolvedListing> {
  const names = new Set(listing.map(e => e.name));
  const entries: FileEntry[] = [];
  const held = new Map<string, FileEntry>();

  for (const entry of listing) {
    const isMarker =
      entry.type === FileType.File && isPlaceholderPath(entry.name, option);
    if (!isMarker) {
      entries.push(entry);
      continue;
    }

    const original = entry.name.slice(0, -option.suffix.length);
    if (!names.has(original)) {
      held.set(original, entry);
    } else if (prune && entry.size === 0) {
      await removeQuietly(fs, entry.fspath);
    }
  }

  return { entries, held };
}

async function removeQuietly(fs: FileSystem, fsPath: string) {
  try {
    await fs.unlink(fsPath);
    logger.info(`removed stale placeholder ${fsPath}`);
  } catch (err) {
    logger.warn(`could not remove placeholder ${fsPath}: ${err.message}`);
  }
}

// Removes the 0-byte marker for `fsPath` if there is one (explicit download hydrates it).
export async function removePlaceholderFor(fs: FileSystem, fsPath: string, option: PlaceholderOption) {
  const markerPath = fsPath + option.suffix;
  try {
    const stat = await fs.lstat(markerPath);
    if (stat.type === FileType.File && stat.size === 0) {
      await removeQuietly(fs, markerPath);
    }
  } catch {
    // no marker
  }
}

async function measureDirectory(
  fs: FileSystem,
  dir: string,
  limit: number,
  ignore: ((fsPath: string) => boolean) | null | undefined,
  cache: Map<string, number>
): Promise<number> {
  const cached = cache.get(dir);
  if (cached !== undefined) {
    return cached;
  }

  let total = 0;
  const entries = await fs.list(dir).catch(() => [] as FileEntry[]);
  for (const entry of entries) {
    if (ignore && ignore(entry.fspath)) {
      continue;
    }
    total +=
      entry.type === FileType.Directory
        ? await measureDirectory(fs, entry.fspath, limit - total, ignore, cache)
        : entry.size;
    // stop early: only "over the limit" matters. Not cached - the sum is partial.
    if (total > limit) {
      return total;
    }
  }

  cache.set(dir, total);
  return total;
}

async function exceedsLimit(
  fs: FileSystem,
  entry: FileEntry,
  option: PlaceholderOption,
  ignore: ((fsPath: string) => boolean) | null | undefined
): Promise<boolean> {
  if (entry.type === FileType.File || entry.type === FileType.SymbolicLink) {
    return option.fileSize > 0 && entry.size > option.fileSize;
  }
  if (entry.type === FileType.Directory && option.directorySize > 0) {
    const total = await measureDirectory(fs, entry.fspath, option.directorySize, ignore, option.dirSizeCache);
    return total > option.directorySize;
  }
  return false;
}

// The limits are on by default, so the first skipped download of a session is
// surfaced once; otherwise a big file silently "not syncing" looks like a bug.
let placeholderNoticeShown = false;

function announceFirstPlaceholder(fsPath: string) {
  if (placeholderNoticeShown) {
    return;
  }
  placeholderNoticeShown = true;
  try {
    const name = fsPath.split(/[\\/]/).pop();
    Promise.resolve(
      vscode.window.showInformationMessage(
        `SFTP: "${name}" is over the size limit and was not downloaded; an empty marker was left instead. ` +
          `Limits are set by sftp.defaultPlaceholderFileSize / sftp.defaultPlaceholderDirectorySize (empty = off).`,
        'Open Settings'
      )
    ).then(choice => {
      if (choice === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'sftp.defaultPlaceholder');
      }
    });
  } catch (err) {
    logger.warn(`could not show the placeholder notice: ${err.message}`);
  }
}

async function createPlaceholder(fs: FileSystem, fsPath: string) {
  try {
    await fs.close(await fs.open(fsPath, 'w'));
    logger.info(`placeholder created ${fsPath}`);
    announceFirstPlaceholder(fsPath);
  } catch (err) {
    logger.warn(`could not create placeholder ${fsPath}: ${err.message}`);
  }
}

export interface PlaceholderPlanContext {
  option: PlaceholderOption;
  srcFs: FileSystem;
  srcDir: string;
  desFs: FileSystem;
  desDir: string;
  // the local side is src (upload) or dest (download); markers only ever live/are pruned locally
  srcIsLocal: boolean;
  // false when the operation must not create anything on the other side (syncOption.skipCreate)
  allowCreate: boolean;
  // sync in both directions: entries that exist only on dest are candidates as well
  bothDirections?: boolean;
  // syncOption.delete: local markers whose remote original is gone are removed
  prune?: boolean;
  ignore?: ((fsPath: string) => boolean) | null;
}

// Applies the placeholder rules to one directory's src/dest listings and returns
// listings with marker files, held names and freshly placeholdered entries removed,
// so the caller's normal transfer/delete logic never sees them.
export async function applyPlaceholders(
  ctx: PlaceholderPlanContext,
  srcListing: FileEntry[],
  desListing: FileEntry[]
): Promise<{ src: FileEntry[]; des: FileEntry[] }> {
  const { option, srcFs, desFs, srcIsLocal } = ctx;
  const src = await resolvePlaceholders(srcFs, srcListing, option, srcIsLocal);
  const des = await resolvePlaceholders(desFs, desListing, option, !srcIsLocal);

  const srcNames = new Set(src.entries.map(e => e.name));
  const desNames = new Set(des.entries.map(e => e.name));
  const covered = (e: FileEntry) => Boolean(ctx.ignore && ctx.ignore(e.fspath));
  const dropped = new Set<FileEntry>();

  for (const entry of src.entries) {
    if (desNames.has(entry.name)) {
      continue;
    }
    if (des.held.has(entry.name)) {
      dropped.add(entry);
    } else if (
      ctx.allowCreate &&
      !srcIsLocal &&
      !covered(entry) &&
      (await exceedsLimit(srcFs, entry, option, ctx.ignore))
    ) {
      await createPlaceholder(desFs, desFs.pathResolver.join(ctx.desDir, entry.name + option.suffix));
      dropped.add(entry);
    }
  }

  for (const entry of des.entries) {
    if (srcNames.has(entry.name)) {
      continue;
    }
    if (src.held.has(entry.name)) {
      dropped.add(entry);
    } else if (
      ctx.allowCreate &&
      ctx.bothDirections &&
      srcIsLocal &&
      !covered(entry) &&
      (await exceedsLimit(desFs, entry, option, ctx.ignore))
    ) {
      await createPlaceholder(srcFs, srcFs.pathResolver.join(ctx.srcDir, entry.name + option.suffix));
      dropped.add(entry);
    }
  }

  // remote original deleted -> its local marker is now extraneous
  if (ctx.prune && !srcIsLocal) {
    for (const [original, marker] of des.held) {
      if (!srcNames.has(original) && marker.size === 0) {
        await removeQuietly(desFs, marker.fspath);
      }
    }
  }

  return {
    src: src.entries.filter(e => !dropped.has(e)),
    des: des.entries.filter(e => !dropped.has(e)),
  };
}
