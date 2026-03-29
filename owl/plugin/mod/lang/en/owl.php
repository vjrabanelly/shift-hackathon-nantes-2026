<?php
defined('MOODLE_INTERNAL') || die();

$string['pluginname']          = 'Owl';
$string['modulename']          = 'Owl';
$string['modulenameplural']    = 'Owls';
$string['modulename_help']     = 'Génère des ressources pédagogiques (podcast, vidéo, QCM) à partir de documents de cours.';
$string['owl:addinstance']     = 'Ajouter une activité Owl';
$string['owl:view']            = 'Voir une activité Owl';

// Types
$string['form_type']    = 'Type de génération';
$string['type_podcast'] = 'Shortcast';
$string['type_video']   = 'Vidéo';
$string['type_qcm']     = 'QCM';
$string['type_summary'] = 'Résumé';
$string['type_discussion'] = 'Discussion';

// Descriptions des types
$string['type_podcast_desc']    = 'Génère un audio court (2 minutes) au format dialogue entre deux personnages, idéal pour découvrir un concept clé de façon engageante.';
$string['type_video_desc']      = 'Crée une vidéo pédagogique de 1 à 2 minutes pour aborder une notion clé d\'ensemble de documents.';
$string['type_qcm_desc']        = 'Produit un questionnaire à choix multiples avec correction automatique, pour évaluer la compréhension des apprenants.';
$string['type_summary_desc']    = 'Rédige une synthèse structurée du contenu fourni, reprenant les points essentiels du cours.';
$string['type_discussion_desc'] = 'Propose une interface de discussion permettant de questionner un ensemble de documents.';

// Formulaire
$string['form_section']              = 'Section du cours';
$string['form_prompt']               = 'Prompt (optionnel)';
$string['form_prompt_help']          = 'Décrivez ce que vous souhaitez générer, les points à couvrir, le ton, le public cible, etc.';
$string['form_course_resources']     = 'Ressources du cours';
$string['form_course_resources_none']= 'Aucune ressource sélectionnée';
$string['form_documents']            = 'Documents à uploader';
$string['form_sources_required']     = 'Veuillez sélectionner au moins une ressource du cours ou uploader un document.';

// États
$string['status']          = 'Statut';
$string['status_pending']  = 'En cours';
$string['status_done']     = 'Terminé';
$string['status_error']    = 'Erreur';

// Page de résultat (view.php)
$string['pending_message']    = 'Votre contenu est en cours de génération. Cela peut prendre quelques minutes.';
$string['pending_hint']       = 'Le contenu sera automatiquement ajouté à votre cours dès qu\'il sera prêt.';
$string['generating_message'] = 'Votre podcast est en cours de génération.';
$string['generating_hint']    = 'Cette étape peut prendre quelques minutes. La page se rafraîchira automatiquement.';
$string['podcast_failed']     = 'La génération du podcast a échoué. Veuillez contacter un administrateur.';
$string['qcm_failed']         = 'La génération du QCM a échoué. Veuillez contacter un administrateur.';
$string['summary_failed']     = 'La génération du résumé a échoué. Veuillez contacter un administrateur.';
$string['qcm_ready_inline']   = 'Le QCM est prêt. Cliquez pour le consulter.';
$string['qcm_check']          = 'Vérifier mes réponses';

// index.php
$string['no_instances'] = 'Aucune génération Owl dans ce cours.';
