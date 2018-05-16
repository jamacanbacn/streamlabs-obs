import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { Inject } from 'util/injector';
import { SceneCollectionsService } from 'services/scene-collections';
import { OverlaysPersistenceService } from 'services/scene-collections/overlays';
import { CustomizationService } from 'services/customization';
import electron from 'electron';
import path from 'path';
import { AppService } from 'services/app';
import { WidgetsService } from 'services/widgets';
import { ScenesService } from 'services/scenes';
import { IFormInput } from 'components/shared/forms/Input';
import BoolInput from 'components/shared/forms/BoolInput.vue';

@Component({ components: { BoolInput } })
export default class OverlaySettings extends Vue {
  @Inject() sceneCollectionsService: SceneCollectionsService;
  @Inject() overlaysPersistenceService: OverlaysPersistenceService;
  @Inject() appService: AppService;
  @Inject() widgetsService: WidgetsService;
  @Inject() scenesService: ScenesService;
  @Inject() customizationService: CustomizationService;

  busy = false;
  message = '';

  get mediaBackupOptOut(): IFormInput<boolean> {
    return {
      name: 'media_backup_opt_out',
      description: 'Do not back up my media files in the cloud (requires app restart)',
      value: this.customizationService.state.mediaBackupOptOut
    };
  }

  setMediaBackupOptOut(model: IFormInput<boolean>) {
    this.customizationService.setMediaBackupOptOut(model.value);
  }

  saveOverlay() {
    const chosenPath = electron.remote.dialog.showSaveDialog({
      filters: [{ name: 'Overlay File', extensions: ['overlay'] }]
    });

    if (!chosenPath) return;

    this.busy = true;
    this.message = '';

    // TODO: Expose progress to the user
    this.overlaysPersistenceService.saveOverlay(chosenPath).then(() => {
      this.busy = false;
      this.message = `Successfully saved ${path.parse(chosenPath).base}`;
    });
  }

  loadOverlay() {
    const chosenPath = electron.remote.dialog.showOpenDialog({
      filters: [{ name: 'Overlay File', extensions: ['overlay'] }]
    });

    if (!chosenPath) return;

    this.busy = true;
    this.message = '';

    const filename = path.parse(chosenPath[0]).name;
    const configName = this.sceneCollectionsService.suggestName(filename);

    this.sceneCollectionsService.loadOverlay(chosenPath[0], configName).then(() => {
      this.busy = false;
      this.message = `Successfully loaded ${filename}.overlay`;
    });
  }

  loadWidget() {
    const chosenPath = electron.remote.dialog.showOpenDialog({
      filters: [{ name: 'Widget File', extensions: ['widget'] }]
    });

    if (!chosenPath) return;

    this.busy = true;

    this.widgetsService.loadWidgetFile(chosenPath[0], this.scenesService.activeSceneId).then(() => {
      this.busy = false;
    });
  }
}
