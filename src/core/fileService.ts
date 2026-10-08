import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as sshConfig from 'ssh-config';
import app from '../app';
import logger from '../logger';
import * as os from 'os';
import { getUserSetting } from '../host';
import { replaceHomePath, resolvePath } from '../helper';
import { EXTENSION_NAME, IGNORE_FILENAME, SETTING_KEY_REMOTE } from '../constants';
import upath from './upath';
import Ignore from './ignore';
import { FileSystem } from './fs';
import Scheduler from './scheduler';
import { createRemoteIfNoneExist, removeRemoteFs } from './remoteFs';
import TransferTask from './transferTask';
import localFs from './localFs';
import {
  PlaceholderConfig,
  DEFAULT_PLACEHOLDER_DIRECTORY_SIZE,
  DEFAULT_PLACEHOLDER_FILE_SIZE,
  DEFAULT_PLACEHOLDER_SUFFIX,
  createPlaceholderOption,
  isPlaceholderPath,
  parseSize,
} from './placeholder';

type Omit<T, U> = Pick<T, Exclude<keyof T, U>>;

interface Root {
  name: string;
  context: string;
  watcher: WatcherConfig;
  defaultProfile: string;
}

interface Host {
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
  connectTimeout: number;
}

interface ServiceOption {
  protocol: string;
  remote?: string;
  uploadOnSave: boolean;
  useTempFile: boolean;
  openSsh: boolean;
  downloadOnOpen: boolean | 'confirm';
  filePerm?: number;
  dirPerm?: number;
  syncOption: {
    delete: boolean;
    skipCreate: boolean;
    ignoreExisting: boolean;
    update: boolean;
  };
  ignore: string[];
  ignoreFile: string;
  remoteExplorer: {
    filesExclude?: string[];
    order: number;
  };
  remoteTimeOffsetInHours: number;
  limitOpenFilesOnRemote: number | true;
  placeholder?: PlaceholderConfig;
}

interface WatcherConfig {
  files: false | string;
  autoUpload: boolean;
  autoDelete: boolean;
}

interface SftpOption {
  // sftp
  agent?: string;
  privateKeyPath?: string;
  passphrase: string | true;
  interactiveAuth: boolean | string[];
  algorithms: any;
  sshConfigPath?: string;
  concurrency: number;
  sshCustomParams?: string;
  hop: (Host & SftpOption)[] | (Host & SftpOption);
}

interface FtpOption {
  secure: boolean | 'control' | 'implicit';
  secureOptions: any;
}

export interface FileServiceConfig
  extends Root,
    Host,
    ServiceOption,
    SftpOption,
    FtpOption {
  profiles?: {
    [x: string]: FileServiceConfig;
  };
}

export interface ServiceConfig
  extends Root,
    Host,
    Omit<ServiceOption, 'ignore'>,
    SftpOption,
    FtpOption {
  ignore?: ((fsPath: string) => boolean) | null;
}

export interface WatcherService {
  create(watcherBase: string, watcherConfig: WatcherConfig): any;
  dispose(watcherBase: string): void;
}

interface TransferScheduler {
  // readonly _scheduler: Scheduler;
  size: number;
  add(x: TransferTask): void;
  run(): Promise<void>;
  stop(): void;
}

type ConfigValidator = (x: any) => { message: string };

const DEFAULT_SSHCONFIG_FILE = '~/.ssh/config';

function filesIgnoredFromConfig(config: FileServiceConfig): string[] {
  const cache = app.fsCache;
  const ignore: string[] =
    config.ignore && config.ignore.length ? config.ignore : [];

  const ignoreFile = config.ignoreFile;
  if (!ignoreFile) {
    return ignore;
  }

  let ignoreFromFile;
  if (cache.has(ignoreFile)) {
    ignoreFromFile = cache.get(ignoreFile);
  } else if (fs.existsSync(ignoreFile)) {
    ignoreFromFile = fs.readFileSync(ignoreFile).toString();
    cache.set(ignoreFile, ignoreFromFile);
  } else {
    throw new Error(
      `File ${ignoreFile} not found. Check your config of "ignoreFile"`
    );
  }

  return ignore.concat(ignoreFromFile.split(/\r?\n/g));
}

function getHostInfo(config) {
  const ignoreOptions = [
    'name',
    'remotePath',
    'uploadOnSave',
    'useTempFile',
    'openSsh',
    'downloadOnOpen',
    'ignore',
    'ignoreFile',
    'watcher',
    'concurrency',
    'syncOption',
    'sshConfigPath',
    'placeholder',
  ];

  return Object.keys(config).reduce((obj, key) => {
    if (ignoreOptions.indexOf(key) === -1) {
      obj[key] = config[key];
    }
    return obj;
  }, {});
}

function chooseDefaultPort(protocol) {
  return protocol === 'ftp' ? 21 : 22;
}

function setConfigValue(config, key, value) {
  if (config[key] === undefined) {
    if (key === 'port') {
      config[key] = parseInt(value, 10);
    } else {
      config[key] = value;
    }
  }
}

function mergeConfigWithExternalRefer(
  config: FileServiceConfig
): FileServiceConfig {
  const copyed = Object.assign({}, config);

  if (config.remote) {
    const remoteMap = getUserSetting(SETTING_KEY_REMOTE);
    const remote = remoteMap.get<Record<string, any>>(config.remote);
    if (!remote) {
      throw new Error(`Can\'t not find remote "${config.remote}"`);
    }
    const remoteKeyMapping = new Map([['scheme', 'protocol']]);

    const remoteKeyIgnored = new Map([['rootPath', 1]]);

    Object.keys(remote).forEach(key => {
      if (remoteKeyIgnored.has(key)) {
        return;
      }

      const targetKey = remoteKeyMapping.has(key)
        ? remoteKeyMapping.get(key)
        : key;
      setConfigValue(copyed, targetKey, remote[key]);
    });
  }

  if (config.protocol !== 'sftp') {
    return copyed;
  }

  const sshConfigPath = replaceHomePath(
    config.sshConfigPath || DEFAULT_SSHCONFIG_FILE
  );

  const cache = app.fsCache;
  let sshConfigContent;
  if (cache.has(sshConfigPath)) {
    sshConfigContent = cache.get(sshConfigPath);
  } else {
    try {
      sshConfigContent = fs.readFileSync(sshConfigPath, 'utf8');
    } catch (error) {
      logger.warn(error.message, `load ${sshConfigPath} failed`);
      sshConfigContent = '';
    }
    cache.set(sshConfigPath, sshConfigContent);
  }

  if (!sshConfigContent) {
    return copyed;
  }

  const parsedSSHConfig = sshConfig.parse(sshConfigContent);
  const section = parsedSSHConfig.find({
    Host: copyed.host,
  });

  if (section === null) {
    return copyed;
  }

  const mapping = new Map([
    ['hostname', 'host'],
    ['port', 'port'],
    ['user', 'username'],
    ['identityfile', 'privateKeyPath'],
    ['serveraliveinterval', 'keepalive'],
    ['connecttimeout', 'connTimeout'],
  ]);

  section.config.forEach(line => {
    if (!line.param) {
      return;
    }

    const key = mapping.get(line.param.toLowerCase());

    if (key !== undefined) {
      if (key === 'host') {
        copyed[key] = line.value;
      } else {
        setConfigValue(copyed, key, line.value);
      }
    }
  });

  // Bug introduced in pull request #69 : Fix ssh config resolution
  /* const parsedSSHConfig = sshConfig.parse(sshConfigContent);
  const computed = parsedSSHConfig.compute(copyed.host);

  const mapping = new Map([
    ['hostname', 'host'],
    ['port', 'port'],
    ['user', 'username'],
    ['serveraliveinterval', 'keepalive'],
    ['connecttimeout', 'connTimeout'],
  ]);

  Object.entries<any>(computed).forEach(([param, value]) => {
    if (param.toLowerCase() === 'identityfile') {
      setConfigValue(copyed, 'privateKeyPath', value[0]);
      return;
    }

    const key = mapping.get(param.toLowerCase());

    if (key !== undefined) {
      // don't need consider config priority, always set to the resolve host.
      if (key === 'host') {
        copyed[key] = value;
      } else {
        setConfigValue(copyed, key, value);
      }
    }
  }); */

  return copyed;
}

// The account VS Code is running as - the username assumed when a config (and
// any ssh_config / remotefs.remote it resolves through) names none.
function currentOSUsername(): string {
  try {
    return os.userInfo().username || '';
  } catch {
    return '';
  }
}

// Maps the friendly `sftp.defaultDownloadOnOpen` enum to the value the
// `downloadOnOpen` config field expects.
function normalizeDownloadOnOpen(value: any): boolean | 'confirm' {
  if (value === 'confirm') return 'confirm';
  if (value === 'always' || value === true) return true;
  return false;
}

// Fill the fields that are backed by a `sftp.default*` VS Code setting, but only
// where the config (file + profile + remote) left them unset. Read live from
// settings on every config resolution, so changing a setting takes effect on the
// next transfer without reloading.
function applySettingDefaults(config: any): void {
  const setting = getUserSetting(EXTENSION_NAME);
  const fillIfUnset = (key: string, value: any) => {
    if (config[key] === undefined) {
      config[key] = value;
    }
  };

  fillIfUnset('protocol', setting.get<string>('defaultProtocol', 'sftp'));
  fillIfUnset('uploadOnSave', setting.get<boolean>('defaultUploadOnSave', false));
  fillIfUnset('useTempFile', setting.get<boolean>('defaultUseTempFile', false));
  fillIfUnset(
    'downloadOnOpen',
    normalizeDownloadOnOpen(setting.get<string>('defaultDownloadOnOpen', 'never'))
  );
  fillIfUnset('connectTimeout', setting.get<number>('defaultConnectTimeout', 10000));
  fillIfUnset('interactiveAuth', setting.get<boolean>('defaultInteractiveAuth', false));
  fillIfUnset('concurrency', setting.get<number>('defaultConcurrency', 4));

  // field-by-field: a config may override just one of the three
  const placeholderDefaults = {
    fileSize: setting.get<string>('defaultPlaceholderFileSize', DEFAULT_PLACEHOLDER_FILE_SIZE),
    directorySize: setting.get<string>('defaultPlaceholderDirectorySize', DEFAULT_PLACEHOLDER_DIRECTORY_SIZE),
    suffix: setting.get<string>('defaultPlaceholderSuffix', DEFAULT_PLACEHOLDER_SUFFIX),
  };
  for (const key of ['fileSize', 'directorySize']) {
    if (parseSize(placeholderDefaults[key]) === undefined) {
      logger.warn(`sftp.defaultPlaceholder* setting "${key}" is not a valid size (${placeholderDefaults[key]}); ignoring it.`);
      placeholderDefaults[key] = '';
    }
  }
  config.placeholder = { ...placeholderDefaults, ...config.placeholder };
}

function configHasExplicitAuth(config: any): boolean {
  return (
    // tslint:disable-next-line triple-equals
    config.password != undefined ||
    // tslint:disable-next-line triple-equals
    config.agent != undefined ||
    // tslint:disable-next-line triple-equals
    config.privateKeyPath != undefined ||
    // tslint:disable-next-line triple-equals
    config.passphrase != undefined ||
    config.interactiveAuth === true ||
    (Array.isArray(config.interactiveAuth) && config.interactiveAuth.length > 0)
  );
}

// When an sftp config specifies no authentication of its own, fall back to the
// method chosen in `sftp.defaultAuthMethod` (default: "agent"). Only touches
// sftp configs, and never overrides a config that already declares any auth.
function applyDefaultAuthMethod(config: any): void {
  // tslint:disable-next-line triple-equals
  if (config.protocol != undefined && config.protocol !== 'sftp') {
    return;
  }
  if (configHasExplicitAuth(config)) {
    return;
  }

  const setting = getUserSetting(EXTENSION_NAME);
  const method = setting.get<string>('defaultAuthMethod', 'agent');

  if (method === 'agent') {
    let socket = (setting.get<string>('defaultAgentSocket', '$SSH_AUTH_SOCK') || '$SSH_AUTH_SOCK').trim();
    if (socket.startsWith('$')) {
      const envValue = process.env[socket.slice(1)];
      if (!envValue) {
        logger.warn(
          `sftp.defaultAuthMethod is "agent" but ${socket} is not set; ` +
            `falling back to a password prompt for ${config.host}.`
        );
        return;
      }
      config.agent = envValue;
    } else {
      // e.g. an absolute socket path, or "pageant" on Windows
      config.agent = socket;
    }
  } else if (method === 'key') {
    const keyPath = (setting.get<string>('defaultPrivateKeyPath', '') || '').trim();
    if (keyPath) {
      config.privateKeyPath = keyPath;
    } else {
      logger.warn(
        'sftp.defaultAuthMethod is "key" but sftp.defaultPrivateKeyPath is empty; ' +
          `falling back to a password prompt for ${config.host}.`
      );
    }
  } else if (method === 'interactive') {
    config.interactiveAuth = true;
  }
  // method === 'password' (or anything else): leave auth unset so the remote
  // client prompts for a password.
}

function getCompleteConfig(
  config: FileServiceConfig,
  workspace: string
): FileServiceConfig {
  // Work on a copy: `config` may be the FileService's stored `_config` (when it
  // has no profiles), and the setting-backed defaults are resolved fresh on
  // every call so a settings change takes effect without reloading.
  const withDefaults = { ...config } as FileServiceConfig;
  applySettingDefaults(withDefaults);

  const mergedConfig = mergeConfigWithExternalRefer(withDefaults);

  // tslint:disable-next-line triple-equals
  if (mergedConfig.username == undefined || mergedConfig.username === '') {
    mergedConfig.username = currentOSUsername();
  }

  applyDefaultAuthMethod(mergedConfig);

  if (mergedConfig.agent && mergedConfig.privateKeyPath) {
    logger.warn(
      'Config Option Conflicted. You are specifing "agent" and "privateKey" at the same time, ' +
        'the later will be ignored.'
    );
  }

  // remove the './' part from a relative path
  mergedConfig.remotePath = upath.normalize(mergedConfig.remotePath);
  if (mergedConfig.privateKeyPath) {
    mergedConfig.privateKeyPath = resolvePath(
      workspace,
      mergedConfig.privateKeyPath
    );
  }

  if (mergedConfig.ignoreFile) {
    mergedConfig.ignoreFile = resolvePath(workspace, mergedConfig.ignoreFile);
  }

  // convert ingore config to ignore function
  if (mergedConfig.agent && mergedConfig.agent.startsWith('$')) {
    const evnVarName = mergedConfig.agent.slice(1);
    const val = process.env[evnVarName];
    if (!val) {
      throw new Error(`Environment variable "${evnVarName}" not found`);
    }
    mergedConfig.agent = val;
  }

  return mergedConfig;
}

function mergeProfile(
  target: FileServiceConfig,
  source: FileServiceConfig
): FileServiceConfig {
  const res = Object.assign({}, target);
  delete res.profiles;

  const keys = Object.keys(source);
  for (const key of keys) {
    if (key === 'ignore') {
      res.ignore = res.ignore.concat(source.ignore);
    } else if (key === 'placeholder') {
      res.placeholder = { ...res.placeholder, ...source.placeholder };
    } else {
      res[key] = source[key];
    }
  }

  return res;
}

enum Event {
  BEFORE_TRANSFER = 'BEFORE_TRANSFER',
  AFTER_TRANSFER = 'AFTER_TRANSFER',
}

let id = 0;

export default class FileService {
  private _eventEmitter: EventEmitter = new EventEmitter();
  private _name: string;
  private _watcherConfig: WatcherConfig;
  private _profiles: string[];
  private _pendingTransferTasks: Set<TransferTask> = new Set();
  private _transferSchedulers: TransferScheduler[] = [];
  private _config: FileServiceConfig;
  private _configValidator: ConfigValidator;
  private _watcherService: WatcherService = {
    create() {
      /* do nothing  */
    },
    dispose() {
      /* do nothing  */
    },
  };
  id: number;
  baseDir: string;
  workspace: string;

  constructor(baseDir: string, workspace: string, config: FileServiceConfig) {
    this.id = ++id;
    this.workspace = workspace;
    this.baseDir = baseDir;
    this._watcherConfig = config.watcher;
    this._config = config;
    if (config.profiles) {
      this._profiles = Object.keys(config.profiles);
    }
  }

  get name(): string {
    return this._name ? this._name : '';
  }

  set name(name: string) {
    this._name = name;
  }

  setConfigValidator(configValidator: ConfigValidator) {
    this._configValidator = configValidator;
  }

  setWatcherService(watcherService: WatcherService) {
    if (this._watcherService) {
      this._disposeWatcher();
    }

    this._watcherService = watcherService;
    this._createWatcher();
  }

  getAvailableProfiles(): string[] {
    return this._profiles || [];
  }

  getDefaultProfile(): string | undefined {
    return this._config.defaultProfile;
  }

  getPendingTransferTasks(): TransferTask[] {
    return Array.from(this._pendingTransferTasks);
  }

  isTransferring() {
    return this._transferSchedulers.length > 0;
  }

  cancelTransferTasks() {
    // keep the order
    // 1, remove tasks not start
    this._transferSchedulers.forEach(transfer => transfer.stop());
    this._transferSchedulers.length = 0;

    // 2. cancel running task
    this._pendingTransferTasks.forEach(t => t.cancel());
    this._pendingTransferTasks.clear();
  }

  beforeTransfer(listener: (task: TransferTask) => void) {
    this._eventEmitter.on(Event.BEFORE_TRANSFER, listener);
  }

  afterTransfer(listener: (err: Error | null, task: TransferTask) => void) {
    this._eventEmitter.on(Event.AFTER_TRANSFER, listener);
  }

  createTransferScheduler(concurrency): TransferScheduler {
    const fileService = this;
    const scheduler = new Scheduler({
      autoStart: false,
      concurrency,
    });
    scheduler.onTaskStart(task => {
      this._pendingTransferTasks.add(task as TransferTask);
      this._eventEmitter.emit(Event.BEFORE_TRANSFER, task);
    });
    scheduler.onTaskDone((err, task) => {
      this._pendingTransferTasks.delete(task as TransferTask);
      this._eventEmitter.emit(Event.AFTER_TRANSFER, err, task);
    });

    let runningPromise: Promise<void> | null = null;
    let isStopped: boolean = false;
    const transferScheduler: TransferScheduler = {
      get size() {
        return scheduler.size;
      },
      stop() {
        isStopped = true;
        scheduler.empty();
      },
      add(task: TransferTask) {
        if (isStopped) {
          return;
        }

        scheduler.add(task);
      },
      run() {
        if (isStopped) {
          return Promise.resolve();
        }

        if (scheduler.size <= 0) {
          fileService._removeScheduler(transferScheduler);
          return Promise.resolve();
        }

        if (!runningPromise) {
          runningPromise = new Promise(resolve => {
            scheduler.onIdle(() => {
              runningPromise = null;
              fileService._removeScheduler(transferScheduler);
              resolve();
            });
            scheduler.start();
          });
        }
        return runningPromise;
      },
    };
    fileService._storeScheduler(transferScheduler);

    return transferScheduler;
  }

  getLocalFileSystem(): FileSystem {
    return localFs;
  }

  getRemoteFileSystem(config: ServiceConfig): Promise<FileSystem> {
    return createRemoteIfNoneExist(getHostInfo(config));
  }

  getConfig(useProfile = app.state.profile): ServiceConfig {
    let config = this._config;
    const hasProfile =
      config.profiles && Object.keys(config.profiles).length > 0;
    if (hasProfile && useProfile) {
      let profile = config.profiles![useProfile];
      let resolvedProfileName = useProfile;
      if (!profile && config.defaultProfile) {
        // The active profile belongs to a different (in-path) config that is
        // routed by path, not declared here. Prefer this config's own default
        // profile so it still resolves (e.g. for the remote explorer, which
        // resolves every service under the single global profile).
        profile = config.profiles![config.defaultProfile];
        resolvedProfileName = config.defaultProfile;
      }
      if (profile) {
        logger.info(`Using profile: ${resolvedProfileName}`);
        config = mergeProfile(config, profile);
      } else {
        // No matching or default profile for this config; fall back to its base
        // config instead of failing.
        logger.info(
          `Profile "${useProfile}" is not defined for this config; using its base config.`
        );
      }
    }

    const completeConfig = getCompleteConfig(config, this.workspace);
    const error =
      this._configValidator && this._configValidator(completeConfig);
    if (error) {
      let errorMsg = `Config validation fail: ${error.message}.`;
      // tslint:disable-next-line triple-equals
      if (hasProfile && app.state.profile == null) {
        errorMsg += ' You might want to set a profile first.';
      }
      throw new Error(errorMsg);
    }

    return this._resolveServiceConfig(completeConfig);
  }

  getAllConfig(): Array<ServiceConfig> {
    const profiles = this._config.profiles;
    return profiles ? Object.keys(profiles).map(p => this.getConfig(p)) : [];
  }

  dispose() {
    this._disposeWatcher();
    this._disposeFileSystem();
  }

  private _resolveServiceConfig(
    fileServiceConfig: FileServiceConfig
  ): ServiceConfig {
    const serviceConfig: ServiceConfig = fileServiceConfig as any;

    if (serviceConfig.port === undefined) {
      serviceConfig.port = chooseDefaultPort(serviceConfig.protocol);
    }
    if (serviceConfig.protocol === 'ftp') {
      serviceConfig.concurrency = 1;
    }
    this._resolveIgnore(serviceConfig);
    serviceConfig.ignore = this._createIgnoreFn(fileServiceConfig);

    return serviceConfig;
  }

  // Decide where this service's ignore list comes from when the config itself
  // says nothing. First match wins - the sources are NOT merged:
  //   1. `ignoreFile` / a non-empty `ignore` in the config  -> left untouched
  //   2. a `.sftpignore` file next to the config (this.baseDir)  -> used as ignoreFile
  //   3. the central `sftp.defaultIgnore` setting  -> used as the ignore list
  private _resolveIgnore(config: any): void {
    const hasOwnIgnore =
      Boolean(config.ignoreFile) ||
      (Array.isArray(config.ignore) && config.ignore.length > 0);
    if (hasOwnIgnore) {
      return;
    }

    const localIgnoreFile = path.join(this.baseDir, IGNORE_FILENAME);
    if (fs.existsSync(localIgnoreFile)) {
      config.ignoreFile = localIgnoreFile;
      logger.info(`using ignore file ${localIgnoreFile}`);
      return;
    }

    const centralIgnore = getUserSetting(EXTENSION_NAME).get<string[]>('defaultIgnore');
    if (Array.isArray(centralIgnore) && centralIgnore.length > 0) {
      config.ignore = centralIgnore.slice();
    }
  }

  private _storeScheduler(scheduler: TransferScheduler) {
    this._transferSchedulers.push(scheduler);
  }

  private _removeScheduler(scheduler: TransferScheduler) {
    const index = this._transferSchedulers.findIndex(s => s === scheduler);
    if (index !== -1) {
      this._transferSchedulers.splice(index, 1);
    }
  }

  private _createIgnoreFn(config: FileServiceConfig): ServiceConfig['ignore'] {
    const localContext = this.baseDir;
    const remoteContext = config.remotePath;

    const ignoreConfig = filesIgnoredFromConfig(config);
    // placeholder markers are local bookkeeping: never transferred or deleted remotely
    const placeholder = createPlaceholderOption(config.placeholder);
    if (ignoreConfig.length <= 0 && !placeholder) {
      return null;
    }

    const ignore = ignoreConfig.length > 0 ? Ignore.from(ignoreConfig) : null;
    const ignoreFunc = fsPath => {
      if (placeholder && isPlaceholderPath(fsPath, placeholder)) {
        return true;
      }
      if (!ignore) {
        return false;
      }

      // vscode will always return path with / as separator
      const normalizedPath = path.normalize(fsPath);
      let relativePath;
      if (normalizedPath.indexOf(localContext) === 0) {
        // local path
        relativePath = path.relative(localContext, fsPath);
      } else {
        // remote path
        relativePath = upath.relative(remoteContext, fsPath);
      }

      // skip root
      return relativePath !== '' && ignore.ignores(relativePath);
    };

    return ignoreFunc;
  }

  private _createWatcher() {
    this._watcherService.create(this.baseDir, this._watcherConfig);
  }

  private _disposeWatcher() {
    this._watcherService.dispose(this.baseDir);
  }

  // fixme: remote all profiles
  private _disposeFileSystem() {
    return removeRemoteFs(getHostInfo(this.getConfig()));
  }
}
