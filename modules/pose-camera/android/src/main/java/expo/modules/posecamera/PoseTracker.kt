package expo.modules.posecamera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Log
import androidx.camera.core.ImageProxy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Runs Google's MediaPipe Pose Landmarker on camera frames, entirely on the phone.
 *
 * In plain terms: CameraX hands us a frame → we turn it upright and mirror it (so it matches the
 * selfie preview) → MediaPipe finds 33 body points → we pass the numbers to [onPose].
 * Frames are never stored. All work happens on [executor] (one background thread) and on
 * MediaPipe's own thread, never on the main thread.
 */
class PoseTracker(
  context: Context,
  private val onPose: (Map<String, Any>) -> Unit,
  private val onError: (String) -> Unit,
) {
  val executor: ExecutorService = Executors.newSingleThreadExecutor()

  @Volatile private var landmarker: PoseLandmarker? = null
  /** Mirror frames to match the preview (true for the front camera). */
  @Volatile var mirror = true
  /** Set if the pose model couldn't load; the view checks it so "ready" never hides it. */
  @Volatile var loadError: String? = null
    private set
  private var lastFrameAt = 0L
  private var frames = 0
  private var statsSince = 0L

  init {
    val appContext = context.applicationContext
    executor.execute {
      try {
        landmarker = create(appContext)
      } catch (e: Throwable) {
        Log.e(TAG, "Pose model failed to load", e)
        val message = "The rep counter couldn't load. Close this screen and try again."
        loadError = message
        onError(message)
      }
    }
  }

  private fun create(context: Context): PoseLandmarker {
    // Read the model from the app's assets into memory (works whether or not the APK compressed it).
    val bytes = context.assets.open(MODEL).use { it.readBytes() }
    val buffer = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
    buffer.put(bytes).rewind()

    val options = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(BaseOptions.builder().setModelAssetBuffer(buffer).setDelegate(Delegate.CPU).build())
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .setResultListener { result: PoseLandmarkerResult, input: MPImage -> handle(result, input) }
      .setErrorListener { e: RuntimeException -> onError(e.message ?: "Pose tracking error") }
      .build()
    return PoseLandmarker.createFromOptions(context, options)
  }

  /** Called by CameraX for each frame (on [executor]). Always closes the frame. */
  fun analyze(proxy: ImageProxy) {
    try {
      val tracker = landmarker ?: return
      val now = SystemClock.uptimeMillis()
      // ~24 frames a second is plenty for counting reps and saves battery.
      if (now - lastFrameAt < MIN_FRAME_MS) return
      lastFrameAt = now

      val raw = proxy.toBitmap()
      val upright = Matrix().apply {
        postRotate(proxy.imageInfo.rotationDegrees.toFloat())
        if (mirror) postScale(-1f, 1f) // like the selfie preview
      }
      val frame = Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, upright, false)
      tracker.detectAsync(BitmapImageBuilder(frame).build(), now)
    } catch (e: Throwable) {
      Log.w(TAG, "Frame skipped", e)
    } finally {
      proxy.close()
    }
  }

  private fun handle(result: PoseLandmarkerResult, input: MPImage) {
    val t = result.timestampMs()
    val pose = result.landmarks().firstOrNull()
    val world = result.worldLandmarks().firstOrNull()

    // Flat arrays keep the bridge cheap: lm = [x, y, visibility] × 33 (x/y are 0–1 of the
    // frame), wl = [x, y, z] × 33 in meters around the hips.
    val lm = ArrayList<Double>(99)
    pose?.forEach { p ->
      lm.add(p.x().toDouble())
      lm.add(p.y().toDouble())
      lm.add(p.visibility().orElse(0f).toDouble())
    }
    val wl = ArrayList<Double>(99)
    world?.forEach { p ->
      wl.add(p.x().toDouble())
      wl.add(p.y().toDouble())
      wl.add(p.z().toDouble())
    }
    val ms = SystemClock.uptimeMillis() - t
    onPose(mapOf("t" to t, "w" to input.width, "h" to input.height, "ms" to ms, "lm" to lm, "wl" to wl))

    frames++
    if (statsSince == 0L) statsSince = t
    if (t - statsSince >= 5000) {
      Log.d(TAG, "fps=${frames * 1000 / (t - statsSince)} latency=${ms}ms person=${pose != null}")
      frames = 0
      statsSince = t
    }
  }

  fun close() {
    executor.execute {
      landmarker?.close()
      landmarker = null
    }
    executor.shutdown()
  }

  private companion object {
    const val TAG = "MmsPose"
    const val MODEL = "pose_landmarker_lite.task"
    const val MIN_FRAME_MS = 40L
  }
}
