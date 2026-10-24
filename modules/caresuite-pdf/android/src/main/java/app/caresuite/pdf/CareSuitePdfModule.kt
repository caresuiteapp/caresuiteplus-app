package app.caresuite.pdf

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Base64
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDDocumentNameDictionary
import com.tom_roush.pdfbox.pdmodel.common.PDNameTreeNode
import com.tom_roush.pdfbox.pdmodel.common.filespecification.PDComplexFileSpecification
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.IdentityHashMap
import java.util.UUID
import kotlin.math.roundToInt

class CareSuitePdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CareSuitePdf")

    AsyncFunction("extractAttachments") { uri: String ->
      val context = requireNotNull(appContext.reactContext)
      val file = cacheFile(uri)
      require(file.length() in 1..(10L * 1024 * 1024)) { "Die PDF ist leer oder überschreitet 10 MB." }
      PDFBoxResourceLoader.init(context)
      val attachments = mutableListOf<Map<String, String>>()
      var total = 0
      PDDocument.load(file, MemoryUsageSetting.setupTempFileOnly()).use { document ->
        require(!document.isEncrypted) { "Verschlüsselte PDFs werden nicht unterstützt." }
        val root = PDDocumentNameDictionary(document.documentCatalog).embeddedFiles
        val seen = IdentityHashMap<PDNameTreeNode<PDComplexFileSpecification>, Boolean>()
        fun visit(node: PDNameTreeNode<PDComplexFileSpecification>, depth: Int) {
          require(depth <= 64 && seen.put(node, true) == null) { "Die eingebetteten Dateien sind nicht eindeutig lesbar." }
          node.names?.forEach { (name, specification) ->
            require(attachments.size < 32) { "Die PDF enthält mehr als 32 eingebettete Dateien." }
            val embedded = specification.embeddedFileUnicode ?: specification.embeddedFile ?: return@forEach
            val output = ByteArrayOutputStream()
            embedded.createInputStream().use { input ->
              val buffer = ByteArray(8192)
              while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                require(total <= 5 * 1024 * 1024) { "Die eingebetteten Dateien überschreiten zusammen 5 MB." }
                output.write(buffer, 0, count)
              }
            }
            attachments.add(mapOf("name" to (specification.fileUnicode ?: specification.file ?: name), "base64" to Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)))
          }
          node.kids?.forEach { visit(it, depth + 1) }
        }
        if (root != null) visit(root, 0)
      }
      attachments
    }
    AsyncFunction("renderPages") { uri: String, maximumPages: Int ->
      require(maximumPages in 1..100) { "Der zulässige Seitenumfang ist überschritten." }
      val input = cacheFile(uri)
      require(input.length() in 1..(20L * 1024 * 1024)) { "Die PDF ist leer oder überschreitet 20 MB." }
      val folder = File(input.parentFile, "pages-" + UUID.randomUUID()).apply { mkdirs() }
      val pages = mutableListOf<Map<String, Any>>()
      try {
        ParcelFileDescriptor.open(input, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
          PdfRenderer(descriptor).use { renderer ->
            require(renderer.pageCount in 1..maximumPages) { "Die Anlagen überschreiten den zulässigen Seitenumfang." }
            var totalPixels = 0L
            var totalBytes = 0L
            for (index in 0 until renderer.pageCount) renderer.openPage(index).use { page ->
              val width = minOf(1600, maxOf(800, page.width * 2))
              val height = (page.height.toDouble() / page.width * width).roundToInt()
              require(height in 1..6000) { "Das PDF-Seitenformat kann nicht sicher dargestellt werden." }
              totalPixels += width.toLong() * height
              require(totalPixels <= 100_000_000) { "Die PDF-Anlagen enthalten zu große Bildflächen." }
              val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
              val target = File(folder, "page-$index.png")
              try {
                bitmap.eraseColor(Color.WHITE)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                target.outputStream().use { require(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
              } finally { bitmap.recycle() }
              totalBytes += target.length()
              require(totalBytes <= 50L * 1024 * 1024) { "Die Anlagenbilder überschreiten zusammen 50 MB." }
              pages.add(mapOf("uri" to Uri.fromFile(target).toString(), "sourcePage" to index + 1, "sourcePages" to renderer.pageCount, "width" to width, "height" to height))
            }
          }
        }
        pages
      } catch (error: Exception) { folder.deleteRecursively(); throw error }
    }
  }
  private fun cacheFile(uri: String): File {
    val context = requireNotNull(appContext.reactContext)
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "Die lokale PDF-Datei ist nicht zugänglich." }
    val file = File(requireNotNull(parsed.path)).canonicalFile
    require(file.path.startsWith(context.cacheDir.canonicalPath + File.separator) && file.isFile) { "Die PDF liegt außerhalb des App-Zwischenspeichers." }
    return file
  }
}
