use tauri::{plugin::PluginHandle, AppHandle, Runtime};
use serde_json::{json, Value};
use crate::models::*;
use crate::Result;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "ru.insightbook.apkinstaller";

pub fn init<R: Runtime>(
    _app: &AppHandle<R>,
    api: tauri::plugin::PluginApi<R, ()>,
) -> Result<ApkInstaller<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "ApkInstallerPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = unimplemented!();
    Ok(ApkInstaller(handle))
}

pub struct ApkInstaller<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ApkInstaller<R> {
    pub fn request_sync_notification_permission(&self) -> Result<bool> {
        let permissions: Value = self
            .0
            .run_mobile_plugin(
                "requestPermissions",
                json!({ "permissions": ["postNotification"] }),
            )
            .map_err(crate::Error::from)?;

        Ok(permissions.as_bool().unwrap_or_else(|| {
            permissions
                .get("postNotification")
                .and_then(Value::as_str)
                == Some("granted")
        }))
    }

    pub fn start_sync_progress_notification(
        &self,
        payload: SyncProgressNotificationPayload,
    ) -> Result<bool> {
        self.0
            .run_mobile_plugin("startSyncProgressNotification", payload)
            .map_err(Into::into)
    }

    pub fn update_sync_progress_notification(
        &self,
        payload: SyncProgressNotificationPayload,
    ) -> Result<bool> {
        self.0
            .run_mobile_plugin("updateSyncProgressNotification", payload)
            .map_err(Into::into)
    }

    pub fn stop_sync_progress_notification(&self) -> Result<bool> {
        self.0
            .run_mobile_plugin("stopSyncProgressNotification", ())
            .map_err(Into::into)
    }

    pub fn set_system_bars_theme(&self, payload: SystemBarsPayload) -> Result<bool> {
        self.0.run_mobile_plugin("setSystemBarsTheme", payload).map_err(Into::into)
    }

    pub fn set_immersive_mode(&self, payload: ImmersivePayload) -> Result<bool> {
        self.0.run_mobile_plugin("setImmersiveMode", payload).map_err(Into::into)
    }

    pub fn set_screen_orientation(&self, payload: OrientationPayload) -> Result<bool> {
        self.0.run_mobile_plugin("setScreenOrientation", payload).map_err(Into::into)
    }

    pub fn install_apk(&self, payload: InstallApkPayload) -> Result<bool> {
        self.0.run_mobile_plugin("installApk", payload).map_err(Into::into)
    }
}
