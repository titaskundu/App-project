package expo.modules.posecamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import android.util.Size
import android.view.ViewGroup
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * The camera view JS places on screen (`<PoseCameraView active onPose onStatus />`).
 *
 * It shows the front-camera preview and, while `active`, sends the body points found in each
 * frame as `onPose` events. `onStatus` reports "starting", "ready", "no-permission" or "error".
 * The camera is tied to the app's screen lifecycle, so Android pauses it automatically when the
 * app goes to the background.
 */
class PoseCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  // Let Android lay out the preview inside this view (React Native only sizes the outer box).
  override val shouldUseAndroidLayout = true

  private val onPose by EventDispatcher()
  private val onStatus by EventDispatcher()

  private val previewView = PreviewView(context).apply {
    // TextureView-based preview, so React views (skeleton, rep ring) draw cleanly on top.
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
    layoutParams = LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
  }

  private var tracker: PoseTracker? = null
  private var provider: ProcessCameraProvider? = null
  private var wantActive = false
  private var bound = false

  init {
    addView(previewView)
    // The phone is propped up and nobody touches it: keep the screen on while this view shows.
    keepScreenOn = true
  }

  fun setActive(active: Boolean) {
    wantActive = active
    if (active) start() else stop()
  }

  private fun start() {
    if (bound) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      status("no-permission")
      return
    }
    val owner = appContext.currentActivity as? LifecycleOwner
    if (owner == null) {
      status("error", "No screen to attach the camera to")
      return
    }
    status("starting")
    val poseTracker = tracker ?: PoseTracker(
      context,
      onPose = { payload -> post { onPose(payload) } },
      onError = { message -> post { status("error", message) } },
    ).also { tracker = it }

    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (!wantActive || bound) return@addListener
      try {
        val cameraProvider = future.get()
        provider = cameraProvider

        // 4:3 frames around 640×480: enough detail for a body 2 m away, light on battery.
        val resolution = ResolutionSelector.Builder()
          .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
          .setResolutionStrategy(
            ResolutionStrategy(Size(640, 480), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER)
          )
          .build()
        val preview = Preview.Builder().setResolutionSelector(resolution).build()
        preview.setSurfaceProvider(previewView.surfaceProvider)

        val analysis = ImageAnalysis.Builder()
          .setResolutionSelector(resolution)
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
          .build()
        analysis.setAnalyzer(poseTracker.executor) { proxy -> poseTracker.analyze(proxy) }

        // Front camera normally; the back one on devices without a front camera (some tablets,
        // the emulator). Only the front camera's picture is mirrored.
        val front = cameraProvider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)
        poseTracker.mirror = front
        val selector = if (front) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA

        cameraProvider.unbindAll()
        cameraProvider.bindToLifecycle(owner, selector, preview, analysis)
        bound = true
        // The model loads in parallel; if it already failed, keep showing that error.
        val modelError = poseTracker.loadError
        if (modelError != null) status("error", modelError) else status("ready")
      } catch (e: Exception) {
        Log.e(TAG, "Camera failed to start", e)
        status("error", e.message ?: "Camera failed to start")
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun stop() {
    provider?.unbindAll()
    bound = false
  }

  /** Called when React removes the view: stop the camera and free the pose model. */
  fun release() {
    wantActive = false
    stop()
    tracker?.close()
    tracker = null
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (wantActive) start()
  }

  override fun onDetachedFromWindow() {
    stop()
    super.onDetachedFromWindow()
  }

  private fun status(state: String, message: String? = null) {
    onStatus(if (message == null) mapOf("state" to state) else mapOf("state" to state, "message" to message))
  }

  private companion object {
    const val TAG = "MmsPose"
  }
}
