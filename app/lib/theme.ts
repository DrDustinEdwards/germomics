// The theme: data-theme on <html> drives light and dark, remembered in localStorage under THEME_KEY by Capsomer's theme
// switch (the header's button, the admin's account row). The pre-paint script sets it before first paint, so there is
// no flash of the wrong theme.
import { themeScript } from "capsomer/theme-server";

export const THEME_KEY = "germomics-theme";

// Inlined into <head> by root.tsx: Capsomer's pre-paint script.
export const themeInitScript = themeScript(THEME_KEY);
