import * as vscode from 'vscode';
import { COMMAND_FORGET_SECRET } from '../constants';
import { getActiveTextEditor, showInformationMessage } from '../host';
import { getFileService } from '../modules/serviceManager';
import {
  SecretKind,
  describeTarget,
  forgetSecret,
  secretTargetFrom,
} from '../modules/secretStore';
import { checkCommand } from './abstract/createCommand';

export default checkCommand({
  id: COMMAND_FORGET_SECRET,

  async handleCommand() {
    const editor = getActiveTextEditor();
    const service = editor && getFileService(editor.document.uri);
    if (!service) {
      showInformationMessage('Open a file in the SFTP project whose secret you want to forget.');
      return;
    }

    let target;
    try {
      target = secretTargetFrom(service.getConfig() as any);
    } catch (err: any) {
      showInformationMessage(`Config error: ${err.message ?? err}`);
      return;
    }

    const kindPick = await vscode.window.showQuickPick(
      [
        { label: 'Password', value: 'password' as SecretKind },
        { label: 'Key passphrase', value: 'passphrase' as SecretKind },
        { label: 'Both', value: 'both' as const },
      ],
      { placeHolder: `Forget stored secret for ${describeTarget(target)}` }
    );
    if (!kindPick) return;

    if (kindPick.value === 'both' || kindPick.value === 'password') {
      await forgetSecret('password', target);
    }
    if (kindPick.value === 'both' || kindPick.value === 'passphrase') {
      await forgetSecret('passphrase', target);
    }
    showInformationMessage(`Forgot stored secret(s) for ${describeTarget(target)}.`);
  },
});
