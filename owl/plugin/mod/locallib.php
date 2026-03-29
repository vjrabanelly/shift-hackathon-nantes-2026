<?php
defined('MOODLE_INTERNAL') || die();

/**
 * Returns the backend base URL from plugin config, fallback to localhost:8001.
 */
function owl_get_backend_url(): string {
    $url = get_config('mod_owl', 'backend_url')
        ?: getenv('OWL_BACKEND_URL')
        ?: 'http://localhost:8001';
    return rtrim($url, '/');
}

/**
 * Sends all PDF files of an Owl instance to the backend /upload-pdf endpoint
 * and returns the concatenated extracted text.
 *
 * @param int            $instanceid  The owl instance id (used as itemid in filearea).
 * @param context_module $context     The module context.
 * @return string Concatenated extracted text from all PDFs, empty string on failure.
 */
function owl_upload_pdfs_to_backend(int $instanceid, context_module $context): string {
    global $CFG;

    $fs    = get_file_storage();
    $files = $fs->get_area_files(
        $context->id,
        'mod_owl',
        'documents',
        $instanceid,
        'filename',
        false  // exclude directories
    );

    $backend_url = owl_get_backend_url();
    mtrace("owl: backend_url={$backend_url}, " . count($files) . " fichier(s) dans l'area");
    $texts       = [];

    foreach ($files as $file) {
        $filename = $file->get_filename();
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if ($ext !== 'pdf') {
            mtrace("owl: ignoré (extension={$ext}): {$filename}");
            continue;
        }

        mtrace("owl: traitement de {$filename} (" . $file->get_filesize() . " octets)");

        // Write to a temp file so curl can send it as a proper multipart upload.
        $tmpfile = tempnam($CFG->tempdir ?? sys_get_temp_dir(), 'owl_pdf_');
        try {
            $file->copy_content_to($tmpfile);
            mtrace("owl: fichier temporaire créé: {$tmpfile}");

            $ch = curl_init("{$backend_url}/upload-pdf");
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => [
                    'file' => new CURLFile($tmpfile, 'application/pdf', $filename),
                ],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 60,
            ]);

            mtrace("owl: envoi curl vers {$backend_url}/upload-pdf ...");
            $response  = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curl_err  = curl_error($ch);
            curl_close($ch);

            if ($curl_err) {
                mtrace("owl: erreur curl pour {$filename}: {$curl_err}");
                continue;
            }

            mtrace("owl: réponse HTTP {$http_code} pour {$filename}");

            if ($http_code !== 200) {
                mtrace("owl: réponse inattendue (body): " . substr($response, 0, 300));
                continue;
            }

            $data = json_decode($response, true);
            if (!empty($data['text'])) {
                mtrace("owl: texte extrait (" . strlen($data['text']) . " caractères)");
                $texts[] = "=== " . $filename . " ===\n" . $data['text'];
            } else {
                mtrace("owl: réponse 200 mais champ 'text' absent ou vide. Body: " . substr($response, 0, 300));
            }
        } finally {
            if (file_exists($tmpfile)) {
                unlink($tmpfile);
            }
        }
    }

    return implode("\n\n", $texts);
}
