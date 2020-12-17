/*
 * See the top comment of DemoRecordingHelper for an explanation of what this class is responsible for.
 *
 * NOTE: YOU NO LONGER NEED TO HAVE THIS RUNNING WHEN PERFORMING DEMO PLAYBACK UNLESS THE DEMO WAS RECORDED
 * WITH A VERSION EARLIER THAN 1.1.0!!! You'll know if you need this running if you
 * notice yourself talking during demo playback but don't hear any audio.
 */

import {Config} from "../utils/Config";
import {VoicePlayerVolume} from "../utils/VoicePlayerVolume";
import {LogHelper} from "../utils/LogHelper";
import {SubscriberManager} from "../utils/SubscriberManager";
import {DemoRecordingHelper} from "./DemoRecordingHelper";

/**
 * DemoPlaybackHelper is responsible for listening to the console for messages left behind by DemoRecordingHelper.
 * For instance, a message about a player being muted might have been left behind and DemoPlaybackHelper acts on this
 * information by unmuting the player. This is just an example of its purpose and isn't actually necessary any more
 * with demos recorded after the changes made in 1.1.0.
 */
export class DemoPlaybackHelper implements ListenerService {
    private static readonly log = LogHelper.getLogger('DemoPlaybackHelper');
    // private static readonly demoPlaybackRegExp = RegExp('^Playing demo from (.*)\\.dem\\.$');
    //A message like this will be echoed right when the demo starts recording.
    private static readonly playerMutedByDemoHelperRegExp = RegExp('^DemoHelper set the volume of player (.*) to 0\\.$');
    private static readonly demoInfoRegExp = RegExp('(Error - Not currently playing back a demo\\.)|(Demo contents for (.*)\\.dem:)');

    name(): string {
        return DemoPlaybackHelper.name;
    }

    canHandle(consoleLine: string): boolean {
        return !DemoRecordingHelper.synchronouslyCheckIfRecording() &&
            DemoPlaybackHelper.playerMutedByDemoHelperRegExp.test(consoleLine);
    }

    async handleLine(consoleLine: string): Promise<void> {
        if (await DemoPlaybackHelper.currentlyPlayingADemo()) {
            if (DemoPlaybackHelper.playerMutedByDemoHelperRegExp.test(consoleLine)) {
                if (Config.getConfig().demo_playback_helper.playback_voice_player_volume === "1") {
                    const match = DemoPlaybackHelper.playerMutedByDemoHelperRegExp.exec(consoleLine);
                    if (!match)
                        throw Error('Got null match when determining player name from the message left behind in the demo.');
                    const playerName = match[1];
                    //TODO: Additional testing required to make sure this doesn't fire before the game is ready to deal with it
                    DemoPlaybackHelper.log.info(`DemoPlaybackHelper found a line indicating DemoHelper muted ${playerName} so it unmuted them.`);
                    await VoicePlayerVolume.setVoicePlayerVolumeByName(playerName, 1);
                } else {
                    DemoPlaybackHelper.log.info("DemoPlaybackHelper found a line indicating DemoHelper muted a player but demo_playback_helper.playback_voice_player_volume was set to 0 in the config file.");
                }
            }
        }
    }

    private static currentlyPlayingADemo = async (): Promise<boolean> => {
        const demoName = await DemoPlaybackHelper.getCurrentDemoName();
        return demoName.length > 0;
    }

    private static getCurrentDemoName = async (): Promise<string> => {
        const consoleLine = await SubscriberManager.searchForValue('demo_info', DemoPlaybackHelper.demoInfoRegExp, false);
        const match = DemoPlaybackHelper.demoInfoRegExp.exec(consoleLine);
        if (!match)
            throw Error(`Failed to execute RegExp on the console's response to demo_info.`);
        return match[3] ? match[3] : '';
    }
}