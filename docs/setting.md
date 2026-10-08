## Setting

There are a handful of settings available for SFTP, and they can be changed:

- On Windows/Linux: File --> Preferences --> Settings
- On macOS: Code --> Preferences --> Settings

### debug
Adds debugging output to the SFTP output panel. <br>
You can view the login in `View --> Output --> SFTP`.  Changing this requires VSCode to be reloaded.

| Key | Value | Default |
| --- | --- | --- |
| *debug* | *boolean* | *false* |

```json
{
  "name": "My Server"
}
```

### downloadWhenOpenInRemoteExplorer
Change the default behavior from `View Content` to `Edit in Local` when opening files in the Remote Explorer.

| Key | Value | Default |
| --- | --- | --- |
| *debug* | *boolean* | *false* |

```json
{
  "name": "My Server"
}
```

## Server defaults (xQx fork)

These settings supply the value for the matching `.sftp.json` / `.vscode/sftp.json`
field whenever a server config leaves it unset. They let every config shrink to
just the fields that differ from your defaults — often only `host` and
`remotePath`. See the README section
["Shared defaults & minimal configs"](../README.md#xqx-fork--shared-defaults--minimal-configs)
for the full explanation. All are under the `sftp.` prefix and edited in the
**SFTP** section of VS Code Settings.

| Key | Value | Default | Fills |
| --- | --- | --- | --- |
| `sftp.defaultProtocol` | `"sftp"` \| `"ftp"` | `"sftp"` | `protocol` |
| `sftp.defaultAuthMethod` | `"agent"` \| `"key"` \| `"password"` \| `"interactive"` | `"agent"` | auth for a config with none |
| `sftp.defaultAgentSocket` | string (`$SSH_AUTH_SOCK`, `$VAR`, `pageant`, or a path) | `"$SSH_AUTH_SOCK"` | `agent` when method is `agent` |
| `sftp.defaultPrivateKeyPath` | string (`~/` expands) | `""` | `privateKeyPath` when method is `key` |
| `sftp.defaultIgnore` | string[] (gitignore syntax) | `[".git", ".svn", ".hg", ".DS_Store", "Thumbs.db", ".vscode", ".sftp.json", ".sftpignore"]` | `ignore` (see order below) |
| `sftp.defaultUploadOnSave` | boolean | `false` | `uploadOnSave` |
| `sftp.defaultUseTempFile` | boolean | `false` | `useTempFile` |
| `sftp.defaultDownloadOnOpen` | `"never"` \| `"confirm"` \| `"always"` | `"never"` | `downloadOnOpen` |
| `sftp.defaultConnectTimeout` | number (ms) | `10000` | `connectTimeout` |
| `sftp.defaultInteractiveAuth` | boolean | `false` | `interactiveAuth` |
| `sftp.defaultConcurrency` | number | `4` | `concurrency` |
| `sftp.defaultPlaceholderFileSize` | string (bytes or `500MB`) | `"1GB"` | `placeholder.fileSize` |
| `sftp.defaultPlaceholderDirectorySize` | string (bytes or `2GB`) | `"10GB"` | `placeholder.directorySize` |
| `sftp.defaultPlaceholderSuffix` | string | `".placeholder"` | `placeholder.suffix` |

`username` is not a setting: when omitted from a config (and from any
`~/.ssh/config` / `remotefs.remote` it resolves through) it defaults to the OS
user VS Code runs as.

**Ignore resolution order** (first match wins, not merged): config `ignoreFile`
→ config `ignore` → a `.sftpignore` file beside the `.sftp.json` → `sftp.defaultIgnore`.

Changing any of these applies on the next transfer — no reload needed.
