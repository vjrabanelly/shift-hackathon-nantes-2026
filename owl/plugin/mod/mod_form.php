<?php
defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');

class mod_owl_mod_form extends moodleform_mod {

    public function definition() {
        global $COURSE, $DB, $PAGE;
        $mform = $this->_form;

        // Type de génération — select caché + boutons visuels synchronisés
        $types = [
            'podcast' => get_string('type_podcast',  'mod_owl'),
            'video'   => get_string('type_video',    'mod_owl'),
            'qcm'     => get_string('type_qcm',      'mod_owl'),
            'summary' => get_string('type_summary',  'mod_owl'),
            // 'discussion' => get_string('type_discussion', 'mod_owl'),
        ];
        $mform->addElement('select', 'type', get_string('form_type', 'mod_owl'), $types);
        $mform->setType('type', PARAM_ALPHA);
        $mform->setDefault('type', 'podcast');

        // Boutons visuels (le select reste caché, c'est lui qui est soumis)
        $btns = '';
        foreach ($types as $value => $label) {
            $btns .= '<button type="button" class="owl-type-btn" data-value="' . s($value) . '">' . s($label) . '</button>';
        }
        $mform->addElement('html', '<div id="owl-type-btns">' . $btns . '</div>');

        // Descriptions par type
        $typedescs = [
            'podcast'    => get_string('type_podcast_desc',    'mod_owl'),
            'video'      => get_string('type_video_desc',      'mod_owl'),
            'qcm'        => get_string('type_qcm_desc',        'mod_owl'),
            'summary'    => get_string('type_summary_desc',    'mod_owl'),
            'discussion' => get_string('type_discussion_desc', 'mod_owl'),
        ];
        $descdivs = '';
        foreach ($typedescs as $value => $desc) {
            $descdivs .= '<p class="owl-type-desc" data-type="' . s($value) . '" style="display:none;">' . s($desc) . '</p>';
        }
        $mform->addElement('html', '<div id="owl-type-descs">' . $descdivs . '</div>');

        // En-tête général + Nom (sans required — fallback dans owl_add_instance)
        
        $mform->addElement('text', 'name', get_string('name'), ['size' => '64']);
        $mform->addRule('name', get_string('maximumchars', '', 255), 'maxlength', 255, 'client');
        $mform->setType('name', PARAM_TEXT);

        // JS : auto-remplit le nom selon le type si le prof ne l'a pas saisi manuellement
        $typelabels = json_encode([
            'podcast' => get_string('type_podcast',  'mod_owl'),
            'video'   => get_string('type_video',    'mod_owl'),
            'qcm'     => get_string('type_qcm',      'mod_owl'),
            'summary' => get_string('type_summary',  'mod_owl'),
            'discussion' => get_string('type_discussion', 'mod_owl'),
        ]);
        $PAGE->requires->js_amd_inline("
            require(['jquery'], function(\$) {
                var labels   = $typelabels;
                var nameEl   = \$('#id_name');
                var selectEl = \$('#id_type');
                var btns     = \$('#owl-type-btns .owl-type-btn');
                var descs    = \$('#owl-type-descs .owl-type-desc');
                var autoFill = nameEl.val() === '';

                function updateActive(val) {
                    btns.each(function() {
                        \$(this).toggleClass('owl-type-active', \$(this).data('value') === val);
                    });
                    descs.each(function() {
                        \$(this).toggle(\$(this).data('type') === val);
                    });
                }

                btns.on('click', function() {
                    var val = \$(this).data('value');
                    selectEl.val(val);
                    updateActive(val);
                    if (autoFill) { nameEl.val(labels[val] || ''); }
                });

                nameEl.on('input', function() { autoFill = false; });

                updateActive(selectEl.val());
                if (autoFill) { nameEl.val(labels[selectEl.val()] || ''); }
            });
        ");

        // Ressources existantes du cours
        $allowed_modtypes = ['resource', 'page', 'label', 'url', 'folder'];
        $modinfo = get_fast_modinfo($COURSE);
        $course_resources = [];
        foreach ($modinfo->cms as $cm) {
            if (in_array($cm->modname, $allowed_modtypes) && $cm->uservisible) {
                $course_resources[$cm->id] = '[' . $cm->modname . '] ' . $cm->name;
            }
        }

        // Prompt
        $mform->addElement('textarea', 'prompt', get_string('form_prompt', 'mod_owl'), ['rows' => 4, 'cols' => 60]);
        $mform->setType('prompt', PARAM_TEXT);
        $mform->addHelpButton('prompt', 'form_prompt', 'mod_owl');

        if (!empty($course_resources)) {
          $mform->addElement(
              'autocomplete',
              'course_resources',
              get_string('form_course_resources', 'mod_owl'),
              $course_resources,
              ['multiple' => true, 'noselectionstring' => get_string('form_course_resources_none', 'mod_owl')]
          );
      }

        // Upload de documents
        $options = [
            // 'subdirs'        => 0,
            // 'maxfiles'       => 20,
            // 'accepted_types' => ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx', '.odt', '.odp'],
        ];
        $mform->addElement('filemanager', 'documents', get_string('form_documents', 'mod_owl'), null, $options);
        $mform->addElement('header', 'general', get_string('general', 'form'));
        // Éléments standard Moodle (visible, groupe, etc.)
        $this->standard_coursemodule_elements();

        // Cache les sections indésirables via CSS
        $PAGE->requires->js_amd_inline("
            require([], function() {
                var style = document.createElement('style');
                style.textContent = [
                    '#id_modstandardelshdr, #id_restrictshdr, #id_completionhdr, #id_tagshdr, #id_competencieshdr, #id_availabilityconditionsheader, #id_activitycompletionheader, #id_competenciessection, #id_general, .expandall, .secondary-navigation, .fp-restrictions, .fp-navbar { display: none !important; }',
                    '#id_type { display: none !important; }',
                    '#id_type ~ label { display: none !important; }',
                    '.fitem:has(#id_type) .fitemtitle { display: none !important; }',
                    '#owl-type-btns { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }',
                    '.owl-type-btn { padding: 6px 18px; border: 2px solid #0066cc; border-radius: 20px; background: none; color: #0066cc; font-weight: 500; cursor: pointer; transition: background 0.15s, color 0.15s; }',
                    '.owl-type-btn.owl-type-active { background: #0066cc; color: #fff; }',
                    '#owl-type-descs { margin-top: 8px; margin-bottom: 4px; }',
                    '.owl-type-desc { color: #555; font-size: 0.92em; font-style: italic; margin: 0; }'
                ].join(' ');
                document.head.appendChild(style);
            });
        ");

        // Remplace le champ section caché par un sélecteur visible positionné sous le type
        $mform->removeElement('section');
        $rawsections = $DB->get_records('course_sections', ['course' => $COURSE->id], 'section ASC', 'section, name');
        $sections = [];
        foreach ($rawsections as $sec) {
            $sections[$sec->section] = $sec->name ?: get_string('section') . ' ' . $sec->section;
        }
        $sectionel = $mform->createElement('select', 'section', get_string('form_section', 'mod_owl'), $sections);
        $mform->insertElementBefore($sectionel, 'general');
        $mform->setType('section', PARAM_INT);
        $mform->setDefault('section', $this->current->section ?? 0);

        $this->add_action_buttons();
    }

    public function data_preprocessing(&$defaultvalues) {
        parent::data_preprocessing($defaultvalues);

        // Prépare la draft area pour le filemanager en mode édition
        $draftitemid = file_get_submitted_draft_itemid('documents');
        if (!empty($this->current->instance)) {
            $context = context_module::instance($this->current->coursemodule);
            file_prepare_draft_area(
                $draftitemid,
                $context->id,
                'mod_owl',
                'documents',
                $this->current->instance,
                ['subdirs' => 0, 'maxfiles' => 20]
            );
        }
        $defaultvalues['documents'] = $draftitemid;
    }

    public function validation($data, $files) {
        $errors = parent::validation($data, $files);

        $hasresources = !empty($data['course_resources']);
        $hasdocs = !empty($data['documents']) && $data['documents'] != 0;

        if (!$hasresources && !$hasdocs) {
            $errors['documents'] = get_string('form_sources_required', 'mod_owl');
        }

        return $errors;
    }
}
