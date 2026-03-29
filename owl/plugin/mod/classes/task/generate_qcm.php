<?php
namespace mod_owl\task;

defined('MOODLE_INTERNAL') || die();

class generate_qcm extends \core\task\adhoc_task {

    public function execute() {
        global $DB, $CFG;

        require_once($CFG->dirroot . '/mod/owl/locallib.php');

        $data       = $this->get_custom_data();
        $instanceid = (int) $data->instanceid;

        mtrace("owl generate_qcm: démarrage pour instance={$instanceid}");

        $record = $DB->get_record('owl', ['id' => $instanceid], 'id, extracted_text', MUST_EXIST);

        if (empty($record->extracted_text)) {
            mtrace("owl generate_qcm: aucun texte extrait disponible, abandon.");
            return;
        }

        $backendurl = owl_get_backend_url() . '/generate-exercises';

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
            mtrace("owl generate_qcm: erreur curl: {$curlerr}");
            $DB->set_field('owl', 'status', 'qcm_failed', ['id' => $instanceid]);
            return;
        }

        if ($httpcode !== 200) {
            mtrace("owl generate_qcm: réponse HTTP {$httpcode}: {$response}");
            $DB->set_field('owl', 'status', 'qcm_failed', ['id' => $instanceid]);
            return;
        }

        $result = json_decode($response, true);
        if (empty($result['exercises'])) {
            mtrace("owl generate_qcm: réponse invalide ou champ 'exercises' manquant.");
            $DB->set_field('owl', 'status', 'qcm_failed', ['id' => $instanceid]);
            return;
        }

        $DB->set_field('owl', 'qcm_data', $result['exercises'], ['id' => $instanceid]);
        $DB->set_field('owl', 'status', 'qcm_ready', ['id' => $instanceid]);

        $cm = get_coursemodule_from_instance('owl', $instanceid, 0, false, MUST_EXIST);
        rebuild_course_cache($cm->course, true);
        mtrace("owl generate_qcm: QCM enregistré, status=qcm_ready");
    }
}
