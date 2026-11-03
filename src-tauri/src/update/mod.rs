//! In-app updates (ADR 0026): checks the signed `latest.json` of the newest
//! GitHub release with `tauri-plugin-updater`, downloads and installs the
//! update and restarts Ame. Builds that cannot replace themselves get a
//! download link instead.

pub mod commands;

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use specta::Type;

/// Page with the downloads of the newest release.
pub const RELEASES_URL: &str = "https://github.com/nclskpprs/Ame/releases/latest";

/// How this build gets a new version.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum UpdateSupport {
    /// Downloaded, installed and restarted from inside Ame.
    InApp,
    /// Only a link to the release page: the portable Windows build, Linux
    /// packages other than the AppImage, and debug builds.
    Download,
}

/// Decides the support from facts about the running build.
pub fn support_for(debug: bool, portable: bool, linux: bool, appimage: bool) -> UpdateSupport {
    if debug || portable || (linux && !appimage) {
        UpdateSupport::Download
    } else {
        UpdateSupport::InApp
    }
}

/// A newer version that is available.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    /// Release notes, if the release has any.
    pub notes: Option<String>,
}

/// Download progress of an update, in bytes.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    pub downloaded: f64,
    /// Size of the download, if the server tells it.
    pub total: Option<f64>,
}

/// The update found by the last check, kept for the install. Managed as
/// Tauri state.
#[derive(Default)]
pub struct PendingUpdate(pub Mutex<Option<tauri_plugin_updater::Update>>);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_installed_release_builds_update_themselves() {
        assert_eq!(
            support_for(false, false, false, false),
            UpdateSupport::InApp
        );
        assert_eq!(support_for(false, false, true, true), UpdateSupport::InApp);
        assert_eq!(
            support_for(true, false, false, false),
            UpdateSupport::Download
        );
        assert_eq!(
            support_for(false, true, false, false),
            UpdateSupport::Download
        );
        assert_eq!(
            support_for(false, false, true, false),
            UpdateSupport::Download
        );
    }
}
