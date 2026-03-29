<?php
defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {
    // --- Podcast ---
    $settings->add(new admin_setting_heading(
        'block_owl/podcast_heading',
        get_string('settings_podcast_heading', 'block_owl'),
        ''
    ));

    $settings->add(new admin_setting_configselect(
        'block_owl/podcast_provider',
        get_string('settings_podcast_provider', 'block_owl'),
        get_string('settings_podcast_provider_desc', 'block_owl'),
        'none',
        [
            'none'    => get_string('settings_provider_none', 'block_owl'),
            'elevenlabs' => 'ElevenLabs',
            'google'  => 'Google',
            'nvidia'  => 'Nvidia',
        ]
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'block_owl/podcast_apikey',
        get_string('settings_podcast_apikey', 'block_owl'),
        get_string('settings_apikey_desc', 'block_owl'),
        ''
    ));

    // --- Vidéo ---
    $settings->add(new admin_setting_heading(
        'block_owl/video_heading',
        get_string('settings_video_heading', 'block_owl'),
        ''
    ));

    $settings->add(new admin_setting_configselect(
        'block_owl/video_provider',
        get_string('settings_video_provider', 'block_owl'),
        get_string('settings_video_provider_desc', 'block_owl'),
        'none',
        [
            'none'   => get_string('settings_provider_none', 'block_owl'),
            'kling'  => 'Kling',
            'google' => 'Google',
            'sora'   => 'Sora',
        ]
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'block_owl/video_apikey',
        get_string('settings_video_apikey', 'block_owl'),
        get_string('settings_apikey_desc', 'block_owl'),
        ''
    ));

    // --- QCM ---
    $settings->add(new admin_setting_heading(
        'block_owl/qcm_heading',
        get_string('settings_qcm_heading', 'block_owl'),
        ''
    ));

    $settings->add(new admin_setting_configselect(
        'block_owl/qcm_provider',
        get_string('settings_qcm_provider', 'block_owl'),
        get_string('settings_qcm_provider_desc', 'block_owl'),
        'none',
        [
            'none'    => get_string('settings_provider_none', 'block_owl'),
            'google'  => 'Google',
            'openai'  => 'OpenAI',
            'mistral' => 'Mistral',
        ]
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'block_owl/qcm_apikey',
        get_string('settings_qcm_apikey', 'block_owl'),
        get_string('settings_apikey_desc', 'block_owl'),
        ''
    ));

}
