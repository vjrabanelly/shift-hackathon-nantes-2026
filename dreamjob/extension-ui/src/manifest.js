var manifest = {
    manifest_version: 3,
    name: 'DreamJob',
    description: 'AI-assisted job application companion for LinkedIn demos.',
    version: '0.1.0',
    icons: {
        16: 'dream-job-option-1-icon-16.png',
        32: 'dream-job-option-1-icon-32.png',
        48: 'dream-job-option-1-icon-48.png',
        128: 'dream-job-option-1-icon-128.png',
    },
    action: {
        default_title: 'DreamJob',
        default_popup: 'popup.html',
        default_icon: {
            16: 'dream-job-option-1-icon-16.png',
            32: 'dream-job-option-1-icon-32.png',
            48: 'dream-job-option-1-icon-48.png',
        },
    },
    background: {
        service_worker: 'src/background.ts',
        type: 'module',
    },
    permissions: ['activeTab', 'scripting', 'sidePanel', 'storage', 'tabs'],
    host_permissions: [
        'https://www.linkedin.com/*',
        'http://localhost:3000/*',
        'http://localhost:5173/*',
        'http://127.0.0.1:5173/*',
    ],
    side_panel: {
        default_path: 'sidepanel.html',
    },
    content_scripts: [
        {
            matches: ['https://www.linkedin.com/*'],
            js: ['src/content/linkedin-job.ts'],
            run_at: 'document_idle',
        },
    ],
};
export default manifest;
