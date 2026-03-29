<?php
namespace mod_owl\task;

defined('MOODLE_INTERNAL') || die();

class upload_pdfs extends \core\task\adhoc_task {

    public function execute() {
        global $DB, $CFG;

        require_once($CFG->dirroot . '/mod/owl/locallib.php');

        $data       = $this->get_custom_data();
        $instanceid = (int) $data->instanceid;
        $contextid  = (int) $data->contextid;

        mtrace("owl upload_pdfs: démarrage pour instance={$instanceid}, context={$contextid}");

        $context = \context::instance_by_id($contextid, IGNORE_MISSING);
        if (!$context) {
            mtrace("owl upload_pdfs: context {$contextid} introuvable, abandon.");
            return;
        }
        mtrace("owl upload_pdfs: context OK ({$context->contextlevel})");

        $extracted_text = owl_upload_pdfs_to_backend($instanceid, $context);
        mtrace("owl upload_pdfs: texte extrait = " . strlen($extracted_text) . " caractères");

        if ($extracted_text !== '') {
            $DB->set_field('owl', 'extracted_text', $extracted_text, ['id' => $instanceid]);
            $DB->set_field('owl', 'status', 'ready', ['id' => $instanceid]);
            mtrace("owl upload_pdfs: BDD mise à jour, status=ready");

            $type = $DB->get_field('owl', 'type', ['id' => $instanceid]);

            if ($type === 'qcm') {
                $task = new \mod_owl\task\generate_qcm();
                $task->set_custom_data(['instanceid' => $instanceid]);
                \core\task\manager::queue_adhoc_task($task);
                mtrace("owl upload_pdfs: tâche generate_qcm enfilée.");
            } else if ($type === 'summary') {
                $task = new \mod_owl\task\generate_summary();
                $task->set_custom_data(['instanceid' => $instanceid]);
                \core\task\manager::queue_adhoc_task($task);
                mtrace("owl upload_pdfs: tâche generate_summary enfilée.");
            } else {
                $task = new \mod_owl\task\generate_podcast();
                $task->set_custom_data(['instanceid' => $instanceid]);
                \core\task\manager::queue_adhoc_task($task);
                mtrace("owl upload_pdfs: tâche generate_podcast enfilée.");
            }
        } else {
            mtrace("owl upload_pdfs: aucun texte extrait, BDD inchangée");
        }
    }
}
