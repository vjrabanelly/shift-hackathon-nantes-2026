<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_owl_upgrade($oldversion) {
    global $DB;
    $dbman = $DB->get_manager();

    if ($oldversion < 2024010102) {
        $table = new xmldb_table('owl');
        $field = new xmldb_field('extracted_text', XMLDB_TYPE_TEXT, null, null, null, null, null, 'status');

        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_mod_savepoint(true, 2024010102, 'owl');
    }

    if ($oldversion < 2024010103) {
        $table = new xmldb_table('owl');
        $field = new xmldb_field('podcast_url', XMLDB_TYPE_CHAR, '255', null, null, null, null, 'extracted_text');

        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_mod_savepoint(true, 2024010103, 'owl');
    }

    if ($oldversion < 2024010104) {
        $table = new xmldb_table('owl');
        $field = new xmldb_field('podcast_job_id', XMLDB_TYPE_CHAR, '36', null, null, null, null, 'extracted_text');

        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_mod_savepoint(true, 2024010104, 'owl');
    }

    if ($oldversion < 2024010107) {
        $table = new xmldb_table('owl');
        $field = new xmldb_field('qcm_data', XMLDB_TYPE_TEXT, null, null, null, null, null, 'podcast_url');

        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_mod_savepoint(true, 2024010107, 'owl');
    }

    if ($oldversion < 2024010108) {
        $table = new xmldb_table('owl');
        $field = new xmldb_field('summary_data', XMLDB_TYPE_TEXT, null, null, null, null, null, 'qcm_data');

        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_mod_savepoint(true, 2024010108, 'owl');
    }

    return true;
}
