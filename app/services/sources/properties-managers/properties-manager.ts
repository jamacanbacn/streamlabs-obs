import * as input from 'components/shared/forms/Input';
import * as obs from '../../../../obs-api';


/**
 * This is the interface that the rest of the app uses
 * to interact with property managers in a generic way.
 */
export interface IPropertyManager {
  destroy(): void;
  getPropertiesFormData(): input.TFormData;
  setPropertiesFormData(property: input.TFormData): void;
  settings: Dictionary<any>;
  applySettings(settings: Dictionary<any>): void;
  customUIComponent: string;
}





/**
 * A property manager is a class that manages the source
 * properties for a particular source.  It shares the same
 * lifetime of the source, and may automatically change
 * settings on the source if it wants to.  It is also
 * responsible for deciding which properties are exposed
 * to the user, and for managing any custom UI that may
 * be exposed.
 */
export abstract class PropertiesManager implements IPropertyManager {

  /**
   * Create a new properties manager
   * @param obsSource The source this class manages
   * @param settings The manager settings.  These are *NOT* OBS settings
   */
  constructor(public obsSource: obs.ISource, settings: Dictionary<any>) {
    this.settings = {};
    this.applySettings(settings);
    this.init();
  }


  /**
   * These are settings for the properties manager
   * that are stored in the application configuration.
   */
  settings: Dictionary<any>;


  /**
   * Can be used to attach custom startup behavior to this
   * properties manager.
   */
  init() {
  }


  /**
   * Can be used to attach custom teardown behavior to this
   * properties manager.
   */
  destroy() {
  }


  /**
   * The blacklist is a list of OBS property names that
   * should not be displayed to the user.
   */
  blacklist: string[] = [];


  /**
   * displayOrder will be used as a list of property
   * names to used when ordering properties displayed to the user.
   * Properties not appearing in the list will be shown at the
   * end in the order they are defined.
   */
  displayOrder: string[] = [];


  /**
   * The name of a custom component that will be shown in the
   * source properties window.
   */
  customUIComponent: string;


  /**
   * Called to apply new settings on the properties manager.
   * This function should set the settings attribute on the
   * instance and make any changes in OBS or elsewhere
   * @param settings the new settings
   */
  applySettings(settings: Dictionary<any>) {
    this.settings = {
      ...this.settings,
      ...settings
    };
  }


  getPropertiesFormData(): input.TFormData {
    const obsProperties = input.getPropertiesFormData(this.obsSource);
    let propsArray: input.TFormData = [];

    // First, add properties that appear in the display order
    this.displayOrder.forEach(name => {
      const obsIndex = obsProperties.findIndex(prop => prop.name === name);

      if (obsIndex !== -1) {
        propsArray.push(obsProperties[obsIndex]);
        obsProperties.splice(obsIndex, 1);
      }
    });

    propsArray = propsArray.concat(obsProperties);
    propsArray = propsArray.filter(prop => !this.blacklist.includes(prop.name));

    return propsArray;
  }


  /**
   * By default, simply delegates to the normal
   * setPropertiesFormData function in Input.ts.
   * Can be overridden to modify propreties as they
   * are edited by the user.
   * @param properties The OBS properties
   */
  setPropertiesFormData(properties: input.TFormData) {
    input.setPropertiesFormData(this.obsSource, properties);
  }

}
