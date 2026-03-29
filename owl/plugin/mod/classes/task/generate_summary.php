<?php
namespace mod_owl\task;

defined('MOODLE_INTERNAL') || die();

class generate_summary extends \core\task\adhoc_task {

    public function execute() {
        global $DB, $CFG;

        require_once($CFG->dirroot . '/mod/owl/locallib.php');

        $data       = $this->get_custom_data();
        $instanceid = (int) $data->instanceid;

        mtrace("owl generate_summary: démarrage pour instance={$instanceid}");

        $record = $DB->get_record('owl', ['id' => $instanceid], 'id, extracted_text', MUST_EXIST);

        if (empty($record->extracted_text)) {
            mtrace("owl generate_summary: aucun texte extrait disponible, abandon.");
            return;
        }

        $backendurl = owl_get_backend_url() . '/summarize';

        $ch = curl_init($backendurl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query(['text' => $record->extracted_text]),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT        => 120,
        ]);

        $response = curl_exec($ch);
        $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlerr  = curl_error($ch);
        curl_close($ch);

        if ($curlerr) {
            mtrace("owl generate_summary: erreur curl: {$curlerr}");
            $DB->set_field('owl', 'status', 'summary_failed', ['id' => $instanceid]);
            return;
        }

        if ($httpcode !== 200) {
            mtrace("owl generate_summary: réponse HTTP {$httpcode}: {$response}");
            $DB->set_field('owl', 'status', 'summary_failed', ['id' => $instanceid]);
            return;
        }

        $result = json_decode($response, true);
        if (empty($result['summary'])) {
            mtrace("owl generate_summary: réponse invalide ou champ 'summary' manquant.");
            $DB->set_field('owl', 'status', 'summary_failed', ['id' => $instanceid]);
            return;
        }

        $DB->set_field('owl', 'summary_data', $result['summary'], ['id' => $instanceid]);
        $DB->set_field('owl', 'status', 'summary_ready', ['id' => $instanceid]);

        $cm = get_coursemodule_from_instance('owl', $instanceid, 0, false, MUST_EXIST);
        rebuild_course_cache($cm->course, true);
        mtrace("owl generate_summary: résumé enregistré, status=summary_ready");
    }
}
