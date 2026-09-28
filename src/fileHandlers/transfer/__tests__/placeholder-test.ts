jest.mock('fs');

import { vol } from 'memfs';
import * as fs from 'fs';
import * as path from 'path';
import { sync, transfer, TransferDirection } from '../transfer';
import localFs from '../../../core/localFs';
import TransferTask from '../../../core/transferTask';
import {
  createPlaceholderOption,
  isPlaceholderPath,
  parseSize,
  PlaceholderConfig,
} from '../../../core/placeholder';

const bytes = (n: number) => 'x'.repeat(n);
const norm = (paths: string[]) => paths.map(p => p.replace(/\//g, path.sep)).sort();

function fillFs(files: { [x: string]: string }) {
  vol.fromJSON(files, '/');
}

function option(config: PlaceholderConfig = { fileSize: 50, directorySize: 100 }) {
  return createPlaceholderOption(config);
}

function pathsOf(tasks: TransferTask[]) {
  return tasks.map(t => t.targetFsPath).sort();
}

async function download(transferOption: any) {
  const tasks: TransferTask[] = [];
  const deleted = await sync(
    {
      srcFsPath: '/remote',
      srcFs: localFs,
      targetFsPath: '/local',
      targetFs: localFs,
      transferDirection: TransferDirection.REMOTE_TO_LOCAL,
      transferOption: { perserveTargetMode: false, placeholder: option(), ...transferOption },
    },
    t => tasks.push(t)
  );
  return { tasks, deleted };
}

async function upload(transferOption: any) {
  const tasks: TransferTask[] = [];
  const deleted = await sync(
    {
      srcFsPath: '/local',
      srcFs: localFs,
      targetFsPath: '/remote',
      targetFs: localFs,
      transferDirection: TransferDirection.LOCAL_TO_REMOTE,
      transferOption: { perserveTargetMode: false, placeholder: option(), ...transferOption },
    },
    t => tasks.push(t)
  );
  return { tasks, deleted };
}

describe('size placeholders', () => {
  afterEach(() => {
    vol.reset();
  });

  describe('config', () => {
    test.each([
      [undefined, 0],
      ['', 0],
      [0, 0],
      [1024, 1024],
      ['500', 500],
      ['500MB', 500 * 1024 ** 2],
      ['1.5 gb', 1.5 * 1024 ** 3],
      ['2Kb', 2048],
      ['lots', undefined],
      ['-1', undefined],
      [-5, undefined],
    ])('parseSize(%p) = %p', (input, expected) => {
      expect(parseSize(input)).toBe(expected);
    });

    test('feature is off unless a limit is set', () => {
      expect(createPlaceholderOption(undefined)).toBeUndefined();
      expect(createPlaceholderOption({ fileSize: '', directorySize: 0 })).toBeUndefined();
      expect(createPlaceholderOption({ fileSize: 'junk' })).toBeUndefined();
      expect(createPlaceholderOption({ directorySize: '1GB' })!.suffix).toBe('.placeholder');
    });

    test('isPlaceholderPath matches the last segment only', () => {
      const o = option()!;
      expect(isPlaceholderPath('/a/b/big.iso.placeholder', o)).toBe(true);
      expect(isPlaceholderPath('C:\\a\\big.placeholder', o)).toBe(true);
      expect(isPlaceholderPath('/a/b/big.iso', o)).toBe(false);
      expect(isPlaceholderPath('/a/x.placeholder/big.iso', o)).toBe(false);
      expect(isPlaceholderPath('/a/.placeholder', o)).toBe(false);
    });
  });

  describe('download (remote -> local)', () => {
    test('big file and big folder become markers, the rest downloads', async () => {
      fillFs({
        '/remote/small': bytes(10),
        '/remote/big': bytes(100),
        '/remote/bigdir/a': bytes(60),
        '/remote/bigdir/b': bytes(60),
        '/remote/smalldir/c': bytes(5),
        '/local/.keep': '',
      });

      const { tasks } = await download({});

      expect(pathsOf(tasks)).toEqual(norm(['/local/small', '/local/smalldir/c']));
      expect(fs.statSync('/local/big.placeholder').size).toBe(0);
      expect(fs.statSync('/local/bigdir.placeholder').size).toBe(0);
      expect(fs.existsSync('/local/big')).toBe(false);
      expect(fs.existsSync('/local/bigdir')).toBe(false);
    });

    test('a file exactly at the limit is not placeholdered', async () => {
      fillFs({ '/remote/edge': bytes(50), '/remote/over': bytes(51) });

      const { tasks } = await download({});

      expect(pathsOf(tasks)).toEqual(norm(['/local/edge']));
      expect(fs.existsSync('/local/over.placeholder')).toBe(true);
    });

    test('an existing marker holds the name, even with --delete', async () => {
      fillFs({
        '/remote/big': bytes(100),
        '/remote/bigdir/a': bytes(200),
        '/local/big.placeholder': '',
        '/local/bigdir.placeholder': '',
      });

      const { tasks, deleted } = await download({ delete: true });

      expect(tasks).toHaveLength(0);
      expect(deleted).toHaveLength(0);
      expect(fs.existsSync('/local/big.placeholder')).toBe(true);
      expect(fs.existsSync('/local/bigdir.placeholder')).toBe(true);
    });

    test('a marker holds the name even when the remote file is now small', async () => {
      fillFs({ '/remote/small': bytes(1), '/local/small.placeholder': '' });

      const { tasks } = await download({});

      expect(tasks).toHaveLength(0);
    });

    test('an existing local file syncs normally, however big', async () => {
      fillFs({ '/remote/big': bytes(100), '/local/big': bytes(90) });

      const { tasks } = await download({});

      expect(pathsOf(tasks)).toEqual(norm(['/local/big']));
      expect(fs.existsSync('/local/big.placeholder')).toBe(false);
    });

    test('a 0-byte marker beside the real file is deleted and the file syncs', async () => {
      fillFs({
        '/remote/big': bytes(100),
        '/local/big': bytes(90),
        '/local/big.placeholder': '',
      });

      const { tasks } = await download({});

      expect(pathsOf(tasks)).toEqual(norm(['/local/big']));
      expect(fs.existsSync('/local/big.placeholder')).toBe(false);
    });

    test('a non-empty marker beside the real file is left alone', async () => {
      fillFs({
        '/remote/big': bytes(100),
        '/local/big': bytes(90),
        '/local/big.placeholder': 'my notes',
      });

      const { tasks } = await download({});

      expect(pathsOf(tasks)).toEqual(norm(['/local/big']));
      expect(fs.existsSync('/local/big.placeholder')).toBe(true);
    });

    test('--delete removes a marker whose remote original is gone', async () => {
      fillFs({ '/remote/other': bytes(1), '/local/gone.placeholder': '' });

      await download({ delete: true });

      expect(fs.existsSync('/local/gone.placeholder')).toBe(false);
    });

    test('without --delete a stale marker is kept', async () => {
      fillFs({ '/remote/other': bytes(1), '/local/gone.placeholder': '' });

      await download({});

      expect(fs.existsSync('/local/gone.placeholder')).toBe(true);
    });

    test('skipCreate creates neither files nor markers', async () => {
      fillFs({ '/remote/big': bytes(100), '/local/.keep': '' });

      const { tasks } = await download({ skipCreate: true });

      expect(tasks).toHaveLength(0);
      expect(fs.existsSync('/local/big.placeholder')).toBe(false);
    });

    test('ignored big files get no marker', async () => {
      fillFs({ '/remote/big.iso': bytes(100), '/local/.keep': '' });

      await download({ ignore: (p: string) => p.endsWith('.iso') });

      expect(fs.existsSync('/local/big.iso.placeholder')).toBe(false);
    });

    test('folder size ignores ignored files and stops counting at the limit', async () => {
      fillFs({
        '/remote/d/keep': bytes(40),
        '/remote/d/junk.log': bytes(500),
        '/remote/d/sub/x': bytes(40),
      });

      const { tasks } = await download({ ignore: (p: string) => p.endsWith('.log') });

      expect(fs.existsSync('/local/d.placeholder')).toBe(false);
      expect(pathsOf(tasks)).toEqual(norm(['/local/d/keep', '/local/d/sub/x']));
    });

    test('feature off: nothing changes and marker-named files transfer as normal files', async () => {
      fillFs({ '/remote/big': bytes(100), '/remote/x.placeholder': bytes(3) });

      const { tasks } = await download({ placeholder: undefined });

      expect(pathsOf(tasks)).toEqual(norm(['/local/big', '/local/x.placeholder']));
    });
  });

  describe('upload (local -> remote)', () => {
    test('a local marker protects the remote original from --delete and is never uploaded', async () => {
      fillFs({
        '/local/big.placeholder': '',
        '/local/bigdir.placeholder': '',
        '/remote/big': bytes(100),
        '/remote/bigdir/a': bytes(100),
      });

      const { tasks, deleted } = await upload({ delete: true });

      expect(tasks).toHaveLength(0);
      expect(deleted).toHaveLength(0);
    });

    test('big local files still upload (no placeholders for uploads)', async () => {
      fillFs({ '/local/big': bytes(100), '/remote/.keep': '' });

      const { tasks } = await upload({});

      expect(pathsOf(tasks)).toEqual(norm(['/remote/big']));
      expect(fs.existsSync('/remote/big.placeholder')).toBe(false);
    });

    test('a 0-byte local marker beside the real file is removed and the file uploads', async () => {
      fillFs({
        '/local/big': bytes(100),
        '/local/big.placeholder': '',
        '/remote/big': bytes(90),
      });

      const { tasks } = await upload({});

      expect(pathsOf(tasks)).toEqual(norm(['/remote/big']));
      expect(fs.existsSync('/local/big.placeholder')).toBe(false);
    });

    test('a remote-side marker is never pruned', async () => {
      fillFs({
        '/local/big': bytes(100),
        '/remote/big': bytes(90),
        '/remote/big.placeholder': '',
      });

      await upload({});

      expect(fs.existsSync('/remote/big.placeholder')).toBe(true);
    });
  });

  describe('both directions', () => {
    test('remote-only big file becomes a local marker instead of being pulled down', async () => {
      fillFs({
        '/local/mine': bytes(10),
        '/remote/big': bytes(100),
        '/remote/small': bytes(10),
      });

      const { tasks } = await upload({ bothDiretions: true });

      expect(pathsOf(tasks)).toEqual(norm(['/local/small', '/remote/mine']));
      expect(fs.existsSync('/local/big.placeholder')).toBe(true);
    });

    test('a local marker stops the remote original being pulled down', async () => {
      fillFs({ '/local/big.placeholder': '', '/remote/big': bytes(100) });

      const { tasks } = await upload({ bothDiretions: true });

      expect(tasks).toHaveLength(0);
    });
  });

  describe('explicit transfer()', () => {
    async function explicitDownload(src: string, target: string) {
      const tasks: TransferTask[] = [];
      await transfer(
        {
          srcFsPath: src,
          srcFs: localFs,
          targetFsPath: target,
          targetFs: localFs,
          transferDirection: TransferDirection.REMOTE_TO_LOCAL,
          transferOption: { perserveTargetMode: false, placeholder: option() },
        },
        t => tasks.push(t)
      );
      return tasks;
    }

    test('downloading a file overrides its own marker', async () => {
      fillFs({ '/remote/big': bytes(100), '/local/big.placeholder': '' });

      const tasks = await explicitDownload('/remote/big', '/local/big');

      expect(pathsOf(tasks)).toEqual(norm(['/local/big']));
      expect(fs.existsSync('/local/big.placeholder')).toBe(false);
    });

    test('downloading a folder placeholders its big children', async () => {
      fillFs({
        '/remote/d/small': bytes(10),
        '/remote/d/big': bytes(100),
        '/local/.keep': '',
      });

      const tasks = await explicitDownload('/remote/d', '/local/d');

      expect(pathsOf(tasks)).toEqual(norm(['/local/d/small']));
      expect(fs.existsSync('/local/d/big.placeholder')).toBe(true);
    });
  });
});
