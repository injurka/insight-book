use tauri::{AppHandle, Runtime};
use crate::models::*;
use crate::Result;

pub struct ApkInstaller<R: Runtime>(std::marker::PhantomData<fn() -> R>);

pub fn init<R: Runtime>(_app: &AppHandle<R>, _api: tauri::plugin::PluginApi<R, ()>) -> Result<ApkInstaller<R>> {
    Ok(ApkInstaller(std::marker::PhantomData))
}

impl<R: Runtime> ApkInstaller<R> {
    pub fn install_apk(&self, _payload: InstallApkPayload) -> Result<bool> {
        Ok(true)
    }
}
