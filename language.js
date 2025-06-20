// language.js: Manages all language and translation logic.

let translations = {};
let currentLanguage = 'bn';

const supportedLanguages = ['en', 'bn'];

/**
 * Loads a language file (JSON) into the `translations` object.
 * @param {string} lang - The language code (e.g., 'en', 'bn').
 */
async function loadLanguage(lang) {
    try {
        const response = await fetch(`./${lang}.json`);
        if (!response.ok) {
            throw new Error(`Could not load language file: ${lang}.json`);
        }
        translations = await response.json();
    } catch (error) {
        console.error(error);
        // Fallback to English if the requested language fails
        if (lang !== 'en') {
            await loadLanguage('en');
        }
    }
}

/**
 * Applies the loaded translations to all elements with `data-lang` attributes.
 */
export function applyTranslations() {
    document.querySelectorAll('[data-lang]').forEach(element => {
        const key = element.getAttribute('data-lang');
        const translation = t(key);
        if (translation) {
            element.textContent = translation;
        }
    });

    document.querySelectorAll('[data-lang-placeholder]').forEach(element => {
        const key = element.getAttribute('data-lang-placeholder');
        const translation = t(key);
        if (translation) {
            element.placeholder = translation;
        }
    });

    // Update the root lang attribute for accessibility
    document.documentElement.lang = currentLanguage;
}

/**
 * Sets the application language, loads the new translations, and applies them.
 * @param {string} lang - The language code to switch to.
 */
export async function setLanguage(lang) {
    if (!supportedLanguages.includes(lang)) {
        lang = 'en'; // Default to English if unsupported lang is passed
    }
    currentLanguage = lang;
    localStorage.setItem('appLanguage', lang);
    await loadLanguage(lang);
    applyTranslations();
    // Dispatch a custom event to notify other modules of the language change.
    // This is useful for modules that need to re-render dynamic content.
    window.dispatchEvent(new CustomEvent('language-changed'));
}

/**
 * Initializes the language system on startup.
 */
export async function initLanguage() {
    const savedLang = localStorage.getItem('appLanguage');
    const browserLang = navigator.language.split('-')[0];
    
    let initialLang = 'bn'; // Default to Bangla
    if (savedLang && supportedLanguages.includes(savedLang)) {
        initialLang = savedLang;
    } else if (supportedLanguages.includes(browserLang)) {
        initialLang = browserLang;
    }
    
    await setLanguage(initialLang);
}

/**
 * Gets a translation string for a given key.
 * Handles nested keys (e.g., 'toast.copied').
 * @param {string} key - The translation key.
 * @param {object} [vars={}] - Optional variables for placeholder replacement.
 * @returns {string} The translated string.
 */
export function t(key, vars = {}) {
    let text = key.split('.').reduce((obj, i) => obj?.[i], translations);

    if (text) {
        for (const varKey in vars) {
            const regex = new RegExp(`{{${varKey}}}`, 'g');
            text = text.replace(regex, vars[varKey]);
        }
    }

    return text || key;
}

/**
 * Returns the currently active language code.
 * @returns {string}
 */
export function getCurrentLanguage() {
    return currentLanguage;
}