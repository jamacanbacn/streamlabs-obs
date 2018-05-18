import { StatefulService, mutation } from 'services/stateful-service';
import { OnboardingService } from 'services/onboarding';
import { HotkeysService } from 'services/hotkeys';
import { UserService } from 'services/user';
import { ShortcutsService } from 'services/shortcuts';
import { Inject } from 'util/injector';
import electron from 'electron';
import { TransitionsService } from 'services/transitions';
import { SourcesService } from 'services/sources';
import { ScenesService } from 'services/scenes';
import { VideoService } from 'services/video';
import { StreamInfoService } from 'services/stream-info';
import { track } from 'services/usage-statistics';
import { IpcServerService } from 'services/ipc-server';
import { TcpServerService } from 'services/tcp-server';
import { StreamlabelsService } from 'services/streamlabels';
import { PerformanceMonitorService } from 'services/performance-monitor';
import { SceneCollectionsService } from 'services/scene-collections';
import { FileManagerService } from 'services/file-manager';
import { PatchNotesService } from 'services/patch-notes';
import { ProtocolLinksService } from 'services/protocol-links';
import { WindowsService } from 'services/windows';

interface IAppState {
  loading: boolean;
  argv: string[];
}

/**
 * Performs operations that happen once at startup and shutdown. This service
 * mainly calls into other services to do the heavy lifting.
 */
export class AppService extends StatefulService<IAppState> {
  @Inject() onboardingService: OnboardingService;
  @Inject() sceneCollectionsService: SceneCollectionsService;
  @Inject() hotkeysService: HotkeysService;
  @Inject() userService: UserService;
  @Inject() shortcutsService: ShortcutsService;
  @Inject() streamInfoService: StreamInfoService;
  @Inject() patchNotesService: PatchNotesService;
  @Inject() windowsService: WindowsService;

  static initialState: IAppState = {
    loading: true,
    argv: []
  };

  private autosaveInterval: number;

  @Inject() transitionsService: TransitionsService;
  @Inject() sourcesService: SourcesService;
  @Inject() scenesService: ScenesService;
  @Inject() videoService: VideoService;
  @Inject() streamlabelsService: StreamlabelsService;
  @Inject() private ipcServerService: IpcServerService;
  @Inject() private tcpServerService: TcpServerService;
  @Inject() private performanceMonitorService: PerformanceMonitorService;
  @Inject() private fileManagerService: FileManagerService;
  @Inject() private protocolLinksService: ProtocolLinksService;

  @track('app_start')
  load() {
    this.START_LOADING();

    // We want to start this as early as possible so that any
    // exceptions raised while loading the configuration are
    // associated with the user in sentry.
    this.userService;

    this.sceneCollectionsService.initialize().then(() => {
      const onboarded = this.onboardingService.startOnboardingIfRequired();

      electron.ipcRenderer.on('shutdown', () => {
        electron.ipcRenderer.send('acknowledgeShutdown');
        this.shutdownHandler();
      });

      this.shortcutsService;
      this.streamlabelsService;

      // Pre-fetch stream info
      this.streamInfoService;

      this.performanceMonitorService.start();

      this.ipcServerService.listen();
      this.tcpServerService.listen();

      this.patchNotesService.showPatchNotesIfRequired(onboarded);

      this.FINISH_LOADING();
    });
  }

  /**
   * the main process sends argv string here
   */
  setArgv(argv: string[]) {
    this.SET_ARGV(argv);
    this.protocolLinksService.start(argv);
  }

  @track('app_close')
  private shutdownHandler() {
    this.START_LOADING();

    this.ipcServerService.stopListening();
    this.tcpServerService.stopListening();

    window.setTimeout(async () => {
      await this.sceneCollectionsService.deinitialize();
      this.performanceMonitorService.stop();
      this.transitionsService.reset();
      this.windowsService.closeAllOneOffs();
      await this.fileManagerService.flushAll();
      electron.ipcRenderer.send('shutdownComplete');
    }, 300);
  }

  startLoading() {
    this.START_LOADING();
  }

  finishLoading() {
    this.FINISH_LOADING();
  }

  @mutation()
  private START_LOADING() {
    this.state.loading = true;
  }

  @mutation()
  private FINISH_LOADING() {
    this.state.loading = false;
  }

  @mutation()
  private SET_ARGV(argv: string[]) {
    this.state.argv = argv;
  }
}
