import * as vscode from 'vscode';
import { COMMAND_SET_PROFILE } from '../constants';
import { showInformationMessage } from '../host';
import app from '../app';
import logger from '../logger';
import { getAllFileService } from '../modules/serviceManager';
import { getDiscoveredProfileNames } from '../modules/profileDiscovery';
import { checkCommand } from './abstract/createCommand';

export default checkCommand({
  id: COMMAND_SET_PROFILE,

  async handleCommand(definedProfile) {
    const profiles: Array<vscode.QuickPickItem & { value: string | null }> = [
      {
        value: null,
        label: 'UNSET',
      },
    ];

    // De-dupe by profile name across all sources (a name may be exposed by more
    // than one in-path config).
    const seen = new Set<string | null>([null]);
    const addProfile = (profile: string) => {
      if (seen.has(profile)) {
        return;
      }
      seen.add(profile);
      profiles.push({
        value: profile,
        label: app.state.profile === profile ? `${profile} (active)` : profile,
      });
    };

    getAllFileService().forEach(service => {
      service.getAvailableProfiles().forEach(addProfile);
    });
    getDiscoveredProfileNames().forEach(addProfile);

    if (profiles.length <= 1) {
      showInformationMessage('No Available Profile.');
      return;
    }

    if (definedProfile !== undefined) {
      const index = profiles.findIndex(a => a.value === definedProfile);
      if (index !== -1) {
        app.state.profile = definedProfile;
      } else {
        app.state.profile = null;
        logger.warn(`try to set a unknown profile "${definedProfile}"`);
      }
      return;
    }

    const item = await vscode.window.showQuickPick(profiles, { placeHolder: 'select a profile' });
    if (item === undefined) return;
    app.state.profile = item.value;
  },
});
