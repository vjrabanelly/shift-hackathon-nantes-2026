declare const manifest: {
    manifest_version: 3;
    name: string;
    description: string;
    version: string;
    icons: {
        16: string;
        32: string;
        48: string;
        128: string;
    };
    action: {
        default_title: string;
        default_popup: string;
        default_icon: {
            16: string;
            32: string;
            48: string;
        };
    };
    background: {
        service_worker: string;
        type: "module";
    };
    permissions: ("activeTab" | "scripting" | "sidePanel" | "storage" | "tabs")[];
    host_permissions: string[];
    side_panel: {
        default_path: string;
    };
    content_scripts: {
        matches: string[];
        js: string[];
        run_at: string;
    }[];
};
export default manifest;
