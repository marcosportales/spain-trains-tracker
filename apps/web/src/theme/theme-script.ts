import { THEME_STORAGE_KEY } from './theme';

/**
 * Source of a tiny script, inlined in `<head>`, that sets `data-theme` on `<html>` before first
 * paint so the page never flashes the wrong theme. It repeats `resolveTheme` and
 * `parsePreference` by hand because it runs before any bundle loads. Storage can throw, hence
 * the `try/catch`.
 */
export const THEME_SCRIPT = `(function(){var p='system';try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s==='light'||s==='dark')p=s}catch(e){}var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')})()`;
