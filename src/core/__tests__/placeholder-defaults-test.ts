import * as fs from 'fs';
import * as path from 'path';
import {
  createPlaceholderOption,
  DEFAULT_PLACEHOLDER_DIRECTORY_SIZE,
  DEFAULT_PLACEHOLDER_FILE_SIZE,
  parseSize,
} from '../placeholder';

// The settings UI shows package.json's `default`; the code falls back to the
// constants when the setting is unreadable. If they ever differ, the UI lies.
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../package.json'), 'utf8'));
const props = pkg.contributes.configuration.properties;

describe('placeholder defaults', () => {
  test('files over 1GB are limited by default', () => {
    expect(props['sftp.defaultPlaceholderFileSize'].default).toBe(DEFAULT_PLACEHOLDER_FILE_SIZE);
    expect(parseSize(DEFAULT_PLACEHOLDER_FILE_SIZE)).toBe(1024 ** 3);
  });

  test('folders over 10GB are limited by default', () => {
    expect(props['sftp.defaultPlaceholderDirectorySize'].default).toBe(DEFAULT_PLACEHOLDER_DIRECTORY_SIZE);
    expect(parseSize(DEFAULT_PLACEHOLDER_DIRECTORY_SIZE)).toBe(10 * 1024 ** 3);
  });

  test('the default settings enable the feature', () => {
    const option = createPlaceholderOption({
      fileSize: props['sftp.defaultPlaceholderFileSize'].default,
      directorySize: props['sftp.defaultPlaceholderDirectorySize'].default,
    });
    expect(option).toBeDefined();
    expect(option!.fileSize).toBe(1024 ** 3);
    expect(option!.directorySize).toBe(10 * 1024 ** 3);
  });

  test('an empty string turns a limit off', () => {
    expect(createPlaceholderOption({ fileSize: '', directorySize: '' })).toBeUndefined();
  });

  test('every default matches the pattern the settings UI validates against', () => {
    for (const key of ['sftp.defaultPlaceholderFileSize', 'sftp.defaultPlaceholderDirectorySize']) {
      expect(new RegExp(props[key].pattern).test(props[key].default)).toBe(true);
    }
  });
});
