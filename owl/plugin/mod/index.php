<?php
require_once(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT); // course id

$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);

require_login($course);
$context = context_course::instance($id);

$PAGE->set_url('/mod/owl/index.php', ['id' => $id]);
$PAGE->set_title($course->fullname);
$PAGE->set_heading($course->fullname);
$PAGE->set_pagelayout('incourse');

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('pluginname', 'mod_owl'));

$instances = $DB->get_records('owl', ['course' => $id], 'timemodified DESC');

if (empty($instances)) {
    echo html_writer::tag('p', get_string('no_instances', 'mod_owl'));
} else {
    $table = new html_table();
    $table->head = [get_string('name'), get_string('form_type', 'mod_owl'), get_string('status', 'mod_owl')];
    foreach ($instances as $owl) {
        $cm = get_coursemodule_from_instance('owl', $owl->id, $course->id);
        $link = html_writer::link(
            new moodle_url('/mod/owl/view.php', ['id' => $cm->id]),
            format_string($owl->name)
        );
        $table->data[] = [
            $link,
            get_string('type_' . $owl->type, 'mod_owl'),
            get_string('status_' . $owl->status, 'mod_owl'),
        ];
    }
    echo html_writer::table($table);
}

echo $OUTPUT->footer();
