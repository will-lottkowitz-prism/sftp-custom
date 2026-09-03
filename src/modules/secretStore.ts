import * as vscode from 'vscode';

// Stores SFTP/FTP passwords and key passphrases in VS Code's SecretStorage
// (OS keychain) instead of plaintext in `.sftp.json`. Keyed by the connection
// target so the same secret is reused across every config that points at it.

export type SecretKind = 'password' | 'passphrase';

export interface SecretTarget {
  protocol?: string;
  host?: string;
  port?: number;
  username?: string;
}

let storage: vscode.SecretStorage | undefined;

export function initSecretStore(context: vscode.ExtensionContext): void {
  storage = context.secrets;
}

export function secretTargetFrom(config: SecretTarget): SecretTarget {
  return {
    protocol: config.protocol || 'sftp',
    host: config.host,
    port: config.port,
    username: config.username,
  };
}

function keyFor(kind: SecretKind, t: SecretTarget): string {
  return `sftp:${kind}:${t.protocol || 'sftp'}://${t.username || ''}@${t.host || ''}:${t.port || ''}`;
}

export function describeTarget(t: SecretTarget): string {
  return `${t.username || '?'}@${t.host || '?'}:${t.port || '?'}`;
}

export async function getStoredSecret(
  kind: SecretKind,
  t: SecretTarget
): Promise<string | undefined> {
  if (!storage || !t.host) return undefined;
  return storage.get(keyFor(kind, t));
}

export async function storeSecret(
  kind: SecretKind,
  t: SecretTarget,
  value: string
): Promise<void> {
  if (!storage) return;
  await storage.store(keyFor(kind, t), value);
}

export async function forgetSecret(kind: SecretKind, t: SecretTarget): Promise<void> {
  if (!storage) return;
  await storage.delete(keyFor(kind, t));
}
