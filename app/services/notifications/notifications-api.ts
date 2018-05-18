import { TIssueCode } from 'services/troubleshooter';
import { IJsonRpcRequest } from 'services/jsonrpc';
import { Observable } from 'rxjs/Observable';
import { TFormData } from '../../components/shared/forms/Input';

export enum ENotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  SUCCESS = 'SUCCESS'
}

export interface INotificationsSettings {
  enabled: boolean;
  playSound: boolean;
}

export interface INotificationOptions {
  message: string;
  code?: TIssueCode | string;
  unread?: boolean;
  type?: ENotificationType;
  action?: IJsonRpcRequest;
  playSound?: boolean;
  data?: any;

  /** The notification's life time in ms. Use -1 for infinity */
  lifeTime?: number;
  showTime?: boolean;
}


export interface INotification extends INotificationOptions {
  id: number;
  type: ENotificationType;
  message: string;
  unread: boolean;
  date: number;
  playSound: boolean;
  lifeTime: number;
  showTime: boolean;
}


export interface INotificationsServiceApi {
  notificationPushed: Observable<INotification>;
  notificationRead: Observable<number[]>;
  push(notifyInfo: INotificationOptions): INotification;
  getNotification(id: number): INotification;
  getAll(type?: ENotificationType): INotification[];
  getUnread(type?: ENotificationType): INotification[];
  getRead(type?: ENotificationType): INotification[];
  getSettings(): INotificationsSettings;
  getSettingsFormData(): TFormData;
  setSettings(patch: Partial<INotificationsSettings>): void;
  restoreDefaultSettings(): void;
  markAsRead(id: number): void;
  markAllAsRead(): void;
  applyAction(notificationId: number): void;
  showNotifications(): void;
}
