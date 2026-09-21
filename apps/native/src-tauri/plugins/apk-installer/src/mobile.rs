use tauri::{plugin::PluginHandle, AppHandle, Runtime};
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
    pub fn install_apk(&self, payload: InstallApkPayload) -> Result<bool> {
        self.0.run_mobile_plugin("installApk", payload).map_err(Into::into)
    }
}
