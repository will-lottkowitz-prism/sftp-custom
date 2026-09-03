import { COMMAND_DISCOVER_PROFILE } from '../constants';
import { showInformationMessage } from '../host';
import app from '../app';
import { checkFileCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';

// discoverForFile already ran against the selected file/folder by the time
// createFileCommand invokes handleFile (see abstract/createCommand.ts); just
// report which profile ended up active.
export default checkFileCommand({
  id: COMMAND_DISCOVER_PROFILE,
  getFileTarget: uriFromExplorerContextOrEditorContext,

  async handleFile() {
    const profile = app.state.profile;
    showInformationMessage(
      profile ? `SFTP profile activated: ${profile}` : 'No SFTP profile found for this selection.'
    );
  },
});
