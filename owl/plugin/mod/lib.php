<?php
defined('MOODLE_INTERNAL') || die();

require_once(__DIR__ . '/locallib.php');

function owl_add_instance($data, $mform = null) {
    global $DB;

    // Nom par défaut si le prof n'a rien saisi
    if (empty(trim($data->name))) {
        $typenames = [
            'podcast' => get_string('type_podcast',  'mod_owl'),
            'video'   => get_string('type_video',    'mod_owl'),
            'qcm'     => get_string('type_qcm',      'mod_owl'),
            'summary' => get_string('type_summary',  'mod_owl'),
        ];
        $data->name = $typenames[$data->type] ?? ucfirst($data->type);
    }

    $data->timecreated  = time();
    $data->timemodified = time();
    $data->status       = 'pending';

    $instanceid = $DB->insert_record('owl', $data);

    if ($mform) {
        $context = context_module::instance($data->coursemodule);
        file_save_draft_area_files(
            $data->documents,
            $context->id,
            'mod_owl',
            'documents',
            $instanceid,
            ['subdirs' => 0, 'maxfiles' => 20]
        );

        $task = new \mod_owl\task\upload_pdfs();
        $task->set_custom_data(['instanceid' => $instanceid, 'contextid' => $context->id]);
        \core\task\manager::queue_adhoc_task($task);
    }

    return $instanceid;
}

function owl_update_instance($data, $mform = null) {
    global $DB;

    $data->timemodified = time();
    $data->id = $data->instance;

    $result = $DB->update_record('owl', $data);

    if ($mform) {
        $context = context_module::instance($data->coursemodule);
        file_save_draft_area_files(
            $data->documents,
            $context->id,
            'mod_owl',
            'documents',
            $data->id,
            ['subdirs' => 0, 'maxfiles' => 20]
        );

        $task = new \mod_owl\task\upload_pdfs();
        $task->set_custom_data(['instanceid' => $data->id, 'contextid' => $context->id]);
        \core\task\manager::queue_adhoc_task($task);
    }

    return $result;
}

function owl_delete_instance($id) {
    global $DB;

    if (!$instance = $DB->get_record('owl', ['id' => $id])) {
        return false;
    }

    $DB->delete_records('owl', ['id' => $id]);

    return true;
}

function mod_owl_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, array $options = []) {
    require_login($course, true, $cm);

    if ($filearea !== 'podcast' && $filearea !== 'documents') {
        return false;
    }

    $itemid   = array_shift($args);
    $filename = array_pop($args);
    $filepath = $args ? '/' . implode('/', $args) . '/' : '/';

    $fs   = get_file_storage();
    $file = $fs->get_file($context->id, 'mod_owl', $filearea, $itemid, $filepath, $filename);
    if (!$file) {
        return false;
    }

    send_stored_file($file, 0, 0, $forcedownload, $options);
}

function owl_supports($feature) {
    switch ($feature) {
        case FEATURE_MOD_INTRO:
            return true;
        case FEATURE_BACKUP_MOODLE2:
            return false;
        default:
            return null;
    }
}

function owl_get_coursemodule_info($cm) {
    global $DB;

    $owl = $DB->get_record('owl', ['id' => $cm->instance], 'id, name, status, podcast_url, summary_data');
    if (!$owl) {
        return null;
    }

    $info = new cached_cm_info();
    $info->name = $owl->name;

    if ($owl->status === 'podcast_ready' && !empty($owl->podcast_url)) {
        $info->content = html_writer::tag('audio', '', [
            'controls' => 'controls',
            'src'      => $owl->podcast_url,
            'style'    => 'width:100%;margin-top:0.5em;',
        ]);
    } elseif ($owl->status === 'podcast_failed') {
        $info->content = html_writer::div(
            get_string('podcast_failed', 'mod_owl'),
            'alert alert-danger'
        );
    } elseif ($owl->status === 'qcm_failed') {
        $info->content = html_writer::div(
            get_string('qcm_failed', 'mod_owl'),
            'alert alert-danger'
        );
    } elseif ($owl->status === 'summary_failed') {
        $info->content = html_writer::div(
            get_string('summary_failed', 'mod_owl'),
            'alert alert-danger'
        );
    } elseif ($owl->status === 'summary_ready' && !empty($owl->summary_data)) {
        # $info->content = html_writer::div(format_text($owl->summary_data, FORMAT_MARKDOWN), 'owl-summary card card-body mt-2');
        # $info->customdata = ['no_view_link' => true];
    } elseif ($owl->status === 'qcm_ready') {
        // QCM content is interactive, shown in view.php only
    } else {
        $info->content = html_writer::div(
            get_string('pending_message', 'mod_owl'),
            'alert alert-info'
        );
    }

    return $info;
}

function owl_cm_info_dynamic(cm_info $cm) {
    if (!empty($cm->customdata['no_view_link'])) {
        $cm->set_no_view_link();
    }
}
