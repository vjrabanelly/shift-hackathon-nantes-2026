package com.lab.echa.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "ImageAnalyzer")
public class ImageAnalyzerPlugin extends Plugin {

    private static final String TAG = "ECHA_ANALYZER";
    private ImageLabeler labeler;
    private TextRecognizer textRecognizer;
    private final Set<String> analyzedUrls = new HashSet<>();

    @Override
    public void load() {
        ImageLabelerOptions options = new ImageLabelerOptions.Builder()
                .setConfidenceThreshold(0.6f)
                .build();
        labeler = ImageLabeling.getClient(options);
        textRecognizer = TextRecognition.getClient(new TextRecognizerOptions.Builder().build());
        Log.i(TAG, "ML Kit Image Analyzer loaded");
    }

    /**
     * Analyze a base64-encoded image (already cropped by JS) and return labels + OCR text.
     * Includes dedup via imageUrl parameter.
     *
     * Call from JS: ImageAnalyzer.analyzeImage({ image: "base64...", imageUrl: "https://...", crop: {x, y, w, h} })
     */
    @PluginMethod()
    public void analyzeImage(PluginCall call) {
        // Dedup check
        String imageUrl = call.getString("imageUrl", "");
        if (!imageUrl.isEmpty() && analyzedUrls.contains(imageUrl)) {
            JSObject cached = new JSObject();
            cached.put("skipped", true);
            cached.put("reason", "already_analyzed");
            cached.put("imageUrl", imageUrl);
            call.resolve(cached);
            return;
        }

        String base64 = call.getString("image");
        if (base64 == null || base64.isEmpty()) {
            call.reject("Missing 'image' parameter (base64)");
            return;
        }

        // Strip data URI prefix if present
        if (base64.contains(",")) {
            base64 = base64.substring(base64.indexOf(",") + 1);
        }

        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);

        if (bitmap == null) {
            call.reject("Failed to decode image");
            return;
        }

        // Apply crop if provided (x, y, w, h in pixels)
        JSObject crop = call.getObject("crop");
        if (crop != null) {
            int x = crop.getInteger("x", 0);
            int y = crop.getInteger("y", 0);
            int w = crop.getInteger("w", bitmap.getWidth());
            int h = crop.getInteger("h", bitmap.getHeight());

            // Clamp to bitmap bounds
            x = Math.max(0, Math.min(x, bitmap.getWidth() - 1));
            y = Math.max(0, Math.min(y, bitmap.getHeight() - 1));
            w = Math.min(w, bitmap.getWidth() - x);
            h = Math.min(h, bitmap.getHeight() - y);

            if (w > 0 && h > 0) {
                bitmap = Bitmap.createBitmap(bitmap, x, y, w, h);
                Log.i(TAG, "Cropped to: " + w + "x" + h + " from (" + x + "," + y + ")");
            }
        }

        // Mark as analyzed
        if (!imageUrl.isEmpty()) {
            analyzedUrls.add(imageUrl);
        }

        InputImage inputImage = InputImage.fromBitmap(bitmap, 0);
        JSObject result = new JSObject();
        result.put("imageUrl", imageUrl);

        labeler.process(inputImage)
                .addOnSuccessListener(labels -> {
                    JSArray labelArray = new JSArray();
                    for (ImageLabel label : labels) {
                        JSObject l = new JSObject();
                        l.put("text", label.getText());
                        l.put("confidence", Math.round(label.getConfidence() * 100));
                        l.put("index", label.getIndex());
                        labelArray.put(l);
                    }
                    result.put("labels", labelArray);

                    // Now run OCR
                    textRecognizer.process(inputImage)
                            .addOnSuccessListener(text -> {
                                result.put("text", text.getText());
                                result.put("success", true);
                                result.put("skipped", false);
                                Log.i(TAG, "Analysis done: " + labels.size() + " labels, text: " + text.getText().length() + " chars");
                                call.resolve(result);
                            })
                            .addOnFailureListener(e -> {
                                result.put("text", "");
                                result.put("success", true);
                                result.put("skipped", false);
                                call.resolve(result);
                            });
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Labeling failed: " + e.getMessage());
                    call.reject("Analysis failed: " + e.getMessage());
                });
    }

    /**
     * Check if an image URL has already been analyzed.
     */
    @PluginMethod()
    public void isAnalyzed(PluginCall call) {
        String imageUrl = call.getString("imageUrl", "");
        JSObject ret = new JSObject();
        ret.put("analyzed", analyzedUrls.contains(imageUrl));
        call.resolve(ret);
    }

    /**
     * Reset the dedup cache (e.g., new session).
     */
    @PluginMethod()
    public void resetCache(PluginCall call) {
        int count = analyzedUrls.size();
        analyzedUrls.clear();
        JSObject ret = new JSObject();
        ret.put("cleared", count);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (labeler != null) labeler.close();
        if (textRecognizer != null) textRecognizer.close();
    }
}
