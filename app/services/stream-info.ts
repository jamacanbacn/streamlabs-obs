import { StatefulService, mutation } from 'services/stateful-service';
import { IChannelInfo, getPlatformService } from 'services/platforms';
import { UserService } from './user';
import { Inject } from 'util/injector';
import { StreamingService } from '../services/streaming';
import { TwitchService } from 'services/platforms/twitch';
import { YoutubeService } from 'services/platforms/youtube';
import { MixerService } from 'services/platforms/mixer';
import { HostsService } from 'services/hosts';
import { authorizedHeaders } from 'util/requests';


interface IStreamInfoServiceState {
  fetching: boolean;
  error: boolean;
  viewerCount: number;
  channelInfo: IChannelInfo;
}


const VIEWER_COUNT_UPDATE_INTERVAL = 60 * 1000;


/**
 * The stream info service is responsible for keeping
 * reliable, up-to-date information about the user's
 * channel and current stream in the Vuex store for
 * components to make use of.
 */
export class StreamInfoService extends StatefulService<IStreamInfoServiceState> {
  @Inject() userService: UserService;
  @Inject() streamingService: StreamingService;
  @Inject() hostsService: HostsService;

  static initialState: IStreamInfoServiceState = {
    fetching: false,
    error: false,
    viewerCount: 0,
    channelInfo: null
  };


  viewerCountInterval: number;


  init() {
    this.refreshStreamInfo();

    this.viewerCountInterval = window.setInterval(() => {
      if (this.streamingService.isStreaming) {
        const platform = getPlatformService(this.userService.platform.type);

        platform.fetchViewerCount().then(viewers => {
          this.SET_VIEWER_COUNT(viewers);
        });
      }
    }, VIEWER_COUNT_UPDATE_INTERVAL);
  }


  refreshStreamInfo(): Promise<void> {
    if (!this.userService.isLoggedIn()) return Promise.reject(null);

    this.SET_ERROR(false);
    this.SET_FETCHING(true);

    const platform = getPlatformService(this.userService.platform.type);
    return platform.fetchChannelInfo().then(info => {
      this.SET_CHANNEL_INFO(info);
      this.SET_FETCHING(false);
    }).catch(() => {
      this.SET_FETCHING(false);
      this.SET_ERROR(true);
    });
  }


  setStreamInfo(title: string, description: string, game: string): Promise<boolean> {
    const platform = getPlatformService(this.userService.platform.type);
    let promise: Promise<boolean>;

    if (platform instanceof TwitchService || MixerService) {
      promise = platform.putChannelInfo(title, game);
    }

    if (platform instanceof YoutubeService) {
      promise = platform.putChannelInfo(title, description);
    }

    return promise.then(success => {
      this.refreshStreamInfo();
      this.createGameAssociation(game);
      return success;
    }).catch(() => {
      this.refreshStreamInfo();
      return false;
    });
  }

  /**
   * Used to track in aggregate which overlays streamers are using
   * most often for which games, in order to offer a better search
   * experience in the overlay library.
   * @param game the name of the game
   */
  createGameAssociation(game: string) {
    const url = `https://${this.hostsService.overlays}/api/overlay-games-association`;

    const headers = authorizedHeaders(this.userService.apiToken);
    headers.append('Content-Type', 'application/x-www-form-urlencoded');

    const body = `game=${encodeURIComponent(game)}`;
    const request = new Request(url, { headers, body, method: 'POST' });

    // This is best effort data gathering, don't explicitly handle errors
    return fetch(request);
  }


  @mutation()
  SET_FETCHING(fetching: boolean) {
    this.state.fetching = fetching;
  }

  @mutation()
  SET_ERROR(error: boolean) {
    this.state.error = error;
  }

  @mutation()
  SET_CHANNEL_INFO(info: IChannelInfo) {
    this.state.channelInfo = info;
  }

  @mutation()
  SET_VIEWER_COUNT(viewers: number) {
    this.state.viewerCount = viewers;
  }

}
