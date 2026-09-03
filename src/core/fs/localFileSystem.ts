import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import FileSystem, { FileEntry, FileStats, FileOption } from './fileSystem';
import logger from '../../logger';

export default class LocalFileSystem extends FileSystem {
  constructor(pathResolver: any) {
    super(pathResolver);
  }

  toFileStat(stat: fs.Stats): FileStats {
    return {
      type: FileSystem.getFileTypecharacter(stat),
      size: stat.size,
      mode: stat.mode & parseInt('777', 8), // tslint:disable-line:no-bitwise
      mtime: stat.mtime.getTime(),
      atime: stat.atime.getTime(),
    };
  }

  async lstat(filePath: string): Promise<FileStats> {
    const stat: fs.Stats = await fse.lstat(filePath);
    if (!stat.isSymbolicLink()) {
      return this.toFileStat(stat);
    }

    // Symlinks are treated as if they were native to the folder they live in:
    // resolve to the real target's type/size/mtime so they get uploaded as
    // regular content (a copied file, or a recursively-uploaded folder)
    // instead of a remote symlink pointing at a path that only makes sense
    // on this machine.
    let realStat: fs.Stats;
    try {
      realStat = await fse.stat(filePath);
    } catch (err) {
      // Broken symlink (or target unreadable): fall back to old behavior.
      return this.toFileStat(stat);
    }

    if (realStat.isDirectory() && (await this.isSymlinkLoop(filePath))) {
      logger.warn(`Symlink loop detected at "${filePath}", uploading it as a plain symlink instead of its content.`);
      return this.toFileStat(stat);
    }

    return this.toFileStat(realStat);
  }

  // Detects a symlinked directory that (transitively) points back to one of
  // its own ancestor directories, which would otherwise send folder
  // traversal into infinite recursion once symlinks are resolved as content.
  private async isSymlinkLoop(linkPath: string): Promise<boolean> {
    const realTarget = await fse.realpath(linkPath);

    let dir = path.dirname(linkPath);
    let prevDir: string | null = null;
    while (dir !== prevDir) {
      try {
        const realDir = await fse.realpath(dir);
        if (realDir === realTarget) {
          return true;
        }
      } catch (err) {
        break;
      }
      prevDir = dir;
      dir = path.dirname(dir);
    }

    return false;
  }

  readFile(path, option?): Promise<string | Buffer> {
    return new Promise((resolve, reject) => {
      fs.readFile(path, option, (err, data) => {
        if (err) {
          return reject(err);
        }

        resolve(data);
      });
    });
  }

  open(path: string, flags: string, mode?: number): Promise<number> {
    return fse.open(path, flags, mode);
  }

  close(fd: number): Promise<void> {
    return fse.close(fd);
  }

  fstat(fd: number): Promise<FileStats> {
    return fse.fstat(fd).then(stat => this.toFileStat(stat));
  }

  futimes(fd: number, atime: number, mtime: number): Promise<void> {
    return fse.futimes(fd, atime, mtime);
  }

  get(path, option?): Promise<fs.ReadStream> {
    return new Promise((resolve, reject) => {
      try {
        const stream = fs.createReadStream(path, option);
        stream.once('error', reject);
        resolve(stream);
      } catch (err) {
        reject(err);
      }
    });
  }

  async chmod(path: string, mode: number): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.chmod(path, mode, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  put(input: fs.ReadStream, path, option?: FileOption): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (option && option.fd && typeof option.fd !== 'number') {
        return reject(new Error('fd is not a number'));
      }

      const writer = fs.createWriteStream(path, option as any);
      writer.once('error', reject).once('finish', resolve); // transffered

      input.once('error', err => {
        reject(err);
        writer.end();
      });
      input.pipe(writer);
    });
  }

  readlink(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readlink(path, (err, linkString) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(linkString);
      });
    });
  }

  symlink(targetPath: string, path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.symlink(targetPath, path, null, err => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  mkdir(dir: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.mkdir(dir, err => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  ensureDir(dir: string): Promise<void> {
    return fse.ensureDir(dir);
  }

  toFileEntry(fullPath: string, stat: FileStats): FileEntry {
    return {
      fspath: fullPath,
      name: this.pathResolver.basename(fullPath),
      ...stat,
    };
  }

  list(dir: string): Promise<FileEntry[]> {
    return new Promise((resolve, reject) => {
      fs.readdir(dir, (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        const fileStatus = files.map(file => {
          const fspath = this.pathResolver.join(dir, file);
          return this.lstat(fspath).then(stat =>
            this.toFileEntry(fspath, stat)
          );
        });

        resolve(Promise.all(fileStatus));
      });
    });
  }

  unlink(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.unlink(path, err => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  }

  rmdir(path: string, recursive: boolean): Promise<void> {
    if (recursive) {
      return fse.remove(path);
    }

    return new Promise<void>((resolve, reject) => {
      fs.rmdir(path, err => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  }

  rename(srcPath: string, destPath: string): Promise<void> {
    return fse.rename(srcPath, destPath);
  }

  renameAtomic(srcPath: string, destPath: string): Promise<void> {
    return fse.rename(srcPath, destPath);
  }
}
