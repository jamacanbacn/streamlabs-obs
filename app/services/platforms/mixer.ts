import { Service } from '../service';
import { StatefulService, mutation } from './../stateful-service';
import { IPlatformService, IPlatformAuth, IChannelInfo, IGame } from '.';
import { HostsService } from '../hosts';
import { SettingsService } from '../settings';
import { Inject } from '../../util/injector';
import { handleErrors, requiresToken } from '../../util/requests';
import { UserService } from '../user';
import { integer } from 'aws-sdk/clients/cloudfront';

interface IMixerServiceState {
  typeIdMap: object;
}

export class MixerService extends StatefulService<IMixerServiceState> implements IPlatformService {

  @Inject() hostsService: HostsService;
  @Inject() settingsService: SettingsService;
  @Inject() userService: UserService;

  authWindowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 800,
    height: 800,
  };

  apiBase = 'https://mixer.com/api/v1/';

  static initialState: IMixerServiceState = {
    typeIdMap: {},
  };

  @mutation()
  private ADD_GAME_MAPPING(game: string, id: integer) {
    this.state.typeIdMap[game] = id;
  }

  get authUrl() {
    const host = this.hostsService.streamlabs;
    const query = `_=${Date.now()}&skip_splash=true&external=electron&mixer&force_verify&origin=slobs`;
    return `https://${host}/slobs/login?${query}`;
  }

  get oauthToken() {
    return this.userService.platform.token;
  }

  get mixerUsername() {
    return this.userService.platform.username;
  }

  get widgetToken() {
    return this.userService.widgetToken;
  }

  get mixerId() {
    return this.userService.platform.id;
  }

  get channelId() {
    return this.userService.channelId;
  }

  getHeaders(authorized = false): Headers {
    const headers = new Headers();

    headers.append('Content-Type', 'application/json');

    if (authorized) headers.append('Authorization', `Bearer ${this.oauthToken}`);

    return headers;
  }

  setupStreamSettings(auth: IPlatformAuth) {
    this.fetchStreamKey().then(key => {
      const settings = this.settingsService.getSettingsFormData('Stream');

      settings.forEach(subCategory => {
        subCategory.parameters.forEach(parameter => {
          if (parameter.name === 'service') {
            parameter.value = 'Mixer.com - FTL';
          }

          if (parameter.name === 'key') {
            parameter.value = key;
          }
        });
      });

      this.settingsService.setSettings('Stream', settings);
    });
  }

  fetchNewToken(): Promise<void> {
    const host = this.hostsService.streamlabs;
    const url = `https://${host}/api/v5/slobs/mixer/refresh?token=${this.widgetToken}`;
    const request = new Request(url);

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(response =>
        this.userService.updatePlatformToken(response.access_token)
      );
  }

  @requiresToken()
  fetchRawChannelInfo() {
    const headers = this.getHeaders(true);
    const request = new Request(`${this.apiBase}channels/${this.mixerUsername}/details`, { headers });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(json => {
        this.userService.updatePlatformChannelId(json.id);
        return json;
      });
  }

  fetchStreamKey(): Promise<string> {
    return this.fetchRawChannelInfo().then(json => `${json.id}-${json.streamKey}`);
  }

  fetchChannelInfo(): Promise<IChannelInfo> {
    return this.fetchRawChannelInfo().then(json => {
      let gameTitle = '';

      if (json.type && json.type.name) {
        gameTitle = json.type.name;
      }

      return {
        title: json.name,
        game: gameTitle
      };
    });
  }

  @requiresToken()
  fetchViewerCount(): Promise<number> {
    const headers = this.getHeaders();
    const request = new Request(`${this.apiBase}channels/${this.mixerUsername}`, { headers });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(json => json.viewersCurrent);
  }

  @requiresToken()
  putChannelInfo(streamTitle: string, streamGame: string): Promise<boolean> {
    const headers = this.getHeaders(true);
    const data = { name: streamTitle };

    if (this.state.typeIdMap[streamGame]) {
      data['typeId'] = this.state.typeIdMap[streamGame];
    }

    const request = new Request(`${this.apiBase}channels/${this.channelId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });

    return fetch(request)
      .then(handleErrors)
      .then(() => true);
  }

  @requiresToken()
  searchGames(searchString: string): Promise<IGame[]> {
    const headers = this.getHeaders();
    const request = new Request(`${this.apiBase}types?limit=10&noCount=1&scope=all&query=${searchString}`, { headers });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(response => {
        response.forEach((game: any) => {
          this.ADD_GAME_MAPPING(game.name, game.id);
        });
        return response;
      });
  }

  getChatUrl(mode: string): Promise<string> {
    return new Promise((resolve) => {
      this.fetchRawChannelInfo()
        .then(json => {
          resolve(`https://mixer.com/embed/chat/${json.id}`);
        });
    });
  }
}
