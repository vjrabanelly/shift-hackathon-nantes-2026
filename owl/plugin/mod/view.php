<?php
require_once(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT); // course module id

$cm     = get_coursemodule_from_id('owl', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$owl    = $DB->get_record('owl', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);
$context = context_module::instance($cm->id);

$PAGE->set_url('/mod/owl/view.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($owl->name));
$PAGE->set_heading($course->fullname);
$PAGE->set_pagelayout('incourse');

echo $OUTPUT->header();
echo $OUTPUT->heading(format_string($owl->name));

if ($owl->status === 'podcast_ready' && !empty($owl->podcast_url)) {
    echo html_writer::tag('audio', '', [
        'controls'    => 'controls',
        'src'         => $owl->podcast_url,
        'style'       => 'width:100%;margin-top:1em;',
    ]);
} else if ($owl->status === 'podcast_failed') {
    echo html_writer::div(
        html_writer::tag('p', get_string('podcast_failed', 'mod_owl')),
        'alert alert-danger'
    );
} else if ($owl->status === 'qcm_ready' && !empty($owl->qcm_data)) {
    $qcm = json_decode($owl->qcm_data, true);
    if (!empty($qcm['questions'])) {
        $html = '<form id="owl-qcm-form" class="owl-qcm">';
        foreach ($qcm['questions'] as $qi => $q) {
            $html .= '<div class="owl-qcm-question" data-answer="' . s($q['answer']) . '" data-explanation="' . s($q['explanation']) . '">';
            $html .= '<p class="owl-qcm-q"><strong>' . ($qi + 1) . '. ' . s($q['question']) . '</strong></p>';
            $html .= '<ul class="owl-qcm-options list-unstyled">';
            foreach ($q['options'] as $option) {
                $optid = 'q' . $qi . '_opt_' . md5($option);
                $html .= '<li><label><input type="radio" name="q' . $qi . '" value="' . s($option) . '" id="' . $optid . '"> ' . s($option) . '</label></li>';
            }
            $html .= '</ul>';
            $html .= '<div class="owl-qcm-feedback" style="display:none;"></div>';
            $html .= '</div>';
        }
        $html .= '<button type="button" id="owl-qcm-submit" class="btn btn-primary mt-3">' . get_string('qcm_check', 'mod_owl') . '</button>';
        $html .= '<div id="owl-qcm-score" class="mt-3" style="display:none;"></div>';
        $html .= '</form>';

        echo $html;

        $PAGE->requires->js_amd_inline("
            document.getElementById('owl-qcm-submit').addEventListener('click', function() {
                var questions = document.querySelectorAll('.owl-qcm-question');
                var score = 0;
                questions.forEach(function(qEl, idx) {
                    var selected = qEl.querySelector('input[type=radio]:checked');
                    var feedback = qEl.querySelector('.owl-qcm-feedback');
                    var answer = qEl.dataset.answer;
                    var explanation = qEl.dataset.explanation;
                    feedback.style.display = 'block';
                    if (!selected) {
                        feedback.innerHTML = '<div class=\"alert alert-warning\">No answer selected.</div>';
                        return;
                    }
                    if (selected.value.startsWith(answer + ':') || selected.value.startsWith(answer + ' ') || selected.value === answer) {
                        score++;
                        feedback.innerHTML = '<div class=\"alert alert-success\">Correct! ' + explanation + '</div>';
                    } else {
                        feedback.innerHTML = '<div class=\"alert alert-danger\">Wrong. Correct answer: <strong>' + answer + '</strong>. ' + explanation + '</div>';
                    }
                });
                var total = questions.length;
                var scoreEl = document.getElementById('owl-qcm-score');
                scoreEl.style.display = 'block';
                scoreEl.innerHTML = '<div class=\"alert alert-info\"><strong>Score: ' + score + ' / ' + total + '</strong></div>';
                document.getElementById('owl-qcm-submit').disabled = true;
            });
        ");
    }
} else if ($owl->status === 'summary_ready' && !empty($owl->summary_data)) {
    echo html_writer::div(format_text($owl->summary_data, FORMAT_MARKDOWN), 'owl-summary card card-body');
} else if ($owl->status === 'summary_failed') {
    echo html_writer::div(
        html_writer::tag('p', get_string('summary_failed', 'mod_owl')),
        'alert alert-danger'
    );
} else if ($owl->status === 'qcm_failed') {
    echo html_writer::div(
        html_writer::tag('p', get_string('qcm_failed', 'mod_owl')),
        'alert alert-danger'
    );
} else {
    // pending / ready / generating : afficher le message d'attente et rafraîchir
    $message = in_array($owl->status, ['ready', 'generating'])
        ? get_string('generating_message', 'mod_owl') . html_writer::tag('p', get_string('generating_hint', 'mod_owl'))
        : get_string('pending_message', 'mod_owl') . html_writer::tag('p', get_string('pending_hint', 'mod_owl'));

    echo html_writer::div(html_writer::tag('p', $message), 'alert alert-info');

    $PAGE->requires->js_amd_inline("
        setTimeout(function() { window.location.reload(); }, 15000);
    ");
}

echo $OUTPUT->footer();
