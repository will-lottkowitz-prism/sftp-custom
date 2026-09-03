import * as vscode from 'vscode';
import { COMMAND_STORE_SECRET } from '../constants';
import { getActiveTextEditor, showInformationMessage } from '../host';
import { getFileService, getAllFileService } from '../modules/serviceManager';
import {
  SecretKind,
  SecretTarget,
  describeTarget,
  secretTargetFrom,
  storeSecret,
} from '../modules/secretStore';
import { checkCommand } from './abstract/createCommand';

async function pickTarget(): Promise<SecretTarget | undefined> {
  const editor = getActiveTextEditor();
  if (editor) {
    const service = getFileService(editor.document.uri);
    if (service) {
      try {
        return secretTargetFrom(service.getConfig() as any);
      } catch {
        /* config invalid - fall through to the picker */
      }
    }
  }

  const seen = new Set<string>();
  const items: Array<{ label: string; target: SecretTarget }> = [];
  for (const service of getAllFileService()) {
    let configs: any[] = [];
    try {
      configs = [service.getConfig(), ...service.getAllConfig()];
    } catch {
      continue;
    }
    for (const config of configs) {
      const target = secretTargetFrom(config);
      if (!target.host) continue;
      const key = describeTarget(target);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ label: key, target });
    }
  }

  if (items.length === 0) {
    showInformationMessage('No SFTP config found. Open a file in an SFTP project first.');
    return undefined;
  }
  if (items.length === 1) return items[0].target;

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Which connection is this secret for?',
  });
  return picked?.target;
}

export default checkCommand({
  id: COMMAND_STORE_SECRET,

  async handleCommand() {
    const target = await pickTarget();
    if (!target) return;

    const kindPick = await vscode.window.showQuickPick(
      [
        { label: 'Password', value: 'password' as SecretKind },
        { label: 'Key passphrase', value: 'passphrase' as SecretKind },
      ],
      { placeHolder: `Secret type for ${describeTarget(target)}` }
    );
    if (!kindPick) return;

    const value = await vscode.window.showInputBox({
      prompt: `${kindPick.label} for ${describeTarget(target)}`,
      password: true,
      ignoreFocusOut: true,
    });
    if (!value) return;

    await storeSecret(kindPick.value, target, value);
    showInformationMessage(
      `Saved ${kindPick.label.toLowerCase()} for ${describeTarget(target)} to SecretStorage.`
    );
  },
});
