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

        // Poll the token for up to 10 seconds (100 * 100ms)
        for _ in 0..100 {
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
fn get_fcm_token_native() -> Option<String> {
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm() as *mut _) }.ok()?;
    let mut env = vm.attach_current_thread().ok()?;
    
    let class = env.find_class("ru/insightbook/insightbook/MainActivity").ok()?;
    let result = env.call_static_method(&class, "getFcmToken", "()Ljava/lang/String;", &[]).ok()?;
    let obj = result.l().ok()?;
    if obj.is_null() {
        return None;
    }
    let jstr: jni::objects::JString = obj.into();
    let rust_str: String = env.get_string(&jstr).ok()?.into();
    Some(rust_str)
}

#[cfg(target_os = "android")]
fn trigger_request_fcm_token_native() {
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm() as *mut _) }.unwrap();
    let mut env = vm.attach_current_thread().unwrap();
    
    let activity = ctx.context();
    let class = env.find_class("ru/insightbook/insightbook/MainActivity").unwrap();
    let activity_obj = unsafe { jni::objects::JObject::from_raw(activity as *mut _) };
    let activity_val = jni::objects::JValue::Object(&activity_obj);
    
    let _ = env.call_static_method(
        &class,
        "requestFcmToken",
        "(Lru/insightbook/insightbook/MainActivity;)V",
        &[activity_val]
    );
}

#[cfg(target_os = "android")]
fn unsubscribe_fcm_native() {
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm() as *mut _) }.unwrap();
    let mut env = vm.attach_current_thread().unwrap();
    
    // Reset the local token variable
    let class = env.find_class("ru/insightbook/insightbook/MainActivity").unwrap();
    let null_obj = jni::objects::JObject::null();
    let _ = env.set_static_field(&class, (&class, "fcmToken", "Ljava/lang/String;"), jni::objects::JValue::Object(&null_obj));
    
    // Async delete token from Firebase Messaging
    let fm_class = env.find_class("com/google/firebase/messaging/FirebaseMessaging").unwrap();
    if let Ok(fm_inst_res) = env.call_static_method(&fm_class, "getInstance", "()Lcom/google/firebase/messaging/FirebaseMessaging;", &[]) {
        if let Ok(fm_inst) = fm_inst_res.l() {
            let _ = env.call_method(&fm_inst, "deleteToken", "()Lcom/google/android/gms/tasks/Task;", &[]);
        }
    }
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
            unsubscribe_fcm
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
