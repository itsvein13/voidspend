package expo.modules.receiptscan

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Reads the text of a receipt photo with Google ML Kit, on the device. It returns the
// whole text and every line with its frame, so the parser can put a name and its
// price on one row. The recognizer is closed after each call.
// Status: written in milestone M5 and NOT compiled yet. It needs a development
// build (see docs/v2-m5-receipt-scanner.md).
class ReceiptScanModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReceiptScan")

    AsyncFunction("recognizeAsync") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(CodedException("ERR_NO_CONTEXT", "The app context is not ready.", null))
        return@AsyncFunction
      }
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (error: Exception) {
        promise.reject(CodedException("ERR_IMAGE", error.message ?: "The photo could not be opened.", error))
        return@AsyncFunction
      }
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      recognizer.process(image)
        .addOnSuccessListener { result ->
          val lines = mutableListOf<Map<String, Any>>()
          for (block in result.textBlocks) {
            for (line in block.lines) {
              val box = line.boundingBox ?: continue
              lines.add(
                mapOf(
                  "text" to line.text,
                  "top" to box.top,
                  "bottom" to box.bottom,
                  "left" to box.left,
                  "right" to box.right
                )
              )
            }
          }
          recognizer.close()
          promise.resolve(mapOf("text" to result.text, "lines" to lines))
        }
        .addOnFailureListener { error ->
          recognizer.close()
          promise.reject(CodedException("ERR_OCR", error.message ?: "Text recognition failed.", error))
        }
    }
  }
}
