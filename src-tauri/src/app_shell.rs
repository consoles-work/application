// ══════════════════════════════════════════════════════════════════
// app_shell.rs — окно, трей, меню приложения и выход
// ══════════════════════════════════════════════════════════════════
//
// Как приложение живёт в системе — всё, что не относится к данным.
// Подключается в lib.rs при сборке приложения.
//
// install — при старте:
//  1. Трей: «Открыть» и «Выход»; клик по иконке показывает окно. Надписи —
//     на языке интерфейса.
//  2. Меню приложения macOS: «О программе» открывает свой диалог со ссылками
//     (штатный показывает только текст); Cmd+Q идёт через подтверждение выхода
//     (штатный пункт завершает процесс напрямую, минуя приложение).
//
// Закрытие окна: включено «сворачивать в трей» — окно прячется, иначе —
// подтверждение выхода.
// Повторный запуск: второй процесс не стартует, первый показывает своё окно.
// На macOS запуск из Dock/«Программ» приходит не вторым процессом, а событием
// Reopen — окно, спрятанное в трей, показываем и там.
// confirm_quit — единая точка для всех путей выхода; второй диалог поверх
// первого не открывается.
// set_language — надписи трея и меню при смене языка.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, Window, WindowEvent};

const MAIN_WINDOW: &str = "main";
const TRAY_ID: &str = "main_tray";

/// Диалог выхода уже на экране
static QUIT_DIALOG_ACTIVE: AtomicBool = AtomicBool::new(false);

// ══════════════════════════════════════════════
// Сценарии
// ══════════════════════════════════════════════

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let lang = crate::db::get_setting_str("ui.language", "ru");

    // 1. Трей.
    let icon = app.default_window_icon().expect("иконка приложения встроена в бандл").clone();

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .menu(&tray_menu(app, &lang)?)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => confirm_quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    // 2. Меню приложения.
    install_app_menu(app, &lang)?;

    app.on_menu_event(|app, event| match event.id().as_ref() {
        "app_about" => show_about(app),
        "app_quit" => confirm_quit(app),
        _ => {}
    });

    Ok(())
}

pub fn on_window_event(window: &Window, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else { return };

    api.prevent_close();

    if crate::db::get_setting_bool("ui.closeToTray", true) {
        let _ = window.hide();

        return;
    }

    confirm_quit(window.app_handle());
}

pub fn on_run_event(app: &AppHandle, event: RunEvent) {
    #[cfg(target_os = "macos")]
    if let RunEvent::Reopen { .. } = event {
        show_main_window(app);
    }

    #[cfg(not(target_os = "macos"))]
    let _ = (app, event);
}

/// Показать окно, даже если оно свёрнуто или спрятано в трей
pub fn show_main_window(app: &AppHandle) {
    let Some(w) = app.get_webview_window(MAIN_WINDOW) else { return };

    // Окно есть всегда, пока жив процесс; ошибки показа платформенные и не критичны
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_focus();
}

/// Спросить подтверждение и завершить приложение при согласии
pub fn confirm_quit(app: &AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    if QUIT_DIALOG_ACTIVE.swap(true, Ordering::SeqCst) {
        return;
    }

    let (title, text, yes, no) = quit_dialog_labels(&crate::db::get_setting_str("ui.language", "ru"));

    let dialog = app
        .dialog()
        .message(text)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(yes.to_string(), no.to_string()));

    // Окно могло быть спрятано в трей — показываем, чтобы диалог было к чему привязать
    show_main_window(app);

    let dialog = match app.get_webview_window(MAIN_WINDOW) {
        Some(w) => dialog.parent(&w),
        None => dialog,
    };

    let handle = app.clone();

    dialog.show(move |confirmed| {
        if confirmed {
            handle.exit(0);
        } else {
            reset_quit_dialog();
        }
    });
}

/// Диалог выхода закрыт ответом «Нет» (в том числе свой диалог фронта)
pub fn reset_quit_dialog() {
    QUIT_DIALOG_ACTIVE.store(false, Ordering::SeqCst);
}

/// Надписи трея и меню приложения на новом языке. Не вышло — останутся старые.
pub fn set_language(app: &AppHandle, lang: &str) {
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), tray_menu(app, lang)) {
        let _ = tray.set_menu(Some(menu));
    }

    let _ = install_app_menu(app, lang);
}

// ══════════════════════════════════════════════
// Детали
// ══════════════════════════════════════════════

/// Шаг 1: меню трея
fn tray_menu(app: &AppHandle, lang: &str) -> tauri::Result<Menu<tauri::Wry>> {
    let (show_label, quit_label) = tray_labels(lang);

    let show_item = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;

    Menu::with_items(app, &[&show_item, &sep, &quit_item])
}

/// Шаг 2: в меню приложения macOS заменить штатные «About» и «Quit» своими пунктами.
/// На других ОС меню приложения нет.
fn install_app_menu(app: &AppHandle, lang: &str) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        use tauri::menu::MenuItemKind;

        let menu = Menu::default(app)?;

        if let Some(MenuItemKind::Submenu(app_submenu)) = menu.items()?.into_iter().next() {
            // Первый пункт подменю приложения — PredefinedMenuItem::about
            app_submenu.remove_at(0)?;
            app_submenu.insert(&MenuItem::with_id(app, "app_about", about_label(lang), true, None::<&str>)?, 0)?;

            // Последний пункт подменю приложения — PredefinedMenuItem::quit
            if let Some(last) = app_submenu.items()?.last() {
                app_submenu.remove(last)?;
            }

            let (_, quit_label) = tray_labels(lang);

            app_submenu.append(&MenuItem::with_id(app, "app_quit", quit_label, true, Some("CmdOrCtrl+Q"))?)?;
        }

        app.set_menu(menu)?;
    }

    #[cfg(not(target_os = "macos"))]
    let _ = (app, lang);

    Ok(())
}

/// Шаг 2: показать окно и открыть в нём диалог «О программе» (AboutDialog.tsx)
fn show_about(app: &AppHandle) {
    show_main_window(app);

    let _ = app.emit("show-about", ());
}

/// (открыть, выйти) — трей и пункт выхода в меню приложения
fn tray_labels(lang: &str) -> (&'static str, &'static str) {
    match lang {
        "en" => ("Open Consoles.work", "Quit"),
        "zh" => ("打开 Consoles.work", "退出"),
        "fr" => ("Ouvrir Consoles.work", "Quitter"),
        "kk" => ("Consoles.work ашу", "Шығу"),
        _    => ("Открыть Consoles.work", "Выход"),
    }
}

#[cfg(target_os = "macos")]
fn about_label(lang: &str) -> &'static str {
    match lang {
        "en" => "About Consoles.work",
        "zh" => "关于 Consoles.work",
        "fr" => "À propos de Consoles.work",
        "kk" => "Consoles.work туралы",
        _    => "О программе Consoles.work",
    }
}

/// (заголовок, текст, «выйти», «отмена»)
fn quit_dialog_labels(lang: &str) -> (&'static str, &'static str, &'static str, &'static str) {
    match lang {
        "en" => ("Quit", "Are you sure you want to quit?\nAll open terminal sessions will be closed.", "Quit", "Cancel"),
        "zh" => ("退出", "确定要退出吗？\n所有打开的终端会话都将关闭。", "退出", "取消"),
        "fr" => ("Quitter", "Voulez-vous vraiment quitter ?\nToutes les sessions de terminal ouvertes seront fermées.", "Quitter", "Annuler"),
        "kk" => ("Шығу", "Шығуға сенімдісіз бе?\nБарлық ашық терминал сессиялары жабылады.", "Шығу", "Болдырмау"),
        _    => ("Выход", "Вы уверены, что хотите выйти?\nВсе открытые терминальные сессии будут закрыты.", "Выйти", "Отмена"),
    }
}
