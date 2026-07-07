#[tauri::command]
async fn get_fcm_token() -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        Ok(get_fcm_token_native())
    }
    #[cfg(not(target_os = "android"))]
    {
        Ok(None)
    }
}

#[tauri::command]
async fn request_fcm_token() -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        trigger_request_fcm_token_native();

        // Poll the token for up to 60 seconds (600 * 100ms) to allow user to permit notifications
        for _ in 0..600 {
            if let Some(token) = get_fcm_token_native() {
                return Ok(Some(token));
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        Ok(get_fcm_token_native())
    }
    #[cfg(not(target_os = "android"))]
    {
        Ok(None)
    }
}

#[tauri::command]
async fn unsubscribe_fcm() -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        unsubscribe_fcm_native();
    }
    Ok(())
}

#[cfg(target_os = "android")]
fn get_fcm_token_native_impl(env: &mut jni::JNIEnv) -> jni::errors::Result<Option<String>> {
    let activity = ndk_context::android_context().context();
    let activity_obj = unsafe { jni::objects::JObject::from_raw(activity as *mut _) };
    let class = env.get_object_class(&activity_obj)?;
    let result = env.call_static_method(&class, "getFcmToken", "()Ljava/lang/String;", &[])?;
    let obj = result.l()?;
    if obj.is_null() {
        return Ok(None);
    }
    let jstr: jni::objects::JString = obj.into();
    let rust_str: String = env.get_string(&jstr)?.into();
    Ok(Some(rust_str))
}

#[cfg(target_os = "android")]
fn get_fcm_token_native() -> Option<String> {
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm() as *mut _) }.ok()?;
    let mut env = vm.attach_current_thread().ok()?;
    let res = get_fcm_token_native_impl(&mut env);
    if res.is_err() {
        let _ = env.exception_clear();
    }
    res.unwrap_or(None)
}

#[cfg(target_os = "android")]
fn trigger_request_fcm_token_native_impl(env: &mut jni::JNIEnv) -> jni::errors::Result<()> {
    let activity = ndk_context::android_context().context();
    let activity_obj = unsafe { jni::objects::JObject::from_raw(activity as *mut _) };
    let class = env.get_object_class(&activity_obj)?;
    let activity_val = jni::objects::JValue::Object(&activity_obj);
    env.call_static_method(
        &class,
        "requestFcmToken",
        "(Lru/insightbook/insightbook/MainActivity;)V",
        &[activity_val]
    )?;
    Ok(())
}

#[cfg(target_os = "android")]
fn trigger_request_fcm_token_native() {
    let ctx = ndk_context::android_context();
    let vm = match unsafe { jni::JavaVM::from_raw(ctx.vm() as *mut _) } {
        Ok(vm) => vm,
        Err(_) => return,
    };
    let mut env = match vm.attach_current_thread() {
        Ok(env) => env,
        Err(_) => return,
    };
    let res = trigger_request_fcm_token_native_impl(&mut env);
    if res.is_err() {
        let _ = env.exception_clear();
    }
}

#[cfg(target_os = "android")]
fn unsubscribe_fcm_native_impl(env: &mut jni::JNIEnv) -> jni::errors::Result<()> {
    let activity = ndk_context::android_context().context();
    let activity_obj = unsafe { jni::objects::JObject::from_raw(activity as *mut _) };
    let class = env.get_object_class(&activity_obj)?;
    
    let null_obj = jni::objects::JObject::null();
    // Using string class descriptor instead of tuple
    env.set_static_field(&class, "_fcmToken", "Ljava/lang/String;", jni::objects::JValue::Object(&null_obj))?;
    
    if let Ok(fm_class) = env.find_class("com/google/firebase/messaging/FirebaseMessaging") {
        if let Ok(fm_inst_res) = env.call_static_method(&fm_class, "getInstance", "()Lcom/google/firebase/messaging/FirebaseMessaging;", &[]) {
            if let Ok(fm_inst) = fm_inst_res.l() {
                let _ = env.call_method(&fm_inst, "deleteToken", "()Lcom/google/android/gms/tasks/Task;", &[]);
            }
        }
    }
    Ok(())
}

#[cfg(target_os = "android")]
fn unsubscribe_fcm_native() {
    let ctx = ndk_context::android_context();
    let vm = match unsafe { jni::JavaVM::from_raw(ctx.vm() as *mut _) } {
        Ok(vm) => vm,
        Err(_) => return,
    };
    let mut env = match vm.attach_current_thread() {
        Ok(env) => env,
        Err(_) => return,
    };
    
    let res = unsubscribe_fcm_native_impl(&mut env);
    if res.is_err() {
        let _ = env.exception_clear();
    }
}

#[tauri::command]
fn is_hyprland() -> bool {
    std::env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok()
        || std::env::var("XDG_CURRENT_DESKTOP")
            .map(|v| v.to_lowercase().contains("hyprland"))
            .unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_fcm_token,
            request_fcm_token,
            unsubscribe_fcm,
            is_hyprland
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
