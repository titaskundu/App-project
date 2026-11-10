package expo.modules.posecamera

import android.Manifest
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Muscle Mode's camera: camera permission functions plus the `PoseCameraView` native view.
 * Everything runs on the phone; no frames are saved or uploaded.
 */
class PoseCameraModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PoseCamera")

    /** { status, granted, canAskAgain } for the camera, without asking. */
    AsyncFunction("getPermissionAsync") { promise: Promise ->
      Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.CAMERA)
    }

    /** Shows Android's camera permission prompt (if it can still be shown). */
    AsyncFunction("requestPermissionAsync") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.CAMERA)
    }

    View(PoseCameraView::class) {
      Events("onPose", "onStatus")

      Prop("active") { view: PoseCameraView, active: Boolean ->
        view.setActive(active)
      }

      OnViewDestroys { view: PoseCameraView ->
        view.release()
      }
    }
  }
}
