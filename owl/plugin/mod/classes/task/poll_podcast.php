<?php
namespace mod_owl\task;

defined('MOODLE_INTERNAL') || die();

class poll_podcast extends \core\task\adhoc_task {

    /** Maximum number of polling attempts before giving up. */
    const MAX_ATTEMPTS = 20;

    public function execute() {
        global $DB, $CFG;

        require_once($CFG->dirroot . '/mod/owl/locallib.php');

        $data       = $this->get_custom_data();
        $instanceid = (int) $data->instanceid;
        $jobid      = $data->job_id;
        $attempt    = isset($data->attempt) ? (int) $data->attempt : 1;

        $maxattempts = self::MAX_ATTEMPTS;
        mtrace("owl poll_podcast: tentative {$attempt}/{$maxattempts} pour instance={$instanceid}, job_id={$jobid}");

        if ($attempt > self::MAX_ATTEMPTS) {
            mtrace("owl poll_podcast: nombre maximum de tentatives atteint, abandon.");
            $DB->set_field('owl', 'status', 'podcast_failed', ['id' => $instanceid]);
            return;
        }

        $statusurl = owl_get_backend_url() . '/podcast/job/' . urlencode($jobid);

        $ch = curl_init($statusurl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPGET        => true,
            CURLOPT_TIMEOUT        => 15,
        ]);

        $response = curl_exec($ch);
        $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlerr  = curl_error($ch);
        curl_close($ch);

        if ($curlerr) {
            mtrace("owl poll_podcast: erreur curl: {$curlerr}");
            $this->requeue($instanceid, $jobid, $attempt);
            return;
        }

        if ($httpcode === 404) {
            mtrace("owl poll_podcast: job_id={$jobid} introuvable sur le backend, abandon.");
            $DB->set_field('owl', 'status', 'podcast_failed', ['id' => $instanceid]);
            return;
        }

        if ($httpcode !== 200) {
            mtrace("owl poll_podcast: réponse HTTP {$httpcode}: {$response}");
            $this->requeue($instanceid, $jobid, $attempt);
            return;
        }

        $result = json_decode($response);
        if (!$result || empty($result->status)) {
            mtrace("owl poll_podcast: réponse invalide.");
            $this->requeue($instanceid, $jobid, $attempt);
            return;
        }

        switch ($result->status) {
            case 'completed':
                $audioendpoint = owl_get_backend_url() . '/podcast/job/' . urlencode($jobid) . '/audio';
                mtrace("owl poll_podcast: téléchargement du fichier audio depuis {$audioendpoint}");

                $tmpfile = tempnam($CFG->tempdir ?? sys_get_temp_dir(), 'owl_podcast_');
                $fh = fopen($tmpfile, 'wb');
                $ch = curl_init($audioendpoint);
                curl_setopt_array($ch, [
                    CURLOPT_FILE    => $fh,
                    CURLOPT_TIMEOUT => 120,
                ]);
                curl_exec($ch);
                $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlerr  = curl_error($ch);
                curl_close($ch);
                fclose($fh);

                if ($curlerr || $httpcode !== 200) {
                    unlink($tmpfile);
                    mtrace("owl poll_podcast: échec du téléchargement audio (HTTP {$httpcode}, err={$curlerr}), abandon.");
                    $DB->set_field('owl', 'status', 'podcast_failed', ['id' => $instanceid]);
                    return;
                }

                // Store the file in Moodle's file system.
                $cm      = get_coursemodule_from_instance('owl', $instanceid, 0, false, MUST_EXIST);
                $context = \context_module::instance($cm->id);
                $fs      = get_file_storage();

                // Remove any previous podcast file for this instance.
                $fs->delete_area_files($context->id, 'mod_owl', 'podcast', $instanceid);

                $audiofilename = $jobid . '.mp3';
                $filerecord = [
                    'contextid' => $context->id,
                    'component' => 'mod_owl',
                    'filearea'  => 'podcast',
                    'itemid'    => $instanceid,
                    'filepath'  => '/',
                    'filename'  => $audiofilename,
                ];
                $fs->create_file_from_pathname($filerecord, $tmpfile);
                unlink($tmpfile);

                $podcasturl = \moodle_url::make_pluginfile_url(
                    $context->id, 'mod_owl', 'podcast', $instanceid, '/', $audiofilename
                )->out();

                $DB->set_field('owl', 'podcast_url', $podcasturl, ['id' => $instanceid]);
                $DB->set_field('owl', 'status', 'podcast_ready', ['id' => $instanceid]);
                rebuild_course_cache($cm->course, true);
                mtrace("owl poll_podcast: podcast stocké dans Moodle, url={$podcasturl}");
                break;

            case 'failed':
                $error = $result->error ?? 'inconnu';
                mtrace("owl poll_podcast: génération échouée sur le backend: {$error}");
                $DB->set_field('owl', 'status', 'podcast_failed', ['id' => $instanceid]);
                break;

            case 'pending':
            case 'processing':
                mtrace("owl poll_podcast: statut={$result->status}, nouvelle tentative dans 30s.");
                $this->requeue($instanceid, $jobid, $attempt);
                break;

            default:
                mtrace("owl poll_podcast: statut inconnu: {$result->status}, nouvelle tentative.");
                $this->requeue($instanceid, $jobid, $attempt);
        }
    }

    private function requeue(int $instanceid, string $jobid, int $attempt): void {
        $task = new self();
        $task->set_custom_data([
            'instanceid' => $instanceid,
            'job_id'     => $jobid,
            'attempt'    => $attempt + 1,
        ]);
        $task->set_next_run_time(time() + 30);
        \core\task\manager::queue_adhoc_task($task);
    }
}
