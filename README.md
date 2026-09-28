# sftp sync extension for VS Code

> **xQx fork.** Maintained by Will Lotto ([xQx](https://github.com/will-lottkowitz-prism)) and
> published to the VS Code Marketplace as `xQx.sftp-custom`. Forked from
> [Natizyskunk/vscode-sftp](https://github.com/Natizyskunk/vscode-sftp) (MIT) — itself a fork of
> [liximomo/vscode-sftp](https://github.com/liximomo/vscode-sftp). All prior work and credit remain
> with those authors; this fork exists to carry xQx-specific changes and stay independently
> installable.
>
> Issues and pull requests for this fork:
> <https://github.com/will-lottkowitz-prism/sftp-custom>
>
> **Fork changes:** shared defaults in VS Code Settings + tiny per-folder
> `.sftp.json` files, `.sftpignore`, `username` optional, SSH-agent auth by
> default, passwords in SecretStorage. See
> [xQx fork — shared defaults & minimal configs](#xqx-fork--shared-defaults--minimal-configs).

Upstream lineage: new maintained and updated version by [@Natizyskunk](https://github.com/Natizyskunk/) 😀 <!-- and [@satiromarra](https://github.com/satiromarra) --> <br>
(Forked from the no longer maintained [liximomo's SFTP plugin](https://github.com/liximomo/vscode-sftp.git))

- VS Code marketplace : https://marketplace.visualstudio.com/items?itemName=Natizyskunk.sftp <br>
- VSIX release : https://github.com/Natizyskunk/vscode-sftp/releases/

✳ I would be more than happy to have you participate in one way or another to this project. You can do so by simply following the [templates](https://github.com/Natizyskunk/vscode-sftp/issues/new/choose) when you open a new issue or a new pull request.

## ℹ INFOS - 2025/03/13
I've tried to keep this extension up-to-date as much as I can and added a lot of new relevant features. Saddly, for the last year and a half I wasn't really able to work on the project because of personal reasons and I'm really not sure if and when I'll be able to get more time to work on it again. So for now consider the [v1.16.3](https://github.com/Natizyskunk/vscode-sftp/releases/tag/v1.16.3) as the latest official stable release available.

## ℹ INFOS - 2023/06/23
This is the main repository for the SFTP extension since [@liximomo](https://github.com/liximomo) has set his own to deprecated in favor of this one in the VSCode marketplace.
There are also other forks that are available. Feel free to try them.

A lot of work as been brought to fix bugs, add new features and more than 50 updates have been released with a lot of improvements and stability fixes for almost two years now. 😎

I've been working hard to fix a lot of things and I've updated more than 50 new releases with a lot of improvements and stability fixes and I've brought new features for almost three years now. 

---

VSCode-SFTP enables you to add, edit or delete files within a local directory and have it sync to a remote server directory using different transfer protocols like FTP or SSH. The most basic setup requires only a few lines of configuration with a wide array of specific settings also available to meet the needs of any user. Both powerful and fast, it helps developers save time by allowing the use of a familiar editor and environment.

- Features
  - [Browser remote with Remote Explorer](#remote-explorer)
  - Diff local and remote
  - Sync directory
  - Upload/Download
  - Upload on save
  - File Watcher
  - Multiple configurations
  - Switchable profiles
  - Temp File support
- [Commands](https://github.com/Natizyskunk/vscode-sftp/wiki/Commands)
- [Debug](#debug)
- [FAQ](#FAQ)

## Installation

### Method 1 (Recommended : Auto update)
1. Select Extensions (Ctrl + Shift + X).
2. Uninstall current sftp extension from @liximomo.
3. Install new extension directly from VS Code Marketplace : https://marketplace.visualstudio.com/items?itemName=Natizyskunk.sftp.
4. Voilà!

### Method 2 (Manual update)
To install just follow these steps from within VSCode:
1. Select Extensions (Ctrl + Shift + X).
2. Uninstall current sftp extension from @liximomo.
3. Open "More Action" menu(ellipsis on the top) and click "Install from VSIX…".
4. Locate VSIX file and select.
5. Reload VSCode.
6. Voilà!

## Documentation
- [Home](https://github.com/Natizyskunk/vscode-sftp/wiki)
- [Settings](https://github.com/Natizyskunk/vscode-sftp/wiki/Setting)
- [Common configuration](https://github.com/Natizyskunk/vscode-sftp/wiki/Common-Configuration)
- [SFTP configuration](https://github.com/Natizyskunk/vscode-sftp/wiki/SFTP-only-Configuration)
- [FTP confriguration](https://github.com/Natizyskunk/vscode-sftp/wiki/FTP(s)-only-Configuration)
- [Commands](https://github.com/Natizyskunk/vscode-sftp/wiki/Commands)

## Usage
If the latest files are already on a remote server, you can start with an empty local folder,
then download your project, and from that point sync.

1. In `VS Code`, open a local directory you wish to sync to the remote server (or create an empty directory
that you wish to first download the contents of a remote server folder in order to edit locally).
2. `Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on Mac open command palette, run `SFTP: config` command.
3. A basic configuration file will appear named `sftp.json` under the `.vscode` directory, open and edit the configuration parameters with your remote server information.

For instance:
```json
{
    "name": "Profile Name",
    "host": "name_of_remote_host",
    "protocol": "ftp",
    "port": 21,
    "secure": true,
    "username": "username",
    "remotePath": "/public_html/project", // <--- This is the path which will be downloaded if you "Download Project"
    "password": "password",
    "uploadOnSave": false
}
```
The password parameter in `sftp.json` is optional, if left out you will be prompted for a password on sync.
_Note：_ backslashes and other special characters must be escaped with a backslash.

4. Save and close the `sftp.json` file.
5. `Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on Mac open command palette.
6. Type `sftp` and you'll now see a number of other commands. You can also access many of the commands from the project's file explorer context menus.
7. A good one to start with if you want to sync with a remote folder is `SFTP: Download Project`.  This will download the directory shown in the `remotePath` setting in `sftp.json` to your local open directory.
8. Done - you can now edit locally and after each save it will upload to sync your remote file with the local copy.
9. Enjoy!

For detailed explanations please go to [wiki](https://github.com/Natizyskunk/vscode-sftp/wiki).

## Example configurations
You can see the full list of configuration options [here](https://github.com/Natizyskunk/vscode-sftp/wiki/configuration).

- [sftp sync extension for VS Code](#sftp-sync-extension-for-vs-code)
  - [Installation](#installation)
    - [Method 1 (Recommended : Auto update)](#method-1-recommended--auto-update)
    - [Method 2 (Manual update)](#method-2-manual-update)
  - [Documentation](#documentation)
  - [Usage](#usage)
  - [Example configurations](#example-configurations)
    - [Simple](#simple)
    - [Profiles](#profiles)
    - [Multiple Context](#multiple-context)
    - [Connection Hopping](#connection-hopping)
      - [Single Hop](#single-hop)
      - [Multiple Hop](#multiple-hop)
    - [Configuration in User Setting](#configuration-in-user-setting)
  - [xQx fork — shared defaults \& minimal configs](#xqx-fork--shared-defaults--minimal-configs)
    - [How a server config is resolved](#how-a-server-config-is-resolved)
    - [Two kinds of config file](#two-kinds-of-config-file)
    - [`username` is optional](#username-is-optional)
    - [Authentication defaults](#authentication-defaults)
    - [Behavior defaults](#behavior-defaults)
    - [Ignore list](#ignore-list)
  - [Remote Explorer](#remote-explorer)
    - [Multiple Select](#multiple-select)
    - [Order](#order)
  - [Debug](#debug)
  - [FAQ](#faq)
  - [Donation](#donation)
    - [Buy Me a Coffee](#buy-me-a-coffee)
    - [PayPal](#paypal)

### Simple
```json
{
  "host": "host",
  "remotePath": "/remote/workspace"
}
```

In this fork `username` defaults to the account VS Code is running as and
authentication defaults to your **SSH agent**, so on a typical workstation a
server config is just `host` + `remotePath`. Everything else comes from the
`SFTP` section of VS Code Settings — see
[Shared defaults & minimal configs](#xqx-fork--shared-defaults--minimal-configs).

### Profiles
```json
{
  "username": "username",
  "password": "password",
  "remotePath": "/remote/workspace/a",
  "watcher": {
    "files": "dist/*.{js,css}",
    "autoUpload": false,
    "autoDelete": false
  },
  "profiles": {
    "dev": {
      "host": "dev-host",
      "remotePath": "/dev",
      "uploadOnSave": true
    },
    "prod": {
      "host": "prod-host",
      "remotePath": "/prod"
    }
  },
  "defaultProfile": "dev"
}
```

_Note：_ `context` and `watcher` are only available at root level.

Use `SFTP: Set Profile` to switch profile.

### Multiple Context
The context must **not be same**.
```json
[
  {
    "name": "server1",
    "context": "project/build",
    "host": "host",
    "username": "username",
    "password": "password",
    "remotePath": "/remote/project/build"
  },
  {
    "name": "server2",
    "context": "project/src",
    "host": "host",
    "username": "username",
    "password": "password",
    "remotePath": "/remote/project/src"
  }
]
```

_Note：_ `name` is required in this mode.

### Connection Hopping
You can connect to a target server through a proxy with ssh protocol.

_Note：_ Variable substitution is not working in a hop configuration.

#### Single Hop
local -> hop -> target
```json
{
  "name": "target",
  "remotePath": "/path/in/target",

  // hop
  "host": "hopHost",
  "username": "hopUsername",
  "privateKeyPath": "/Users/localUser/.ssh/id_rsa", // <-- The key file is assumed on the local.

  "hop": {
    // target
    "host": "targetHost",
    "username": "targetUsername",
    "privateKeyPath": "/Users/hopUser/.ssh/id_rsa", // <-- The key file is assumed on the hop.
  }
}
```

#### Multiple Hop
local -> hopa -> hopb -> target
```json
{
  "name": "target",
  "remotePath": "/path/in/target",

  // hopa
  "host": "hopAHost",
  "username": "hopAUsername",
  "privateKeyPath": "/Users/hopAUsername/.ssh/id_rsa" // <-- The key file is assumed on the local.

  "hop": [
    // hopb
    {
      "host": "hopBHost",
      "username": "hopBUsername",
      "privateKeyPath": "/Users/hopaUser/.ssh/id_rsa" // <-- The key file is assumed on the hopa.
    },

    // target
    {
      "host": "targetHost",
      "username": "targetUsername",
      "privateKeyPath": "/Users/hopbUser/.ssh/id_rsa", // <-- The key file is assumed on the hopb.
    }
  ]
}
```

### Configuration in User Setting
You can use `remote` to tell sftp to get the configuration from [remote-fs](https://github.com/liximomo/vscode-remote-fs).

In User Setting:
```json
"remotefs.remote": {
  "dev": {
    "scheme": "sftp",
    "host": "host",
    "username": "username",
    "rootPath": "/path/to/somewhere"
  },
  "projectX": {
    "scheme": "sftp",
    "host": "host",
    "username": "username",
    "privateKeyPath": "/Users/xx/.ssh/id_rsa",
    "rootPath": "/home/foo/some/projectx"
  }
}
```

In sftp.json:
```json
{
  "remote": "dev",
  "remotePath": "/home/xx/",
  "uploadOnSave": false,
  "ignore": [".vscode", ".git", ".DS_Store"]
}
```

## xQx fork — shared defaults & minimal configs

This fork is built around keeping each server config as small as possible —
ideally just **host**, **remotePath** and (sometimes) **username** — and moving
everything that's the same across servers into one place: the **`SFTP` section
of VS Code Settings** (`Ctrl/Cmd+,` → search "sftp", or edit `settings.json` /
your `*.code-workspace`).

### How a server config is resolved

When SFTP needs the settings for a server it builds them up in this order, each
layer filling gaps left by the one before it:

1. **built-in defaults** – `remotePath: "./"`, `port: 22` (sftp) / `21` (ftp), …
2. **`sftp.default*` settings** – the values described below
3. **`~/.ssh/config`** – if the config's `host` matches a `Host` block, its
   `HostName`, `Port`, `User` and `IdentityFile` are pulled in (sftp only)
4. **`remotefs.remote`** – if the config has `"remote": "name"`, that entry is
   merged in (see [Configuration in User Setting](#configuration-in-user-setting))
5. **the `.sftp.json` file itself** – always wins
6. **the active profile** inside that file, if any – wins over the file's base

So a value only needs to appear in the `.sftp.json` when it differs from your
global default for that field.

### Two kinds of config file

- **`.vscode/sftp.json`** – the project-root config, one per workspace folder.
  Use `SFTP: config` to create it. Supports `profiles`, `context`, `watcher`.
- **`.sftp.json`** *(in-path config, fork feature)* – a bare file dropped in
  **any subfolder**. That subfolder becomes the sync root (remote paths are
  relative to where the `.sftp.json` lives), and the file is registered as its
  own profile — named by its `"name"` field if it has one, otherwise
  **auto-named after the folder** (e.g. `servers/example-host/compose`).
  Opening any file under that folder automatically switches the active profile
  to it; `SFTP: Set Profile` lists every discovered in-path config. An in-path
  file is almost always a single server with **no `profiles` /
  `defaultProfile` wrapper** — just an optional `"name"` plus the fields that
  differ from your defaults.

### `username` is optional

If a config (and anything it resolves through in steps 3–4 above) doesn't set
`username`, SFTP uses **the account VS Code is running as**
(`os.userInfo().username`). Set `"username"` only when the remote account name
differs from your local one.

### Authentication defaults

If a config specifies **no** authentication of its own — no `agent`,
`privateKeyPath`, `password` or `interactiveAuth` — SFTP falls back to
**`sftp.defaultAuthMethod`** (default: **`agent`**). A config that sets any auth
field is used exactly as written and ignores these settings.

| Setting | Default | Meaning |
| --- | --- | --- |
| `sftp.defaultAuthMethod` | `agent` | `agent` \| `key` \| `password` \| `interactive` — how to authenticate a config that declares no auth |
| `sftp.defaultAgentSocket` | `$SSH_AUTH_SOCK` | Where the SSH agent is, when the method is `agent` |
| `sftp.defaultPrivateKeyPath` | `""` | Private key file, when the method is `key` (`~/` expands) |

**`agent`** — authenticate through your running SSH agent. `sftp.defaultAgentSocket`
tells it where to look:

- `$SSH_AUTH_SOCK` *(default)* — read that environment variable. This is the
  socket exported by `ssh-agent`, GNOME Keyring, `gpg-agent`, the 1Password /
  Bitwarden agents, a WSL agent, or an agent **forwarded over SSH** (`ssh -A`).
  Confirm it's set with `echo $SSH_AUTH_SOCK` and that your key is loaded with
  `ssh-add -l`.
- `$OTHER_VAR` — read a different environment variable.
- `pageant` — on Windows, use PuTTY's Pageant.
- an absolute path — a specific agent socket.

If the referenced variable is empty (no agent running), SFTP logs a warning to
the **SFTP** output channel and falls back to a **password prompt** rather than
failing.

**`key`** — use `sftp.defaultPrivateKeyPath` (e.g. `~/.ssh/id_ed25519`) for
every config that has no key of its own. For an encrypted key, put
`"passphrase": true` in the individual config to be prompted (or the passphrase
string itself).

**`password`** — always prompt for a password when a config has no auth.

**`interactive`** — keyboard-interactive (one-time codes / 2FA).

#### Stored passwords (SecretStorage)

You never need a `"password"` in a `.sftp.json`. When SFTP prompts for a
password or key passphrase it first checks VS Code's **SecretStorage** (the OS
keychain), and after a successful manual entry it offers to save it there.
Secrets are keyed by `protocol://user@host:port`, so one entry covers every
config pointing at that server. Manage them with **SFTP: Store Password /
Passphrase in SecretStorage** and **SFTP: Forget Stored Password / Passphrase**.
A `"password"` / `"passphrase"` in the config still wins if present.

> `sftp.defaultInteractiveAuth` is different: when `true` it *adds*
> keyboard-interactive on top of whatever else is configured (for servers that
> want a 2FA code **and** a key). `sftp.defaultAuthMethod: interactive` only
> applies when a config has no auth at all.

### Behavior defaults

Each of these fills in the matching `.sftp.json` field when the file (and its
active profile) leave it unset. They're read fresh for every transfer, so
changing a setting takes effect on the next operation without reloading.

| Setting | Field it defaults | Default | Notes |
| --- | --- | --- | --- |
| `sftp.defaultProtocol` | `protocol` | `sftp` | `sftp` or `ftp` |
| `sftp.defaultUploadOnSave` | `uploadOnSave` | `false` | Upload a file the moment it's saved |
| `sftp.defaultUseTempFile` | `useTempFile` | `false` | Upload to a temp name then rename into place (never serve a half-written file) |
| `sftp.defaultDownloadOnOpen` | `downloadOnOpen` | `never` | `never` \| `confirm` \| `always` — fetch the server copy when a file is opened |
| `sftp.defaultConnectTimeout` | `connectTimeout` | `10000` | Milliseconds to wait for a connection |
| `sftp.defaultInteractiveAuth` | `interactiveAuth` | `false` | Always offer keyboard-interactive (2FA) as well |
| `sftp.defaultConcurrency` | `concurrency` | `4` | Parallel transfers per folder/project operation (FTP is always 1) |
| `sftp.defaultPlaceholderFileSize` | `placeholder.fileSize` | _off_ | Remote files larger than this (`500MB`) are not downloaded — see [Size placeholders](#size-placeholders) |
| `sftp.defaultPlaceholderDirectorySize` | `placeholder.directorySize` | _off_ | Same for folders, by recursive total size (`2GB`) |
| `sftp.defaultPlaceholderSuffix` | `placeholder.suffix` | `.placeholder` | Marker suffix |

### Ignore list

The set of paths that are never uploaded or downloaded is resolved from the
**first** of these that applies — the sources are **not merged**:

1. `"ignoreFile"` in the config → that file (a relative path is resolved from
   the **workspace root**)
2. `"ignore": [ … ]` in the config → that list
3. a **`.sftpignore`** file (gitignore syntax) in the **same folder as the
   `.sftp.json`** — or next to `.vscode/sftp.json` — → that file
4. the **`sftp.defaultIgnore`** setting → that list

So the usual pattern is: put your common rules in `sftp.defaultIgnore`, and for
a subtree that needs different rules drop a `.sftpignore` next to its
`.sftp.json`. Because `.sftpignore` is looked up relative to the config file, an
in-path config and its ignore list stay together when you move the folder.

```
servers/example-host/compose/
├── .sftp.json        →  { "host": "example-host.lan", "remotePath": "/opt/docker/compose" }
└── .sftpignore       →  node_modules/  vendor/  .env  (overrides sftp.defaultIgnore for this tree)
```

### Size placeholders

Set a size limit and big remote files/folders are **not downloaded**. An empty
`<name>.placeholder` marker is left locally instead, so you can see it exists.

```json
{ "placeholder": { "fileSize": "500MB", "directorySize": "2GB" } }
```

(or the `sftp.defaultPlaceholder*` settings). Sizes are bytes or a string with a unit.

| Local state | What sync does |
| --- | --- |
| `big.iso.placeholder` only | Skips `big.iso` in **both** directions — never uploaded, never re-downloaded, never deleted from the remote by `syncOption.delete` |
| `big.iso` only | Syncs normally, however big |
| `big.iso` + a 0-byte marker | Deletes the marker, syncs the file |
| `big.iso` + a marker with content | Syncs the file, leaves the marker |

Only remote → local transfers create markers (uploads are never limited). To get a
placeholdered file, run **Download** on it — an explicit Download overrides that path's own
marker. Deleting the marker alone is not enough; the next sync would create it again. While
the feature is on, files ending in the suffix are never transferred. Full reference:
[`placeholder`](docs/common_configuration.md#placeholder).

### Putting it together — a minimal in-path config

`servers/example-host/compose/.sftp.json`:

```json
{
  "host": "example-host.lan",
  "remotePath": "/opt/docker/compose"
}
```

With `sftp.defaultAuthMethod: "agent"` (default) and your key in the agent,
that's a complete, working config: it connects to `example-host.lan:22` as your
local username over SFTP, syncs the `compose/` folder to `/opt/docker/compose`,
ignores whatever `sftp.defaultIgnore` (or a sibling `.sftpignore`) says, and
switches on automatically when you open a file under `compose/`.

Add fields only for what's different — a non-default `username`, a jump host, a
per-server `uploadOnSave`, and so on.

## Remote Explorer
![remote-explorer-preview](https://raw.githubusercontent.com/Natizyskunk/vscode-sftp/master/assets/showcase/remote-explorer.png)

Remote Explorer lets you explore files in remote. You can open Remote Explorer by:

1. Run Command `View: Show SFTP`.
2. Click SFTP view in Activity Bar.

You can only view a file's content with Remote Explorer. Run command `SFTP: Edit in Local` to edit it in local, or set `sftp.downloadWhenOpenInRemoteExplorer: true` to make double-click download-and-edit instead of view-only.

### Multiple Select
You are able to select multiple files/folders at once on the remote server to download and upload. You can do it simply by holding down Ctrl or Shift while selecting all desired files, just like on the regular explorer view.

_Note：_ You need to manually refresh the parent folder after you **delete** a file if the explorer isn't correctly updated.

### Order
You can order the remote Explorer by adding the `remoteExplorer.order` parameter inside your `sftp.json` config file.

In sftp.json:
```json
{
  "remoteExplorer": {
    "order": 1 // <-- Default value is 0.
  }
}
```

## Debug
1. Open User Settings.
  - On Windows/Linux - `File > Preferences > Settings`
  - On macOS - `Code > Preferences > Settings`
2. Set `sftp.debug` (or the equivalent `sftp.printDebugLog`) to `true` and reload VS Code.
3. View the logs in `View > Output > sftp`.

## FAQ
You can see all the Frequently Asked Questions [here](./FAQ.md).

## Donation
If this project helped you reduce development time and you wish to contribute financially

### Buy Me a Coffee
[![Buy Me A Coffee](https://bmc-cdn.nyc3.digitaloceanspaces.com/BMC-button-images/custom_images/orange_img.png)](https://www.buymeacoffee.com/Natizyskunk)

### PayPal
<!-- [![PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=BY89QD47D7MPS&source=url) -->
[![PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif)](https://www.paypal.com/donate?business=DELD7APHHM3BC&no_recurring=0&currency_code=EUR)
[![PayPal Me](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/natanfourie)
