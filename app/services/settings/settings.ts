import { StatefulService, mutation } from 'services/stateful-service';
import {
  obsValuesToInputValues,
  inputValuesToObsValues,
  TObsValue,
  TFormData
} from '../../components/shared/forms/Input';
import { nodeObs } from '../obs-api';
import { SourcesService } from 'services/sources';
import { Inject } from '../../util/injector';
import { AudioService, E_AUDIO_CHANNELS } from 'services/audio';
import { WindowsService } from 'services/windows';
import Utils from '../utils';
import { AppService } from 'services/app';
import {
  VideoEncodingOptimizationService,
  IOutputSettings
} from '../video-encoding-optimizations';
import { ISettingsSubCategory, ISettingsServiceApi } from './settings-api';


export interface ISettingsState {
  General: {
    KeepRecordingWhenStreamStops: boolean;
    RecordWhenStreaming: boolean;
    WarnBeforeStartingStream: boolean;
    WarnBeforeStoppingStream: boolean;
    SnappingEnabled: boolean;
    SnapDistance: number;
    ScreenSnapping: boolean;
    SourceSnapping: boolean;
    CenterSnapping: boolean;
  };
  Stream: {
    key: string;
    streamType: string;
  };
  Output: Dictionary<TObsValue>;
  Video: {
    Base: string;
  };
  Audio: Dictionary<TObsValue>;
  Advanced: {
    DelayEnable: boolean;
    DelaySec: number;
  };
}

declare type TSettingsFormData = Dictionary<ISettingsSubCategory[]>;


export class SettingsService extends StatefulService<ISettingsState>
  implements ISettingsServiceApi {
  static initialState = {};

  static convertFormDataToState(
    settingsFormData: TSettingsFormData
  ): ISettingsState {
    const settingsState: Partial<ISettingsState> = {};
    for (const groupName in settingsFormData) {
      settingsFormData[groupName].forEach(subGroup => {
        subGroup.parameters.forEach(parameter => {
          settingsState[groupName] = settingsState[groupName] || {};
          settingsState[groupName][parameter.name] = parameter.value;
        });
      });
    }

    return settingsState as ISettingsState;
  }

  @Inject() private sourcesService: SourcesService;

  @Inject() private audioService: AudioService;

  @Inject() private windowsService: WindowsService;

  @Inject() private appService: AppService;

  @Inject()
  private videoEncodingOptimizationService: VideoEncodingOptimizationService;

  init() {
    this.loadSettingsIntoStore();
  }

  loadSettingsIntoStore() {
    // load configuration from nodeObs to state
    const settingsFormData = {};
    this.getCategories().forEach(categoryName => {
      settingsFormData[categoryName] = this.getSettingsFormData(categoryName);
    });
    this.SET_SETTINGS(SettingsService.convertFormDataToState(settingsFormData));
  }

  showSettings(categoryName?: string) {
    this.windowsService.showWindow({
      componentName: 'Settings',
      queryParams: { categoryName },
      size: {
        width: 800,
        height: 800
      }
    });
  }

  advancedSettingEnabled(): boolean {
    return (
      Utils.isDevMode() || this.appService.state.argv.includes('--adv-settings')
    );
  }

  getCategories(): string[] {
    let categories = nodeObs.OBS_settings_getListCategories();
    categories = categories
      .concat(['Scene Collections','Notifications', 'Appearance', 'Remote Control']);

    // we decided to not expose API settings for production version yet
    if (this.advancedSettingEnabled()) categories = categories.concat(['API', 'Experimental']);

    return categories;
  }

  getSettingsFormData(categoryName: string): ISettingsSubCategory[] {
    if (categoryName === 'Audio') return this.getAudioSettingsFormData();
    const settings = nodeObs.OBS_settings_getSettings(categoryName);

    // Names of settings that are disabled because we
    // have not implemented them yet.
    const BLACK_LIST_NAMES = [
      'SysTrayMinimizeToTray',
      'ReplayBufferWhileStreaming',
      'KeepReplayBufferStreamStops',
      'SysTrayEnabled',
      'CenterSnapping',
      'HideProjectorCursor',
      'ProjectorAlwaysOnTop',
      'SaveProjectors',
      'SysTrayWhenStarted',
      'RecRBSuffix',
      'LowLatencyEnable',
      'BindIP',
      'FilenameFormatting',
      'MaxRetries',
      'NewSocketLoopEnable',
      'OverwriteIfExists',
      'RecRBPrefix',
      'Reconnect',
      'RetryDelay'
    ];

    for (const group of settings) {
      group.parameters = obsValuesToInputValues(group.parameters, {
        disabledFields: BLACK_LIST_NAMES,
        transformListOptions: true
      });
    }

    // We hide the encoder preset and settings if the optimized ones are in used
    if (
      categoryName === 'Output' &&
      this.videoEncodingOptimizationService.getIsUsingEncodingOptimizations()
    ) {
      const outputSettings: IOutputSettings = this.videoEncodingOptimizationService.getCurrentOutputSettings();

      const indexSubCategory = settings.indexOf(
        settings.find((category: any) => {
          return category.nameSubCategory === 'Streaming';
        })
      );

      const parameters = settings[indexSubCategory].parameters;

      // Setting preset visibility
      const indexPreset = parameters.indexOf(
        parameters.find((parameter: any) => {
          return parameter.name === outputSettings.presetField;
        })
      );
      settings[indexSubCategory].parameters[indexPreset].visible = false;

      // Setting encoder settings value
      const indexX264Settings = parameters.indexOf(
        parameters.find((parameter: any) => {
          return parameter.name === outputSettings.encoderSettingsField;
        })
      );
      settings[indexSubCategory].parameters[indexX264Settings].visible = false;
    }

    return settings;
  }

  private getAudioSettingsFormData(): ISettingsSubCategory[] {
    const audioDevices = this.audioService.getDevices();
    const sourcesInChannels = this.sourcesService
      .getSources()
      .filter(source => source.channel !== void 0);

    const parameters: TFormData = [];

    // collect output channels info
    for (
      let channel = E_AUDIO_CHANNELS.OUTPUT_1;
      channel <= E_AUDIO_CHANNELS.OUTPUT_2;
      channel++
    ) {
      const source = sourcesInChannels.find(
        source => source.channel === channel
      );
      const deviceInd = channel;

      parameters.push({
        value: source ? source.getObsInput().settings['device_id'] : null,
        description: `Desktop Audio Device ${deviceInd}`,
        name: `Desktop Audio ${deviceInd > 1 ? deviceInd : ''}`,
        type: 'OBS_PROPERTY_LIST',
        enabled: true,
        visible: true,
        options: [{ description: 'Disabled', value: null }].concat(
          audioDevices
            .filter(device => device.type === 'output')
            .map(device => {
              return { description: device.description, value: device.id };
            })
        )
      });
    }

    // collect input channels info
    for (
      let channel = E_AUDIO_CHANNELS.INPUT_1;
      channel <= E_AUDIO_CHANNELS.INPUT_3;
      channel++
    ) {
      const source = sourcesInChannels.find(
        source => source.channel === channel
      );
      const deviceInd = channel - 2;

      parameters.push({
        value: source ? source.getObsInput().settings['device_id'] : null,
        description: `Mic/Auxiliary device ${deviceInd}`,
        name: `Mic/Aux ${deviceInd > 1 ? deviceInd : ''}`,
        type: 'OBS_PROPERTY_LIST',
        enabled: true,
        visible: true,
        options: [{ description: 'Disabled', value: null }].concat(
          audioDevices.filter(device => device.type === 'input').map(device => {
            return { description: device.description, value: device.id };
          })
        )
      });
    }

    return [
      {
        nameSubCategory: 'Untitled',
        parameters
      }
    ];
  }

  setSettings(categoryName: string, settingsData: ISettingsSubCategory[]) {
    if (categoryName === 'Audio') return this.setAudioSettings(settingsData);

    const dataToSave = [];

    for (const subGroup of settingsData) {
      dataToSave.push({
        ...subGroup,
        parameters: inputValuesToObsValues(subGroup.parameters, {
          valueToCurrentValue: true
        })
      });
    }

    nodeObs.OBS_settings_saveSettings(categoryName, dataToSave);
    this.SET_SETTINGS(
      SettingsService.convertFormDataToState({ [categoryName]: settingsData })
    );
  }

  private setAudioSettings(settingsData: ISettingsSubCategory[]) {
    const audioDevices = this.audioService.getDevices();

    settingsData[0].parameters.forEach((deviceForm, ind) => {
      const channel = ind + 1;
      const isOutput = [
        E_AUDIO_CHANNELS.OUTPUT_1,
        E_AUDIO_CHANNELS.OUTPUT_2
      ].includes(channel);
      const source = this.sourcesService
        .getSources()
        .find(source => source.channel === channel);


      if (source && deviceForm.value === null) {
        if (deviceForm.value === null) {
          this.sourcesService.removeSource(source.sourceId);
          return;
        }
      } else if (deviceForm.value !== null) {

        const device = audioDevices.find(device => device.id === deviceForm.value);
        const displayName = device.id === 'default' ? deviceForm.name : device.description;

        if (!source) {
          this.sourcesService.createSource(
            displayName,
            isOutput ? 'wasapi_output_capture' : 'wasapi_input_capture',
            {},
            { channel }
          );
        } else {
          source.updateSettings({ device_id: deviceForm.value, name: displayName });
        }
      }

    });
  }

  @mutation()
  SET_SETTINGS(settingsData: ISettingsState) {
    this.state = Object.assign({}, this.state, settingsData);
  }
}
