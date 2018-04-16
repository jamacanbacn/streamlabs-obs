import Vue from 'vue';
import { without } from 'lodash';
import { StatefulService, mutation } from '../stateful-service';
import { ScenesTransitionsService } from '../scenes-transitions';
import { WindowsService } from '../windows';
import {
  IScene,
  Scene,
  ISceneItem,
  SceneItem,
  IScenesState,
  ISceneCreateOptions,
  IScenesServiceApi
} from './index';
import { SourcesService, ISource } from 'services/sources';
import electron from 'electron';
import { Subject } from 'rxjs/Subject';
import { Inject } from '../../util/injector';
import * as obs from '../obs-api';
import namingHelpers from '../../util/NamingHelpers';
const { ipcRenderer } = electron;

export class ScenesService extends StatefulService<IScenesState> implements IScenesServiceApi {

  static initialState: IScenesState = {
    activeSceneId: '',
    displayOrder: [],
    scenes: {}
  };

  sceneAdded = new Subject<IScene>();
  sceneRemoved = new Subject<IScene>();
  sceneSwitched = new Subject<IScene>();
  itemAdded = new Subject<ISceneItem & ISource>();
  itemRemoved = new Subject<ISceneItem & ISource>();
  itemUpdated = new Subject<ISceneItem & ISource>();


  @Inject()
  private windowsService: WindowsService;

  @Inject()
  private sourcesService: SourcesService;


  @Inject('ScenesTransitionsService')
  private transitionsService: ScenesTransitionsService;

  @mutation()
  private ADD_SCENE(id: string, name: string) {
    Vue.set<IScene>(this.state.scenes, id, {
      id,
      name,
      resourceId: 'Scene' + JSON.stringify([id]),
      nodes: []
    });
    this.state.displayOrder.push(id);
    this.state.activeSceneId = this.state.activeSceneId || id;
  }

  @mutation()
  private REMOVE_SCENE(id: string) {
    Vue.delete(this.state.scenes, id);

    this.state.displayOrder = without(this.state.displayOrder, id);
  }

  @mutation()
  private MAKE_SCENE_ACTIVE(id: string) {
    this.state.activeSceneId = id;
  }

  @mutation()
  private SET_SCENE_ORDER(order: string[]) {
    this.state.displayOrder = order;
  }


  createScene(name: string, options: ISceneCreateOptions = {}) {
    // Get an id to identify the scene on the frontend
    const id = options.sceneId || ('scene_' + ipcRenderer.sendSync('getUniqueId'));
    this.ADD_SCENE(id, name);
    const obsScene = obs.SceneFactory.create(id);
    this.sourcesService.addSource(obsScene.source, name);

    if (options.duplicateSourcesFromScene) {
      const oldScene = this.getSceneByName(options.duplicateSourcesFromScene);
      const newScene = this.getScene(id);

      oldScene.getItems().slice().reverse().forEach(item => {
        const newItem = newScene.addSource(item.sourceId);
        newItem.setSettings(item.getSettings());
      });
    }

    this.sceneAdded.next(this.state.scenes[id]);
    if (options.makeActive) this.makeSceneActive(id);
    return this.getSceneByName(name);
  }


  removeScene(id: string, force = false): IScene {
    if (!force && Object.keys(this.state.scenes).length < 2) {
      alert('There needs to be at least one scene.');
      return;
    }

    const scene = this.getScene(id);
    const sceneModel = this.state.scenes[id];

    // remove all sources from scene
    scene.getItems().forEach(sceneItem => scene.removeItem(sceneItem.sceneItemId));

    // remove scene from other scenes if it has been added as a source
    this.getSceneItems().forEach(sceneItem => {
      if (sceneItem.sourceId !== scene.id) return;
      sceneItem.getScene().removeItem(sceneItem.sceneItemId);
    });

    this.REMOVE_SCENE(id);

    if (this.state.activeSceneId === id) {
      const sceneIds = Object.keys(this.state.scenes);

      if (sceneIds[0]) {
        this.makeSceneActive(sceneIds[0]);
      }
    }

    this.sceneRemoved.next(sceneModel);
    return sceneModel;
  }


  setLockOnAllScenes(locked: boolean) {
    this.scenes.forEach(scene => scene.setLockOnAllItems(locked));
  }


  getSourceScenes(sourceId: string): Scene[] {
    const resultScenes: Scene[] = [];
    this.scenes.forEach(scene => {
      const items = scene.getItems().filter(sceneItem => sceneItem.sourceId === sourceId);
      if (items.length > 0) resultScenes.push(scene);
    });
    return resultScenes;
  }


  makeSceneActive(id: string): boolean {
    const scene = this.getScene(id);
    if (!scene) return false;

    const obsScene = scene.getObsScene();

    this.transitionsService.transitionTo(obsScene);
    this.MAKE_SCENE_ACTIVE(id);
    this.sceneSwitched.next(scene.getModel());
    return true;
  }


  setSceneOrder(order: string[]) {
    this.SET_SCENE_ORDER(order);
  }


  // Utility functions / getters

  getSceneByName(name: string): Scene {
    let foundScene: IScene;

    Object.keys(this.state.scenes).forEach(id => {
      const scene = this.state.scenes[id];

      if (scene.name === name) {
        foundScene = scene;
      }
    });

    return foundScene ? this.getScene(foundScene.id) : null;
  }


  getModel(): IScenesState  {
    return this.state;
  }

  getScene(id: string) {
    return !this.state.scenes[id] ? null : new Scene(id);
  }


  getSceneItem(sceneItemId: string) {
    for (const scene of this.scenes) {
      const sceneItem = scene.getItem(sceneItemId);
      if (sceneItem) return sceneItem;
    }
    return null;
  }

  getSceneItems(): SceneItem[] {
    const sceneItems: SceneItem[] = [];
    this.scenes.forEach(scene => sceneItems.push(...scene.getItems()));
    return sceneItems;
  }

  getScenes(): Scene[] {
    return this.scenes;
  }

  get scenes(): Scene[] {
    return this.state.displayOrder.map(id => {
      return this.getScene(id);
    });
  }


  get activeSceneId(): string {
    return this.state.activeSceneId;
  }


  get activeScene(): Scene {
    return this.getScene(this.state.activeSceneId);
  }

  suggestName(name: string): string {
    return namingHelpers.suggestName(name, (name: string) => {
      const ind = this.activeScene
        .getNodes()
        .findIndex(node => node.name === name);
      return ind !== -1;
    });
  }


  showNameScene(options: {rename?: string, itemsToGroup?: string[] } = {}) {
    this.windowsService.showWindow({
      componentName: 'NameScene',
      queryParams: options,
      size: {
        width: 400,
        height: 250
      }
    });
  }


  showNameFolder(options: { renameId?: string, itemsToGroup?: string[], parentId?: string } = {}) {
    this.windowsService.showWindow({
      componentName: 'NameFolder',
      queryParams: options,
      size: {
        width: 400,
        height: 250
      }
    });
  }


  showDuplicateScene(sceneName: string) {
    this.windowsService.showWindow({
      componentName: 'NameScene',
      queryParams: { sceneToDuplicate: sceneName },
      size: {
        width: 400,
        height: 250
      }
    });
  }
}

