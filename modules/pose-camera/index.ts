import { requireNativeModule, requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

/** One camera frame's body points (see android/.../PoseTracker.kt). */
export type PoseFrame = {
  /** Frame time in ms (phone uptime). */
  t: number;
  /** Size of the analysed frame (upright, mirrored like the preview). */
  w: number;
  h: number;
  /** How long detection took, in ms. */
  ms: number;
  /** [x, y, visibility] × 33. x/y are 0–1 of the frame. Empty when nobody is in view. */
  lm: number[];
  /** [x, y, z] × 33 in meters around the middle of the hips (y points down). */
  wl: number[];
};

export type PoseStatus = { state: 'starting' | 'ready' | 'no-permission' | 'error'; message?: string };

export type CameraPermission = { status: 'granted' | 'denied' | 'undetermined'; granted: boolean; canAskAgain: boolean };

type NativePoseCamera = {
  getPermissionAsync(): Promise<CameraPermission>;
  requestPermissionAsync(): Promise<CameraPermission>;
};

const Native = requireNativeModule<NativePoseCamera>('PoseCamera');

export const PoseCamera = {
  getPermission: () => Native.getPermissionAsync(),
  requestPermission: () => Native.requestPermissionAsync(),
};

export type PoseCameraViewProps = ViewProps & {
  /** Camera and tracking run only while true. */
  active: boolean;
  onPose?: (e: { nativeEvent: PoseFrame }) => void;
  onStatus?: (e: { nativeEvent: PoseStatus }) => void;
};

/** Front-camera preview that reports body points ~24×/s while `active`. */
export const PoseCameraView = requireNativeView<PoseCameraViewProps>('PoseCamera');
