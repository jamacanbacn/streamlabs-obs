import * as obs from '../../../obs-api';
import { Subscription } from 'rxjs/Subscription';
import { TFormData } from '../../components/shared/forms/Input';
import { ISource } from '../sources/sources-api';

export interface IAudioSourcesState {
  audioSources: Dictionary<IAudioSource>;
}

export interface IAudioSource {
  sourceId: string;
  fader: IFader;
  audioMixers: number;
  monitoringType: obs.EMonitoringType;
  forceMono: boolean;
  syncOffset: number;
  muted: boolean;
  resourceId: string;
}


export interface IAudioSourceApi extends IAudioSource {
  setDeflection(deflection: number): void;
  setMul(mul: number): void;
  setMuted(muted: boolean): void;
  subscribeVolmeter(cb: (volmeter: IVolmeter) => void): Subscription;
  getSettingsForm(): TFormData;
  setSettings(patch: Partial<IAudioSource>): void;
  getModel(): IAudioSource & ISource;
}


export interface IAudioServiceApi {
  getDevices(): IAudioDevice[];
  getSource(sourceId: string): IAudioSourceApi;
  getSources(): IAudioSourceApi[];
  getSourcesForScene(sceneId: string): IAudioSourceApi[];
  getSourcesForCurrentScene(): IAudioSourceApi[];
}

export interface IVolmeter {
  magnitude: number[];
  peak: number[];
  inputPeak: number[];
}

export interface IAudioDevice {
  id: string;
  description: string;
  type: 'input' | 'output';
}


export interface IFader {
  db: number;
  deflection: number;
  mul: number;
}
