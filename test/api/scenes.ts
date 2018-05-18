import test from 'ava';
import { useSpectron } from '../helpers/spectron';
import { getClient } from '../helpers/api-client';
import { IScenesServiceApi } from '../../app/services/scenes/scenes-api';
import { sleep } from '../helpers/sleep';

useSpectron({ restartAppAfterEachTest: false });


test('The default scene exists', async t => {
  const client = await getClient();
  const scenesService = client.getResource<IScenesServiceApi>('ScenesService');
  const scenes = scenesService.getScenes();

  t.true(scenes.length === 1);

});


test('Creating, fetching and removing scenes', async t => {
  const client = await getClient();
  const scenesService = client.getResource<IScenesServiceApi>('ScenesService');

  const scene2 = scenesService.createScene('Scene2');

  t.is(scene2.name, 'Scene2');

  let scenes = scenesService.getScenes();
  let scenesNames = scenes.map(scene => scene.name);

  t.deepEqual(scenesNames, ['Scene', 'Scene2']);

  scenesService.removeScene(scenes[1].id);
  scenes = scenesService.getScenes();
  scenesNames = scenes.map(scene => scene.name);

  t.deepEqual(scenesNames, ['Scene']);
});


test('Switching between scenes', async t => {
  const client = await getClient();
  const scenesService = client.getResource<IScenesServiceApi>('ScenesService');

  const scene = scenesService.getSceneByName('Scene');
  const scene2 = scenesService.createScene('Scene2');


  t.is(scene.id, scenesService.activeSceneId);

  scenesService.makeSceneActive(scene2.id);

  t.is(scene2.id, scenesService.activeSceneId);

  scene2.remove();

  t.is(scene.id, scenesService.activeSceneId);

});


test('Creating, fetching and removing scene-items', async t => {
  const client = await getClient();
  const scenesService = client.getResource<IScenesServiceApi>('ScenesService');

  const scene = scenesService.getSceneByName('Scene');
  const image1 = scene.createAndAddSource('Image1', 'image_source');
  const image2 = scene.createAndAddSource('Image2', 'image_source');
  t.is(image1['name'], 'Image1');

  let items = scene.getItems();
  let itemsNames = items.map(item => item['name']);
  t.deepEqual(itemsNames, ['Image2', 'Image1']);


  scene.removeItem(image2.sceneItemId);
  items = scene.getItems();
  itemsNames = items.map(item => item['name']);
  t.deepEqual(itemsNames, ['Image1']);

});


test('Scenes events', async t => {
  const client = await getClient();
  const scenesService = client.getResource<IScenesServiceApi>('ScenesService');
  let eventData: Dictionary<any>;

  scenesService.sceneSwitched.subscribe(() => void 0);
  scenesService.sceneAdded.subscribe(() => void 0);
  scenesService.sceneRemoved.subscribe(() => void 0);
  scenesService.itemAdded.subscribe(() => void 0);
  scenesService.itemRemoved.subscribe(() => void 0);
  scenesService.itemUpdated.subscribe(() => void 0);

  const scene2 = scenesService.createScene('Scene2');
  eventData = await client.fetchNextEvent();

  t.is(eventData.name, 'Scene2');

  const scene3 = scenesService.createScene('Scene3');
  await client.fetchNextEvent();

  scenesService.makeSceneActive(scene2.id);
  eventData = await client.fetchNextEvent();
  t.is(eventData.name, 'Scene2');

  scene3.remove();
  eventData = await client.fetchNextEvent();
  t.is(eventData.name, 'Scene3');


  const image = scene2.createAndAddSource('image', 'image_source');
  eventData = await client.fetchNextEvent();
  t.is(eventData.sceneItemId, image.sceneItemId);


  image.setVisibility(false);
  eventData = await client.fetchNextEvent();
  t.is(eventData.visible, false);


  image.remove();
  eventData = await client.fetchNextEvent();
  t.is(eventData.sceneItemId, image.sceneItemId);

});


test('Creating nested scenes', async t => {
  const client = await getClient();
  const scenesService = client.getResource<IScenesServiceApi>('ScenesService');

  const sceneA = scenesService.createScene('SceneA');
  const sceneB = scenesService.createScene('SceneB');
  const sceneC = scenesService.createScene('SceneC');

  sceneA.addSource(sceneB.id);
  let sceneAItems = sceneA.getItems();
  let itemsANames = sceneAItems.map(item => item['name']);

  t.deepEqual(itemsANames, ['SceneB']);

  sceneC.addSource(sceneA.id);
  const sceneCItems = sceneC.getItems();
  const itemsCNames = sceneCItems.map(item => item['name']);

  t.deepEqual(itemsCNames, ['SceneA']);

  // Unable to add a source when the scene you are trying to add already contains your current scene
  sceneA.addSource(sceneC.id);
  sceneAItems = sceneA.getItems();
  itemsANames = sceneAItems.map(item => item['name']);

  t.deepEqual(itemsANames, ['SceneB']);

});


test('SceneItem.setSettings()', async t => {
  const client = await getClient();
  const scenesService = client.getResource<IScenesServiceApi>('ScenesService');
  const scene = scenesService.activeScene;

  const sceneItem = scene.createAndAddSource('MyColorSource', 'color_source');

  sceneItem.setTransform({ rotation: 90 });

  t.is(sceneItem.getModel().transform.rotation, 90);

  // rotation must be between 0 and 360
  sceneItem.setTransform({ rotation: 360 + 90 });
  t.is(sceneItem.getModel().transform.rotation, 90);

  sceneItem.setTransform({
    crop: {
      top: 1.2,
      bottom: 5.6,
      left: 7.1,
      right: 10,
    }
  });

  // crop values must be rounded
  t.deepEqual(sceneItem.getModel().transform.crop, {
    top: 1,
    bottom: 6,
    left: 7,
    right: 10,
  });


});