import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { UserService } from '../../services/user';
import { Inject } from '../../util/injector';
import { GuestApiService } from 'services/guest-api';
import { NavigationService } from 'services/navigation';
import { SceneCollectionsService } from 'services/scene-collections';
import {
  IDownloadProgress,
  OverlaysPersistenceService
} from 'services/scene-collections/overlays';
import { ScenesService } from 'services/scenes';
import { WidgetsService } from 'services/widgets';
import { Service } from 'services/stateful-service';
import {
  NotificationsService,
  ENotificationType
} from 'services/notifications';
import { JsonrpcService } from 'services/jsonrpc/jsonrpc';
import urlLib from 'url';
import electron from 'electron';

@Component({})
export default class BrowseOverlays extends Vue {
  @Inject() userService: UserService;
  @Inject() guestApiService: GuestApiService;
  @Inject() sceneCollectionsService: SceneCollectionsService;
  @Inject() navigationService: NavigationService;
  @Inject() overlaysPersistenceService: OverlaysPersistenceService;
  @Inject() widgetsService: WidgetsService;
  @Inject() scenesService: ScenesService;
  @Inject() private notificationsService: NotificationsService;
  @Inject() private jsonrpcService: JsonrpcService;

  $refs: {
    overlaysWebview: Electron.WebviewTag;
  };

  mounted() {
    this.guestApiService.exposeApi(this.$refs.overlaysWebview, {
      installOverlay: this.installOverlay,
      installWidgets: this.installWidgets
    });

    this.$refs.overlaysWebview.addEventListener('new-window', e => {
      const protocol = urlLib.parse(e.url).protocol;

      if (protocol === 'http:' || protocol === 'https:') {
        electron.remote.shell.openExternal(e.url);
      }
    });
  }

  async installOverlay(
    url: string,
    name: string,
    progressCallback?: (progress: IDownloadProgress) => void
  ) {
    const host = new urlLib.URL(url).hostname;
    const trustedHosts = ['cdn.streamlabs.com'];

    if (!trustedHosts.includes(host)) {
      console.error(`Ignoring overlay install from untrusted host: ${host}`);
      return;
    }

    await this.sceneCollectionsService.installOverlay(
      url,
      name,
      progressCallback
    );
    this.navigationService.navigate('Studio');
  }

  async installWidgets(
    urls: string[],
    progressCallback?: (progress: IDownloadProgress) => void
  ) {
    for (const url of urls) {
      const host = new urlLib.URL(url).hostname;
      const trustedHosts = ['cdn.streamlabs.com'];

      if (!trustedHosts.includes(host)) {
        console.error(`Ignoring widget install from untrusted host: ${host}`);
        return;
      }

      const path = await this.overlaysPersistenceService.downloadOverlay(
        url,
        progressCallback
      );
      await this.widgetsService.loadWidgetFile(
        path,
        this.scenesService.activeSceneId
      );
    }

    this.navigationService.navigate('Studio');

    this.notificationsService.push({
      type: ENotificationType.SUCCESS,
      lifeTime: 8000,
      showTime: false,
      message: `Widget Theme installed & activated. Click here to manage your Widget Profiles.`,
      action: this.jsonrpcService.createRequest(
        Service.getResourceId(this.navigationService),
        'navigate',
        'Dashboard',
        { subPage: 'widgetthemes' }
      )
    });
  }

  get overlaysUrl() {
    return this.userService.overlaysUrl();
  }
}
