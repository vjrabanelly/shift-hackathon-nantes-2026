<?php
// Le nom de la classe DOIT correspondre exactement au nom du fichier.
// Convention Moodle : block_<nom_du_dossier>
class block_owl extends block_base {

    // Initialisation du bloc : définit son titre affiché dans l'interface.
    public function init() {
        $this->title = get_string('pluginname', 'block_owl');
    }

    // Contenu HTML affiché dans le bloc.
    // Doit retourner un objet stdClass avec une propriété 'text'.
    public function get_content() {
        global $COURSE;

        if ($this->content !== null) {
            return $this->content;
        }

        $this->content = new stdClass();
        $this->content->footer = '';

        $generateurl = new moodle_url('/course/modedit.php', [
            'add'     => 'owl',
            'type'    => 0,
            'course'  => $COURSE->id,
            'section' => 0,
            'return'  => 0,
        ]);

        $this->content->text = html_writer::link(
            $generateurl,
            get_string('form_submit', 'block_owl'),
            ['class' => 'btn btn-primary btn-block']
        );

        return $this->content;
    }

    // Indique à Moodle que ce bloc possède une page de configuration admin.
    public function has_config() {
        return true;
    }

    // Sur quels types de pages ce bloc peut-il apparaître ?
    // 'course-view-*' = toutes les pages de cours (format topics, weeks, etc.)
    public function applicable_formats() {
        return [
            'course-view' => true,  // pages de cours ✅
            'site'        => true,  // page d'accueil ✅
            'my'          => false, // tableau de bord ❌
        ];
    }
}
