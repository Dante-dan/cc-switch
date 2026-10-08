//! Device-local shortcut registration shares the tray's window-opening behavior.
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn parse(value: &str) -> Result<Option<Shortcut>, String> {
    if value.trim().is_empty() {
        return Ok(None);
    }
    let shortcut = value
        .trim()
        .parse::<Shortcut>()
        .map_err(|error| error.to_string())?;
    if !shortcut
        .mods
        .intersects(Modifiers::CONTROL | Modifiers::SUPER | Modifiers::ALT)
    {
        return Err("A global shortcut must include Command, Control, or Alt".to_string());
    }
    Ok(Some(shortcut))
}

// Register first: a conflicting new binding must not remove the working one.
fn transition<T: Copy + PartialEq>(
    previous: Option<T>,
    next: Option<T>,
    mut register: impl FnMut(T) -> Result<(), String>,
    mut unregister: impl FnMut(T) -> Result<(), String>,
) -> Result<(), String> {
    if previous == next {
        return Ok(());
    }
    if let Some(shortcut) = next {
        register(shortcut)?;
    }
    if let Some(shortcut) = previous {
        if let Err(error) = unregister(shortcut) {
            if let Some(new) = next {
                let _ = unregister(new);
            }
            return Err(error);
        }
    }
    Ok(())
}

pub fn apply(app: &tauri::AppHandle, previous: &str, next: &str) -> Result<(), String> {
    let previous = parse(previous)
        .ok()
        .flatten()
        .filter(|shortcut| app.global_shortcut().is_registered(*shortcut));
    let next = parse(next)?;
    transition(
        previous,
        next,
        |shortcut| {
            app.global_shortcut()
                .on_shortcut(shortcut, |app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        crate::tray::show_main_window(app);
                    }
                })
                .map_err(|error| error.to_string())
        },
        |shortcut| {
            app.global_shortcut()
                .unregister(shortcut)
                .map_err(|error| error.to_string())
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashSet;

    #[test]
    fn shortcut_change_replaces_registration_and_can_disable() {
        let active = RefCell::new(HashSet::from([1]));
        let register = |key| {
            active.borrow_mut().insert(key);
            Ok(())
        };
        let unregister = |key| {
            active.borrow_mut().remove(&key);
            Ok(())
        };
        transition(Some(1), Some(2), register, unregister).unwrap();
        assert_eq!(*active.borrow(), HashSet::from([2]));
        transition(Some(2), None, register, unregister).unwrap();
        assert!(active.borrow().is_empty());
    }

    #[test]
    fn occupied_shortcut_preserves_previous_registration() {
        let active = RefCell::new(HashSet::from([1]));
        let result = transition(
            Some(1),
            Some(2),
            |_| Err("occupied".into()),
            |key| {
                active.borrow_mut().remove(&key);
                Ok(())
            },
        );
        assert!(result.is_err());
        assert_eq!(*active.borrow(), HashSet::from([1]));
    }

    #[test]
    fn invalid_and_empty_shortcuts_are_distinct() {
        assert!(parse(" ").unwrap().is_none());
        assert!(parse("not a shortcut").is_err());
        assert!(parse("Space").is_err());
        assert!(parse("CommandOrControl+Shift+Space").unwrap().is_some());
    }
}
