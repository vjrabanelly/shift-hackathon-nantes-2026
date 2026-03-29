<?php
namespace mod_owl\task;

defined('MOODLE_INTERNAL') || die();

class generate_podcast extends \core\task\adhoc_task {

    public function execute() {
        global $DB, $CFG;

        require_once($CFG->dirroot . '/mod/owl/locallib.php');

        $data       = $this->get_custom_data();
        $instanceid = (int) $data->instanceid;

        mtrace("owl generate_podcast: démarrage pour instance={$instanceid}");

        $record = $DB->get_record('owl', ['id' => $instanceid], 'id, extracted_text', MUST_EXIST);

        if (empty($record->extracted_text)) {
            mtrace("owl generate_podcast: aucun texte extrait disponible, abandon.");
            return;
        }

        $backendurl = owl_get_backend_url() . '/generate-podcast';

        $ch = curl_init($backendurl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'text'     => $record->extracted_text,
                'mode'     => 'duo',
            ]),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT        => 30,
        ]);

        $response = curl_exec($ch);
        $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlerr  = curl_error($ch);
        curl_close($ch);

        if ($curlerr) {
            mtrace("owl generate_podcast: erreur curl: {$curlerr}");
            return;
        }

        if ($httpcode !== 200) {
            mtrace("owl generate_podcast: réponse HTTP {$httpcode}: {$response}");
            return;
        }

        $result = json_decode($response);
        if (!$result || empty($result->job_id)) {
            mtrace("owl generate_podcast: réponse invalide ou job_id manquant.");
            return;
        }

        $DB->set_field('owl', 'podcast_job_id', $result->job_id, ['id' => $instanceid]);
        $DB->set_field('owl', 'status', 'generating', ['id' => $instanceid]);
        mtrace("owl generate_podcast: job soumis, job_id={$result->job_id}");

        $task = new \mod_owl\task\poll_podcast();
        $task->set_custom_data(['instanceid' => $instanceid, 'job_id' => $result->job_id]);
        $task->set_next_run_time(time() + 30);
        \core\task\manager::queue_adhoc_task($task);
        mtrace("owl generate_podcast: tâche poll_podcast enfilée.");
    }
}
