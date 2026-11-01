fn main() {
    // Tauri embeds the Windows app manifest (Common Controls v6) as a
    // resource of the app binary only. Test binaries link the same code
    // without it and fail to start with STATUS_ENTRYPOINT_NOT_FOUND
    // (`TaskDialogIndirect`). Embedding the manifest through the linker
    // covers every binary of the package, including tests.
    let windows = tauri_build::WindowsAttributes::new_without_app_manifest();
    let attributes = tauri_build::Attributes::new().windows_attributes(windows);
    if let Err(err) = tauri_build::try_build(attributes) {
        // A build script reports failure by panicking.
        panic!("tauri build failed: {err:#}");
    }

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    if target_os == "windows" && target_env == "msvc" {
        let manifest =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
}
