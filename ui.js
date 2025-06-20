// ui.js: Manages DOM elements and UI helper functions
import { t } from '/language.js';

// --- DOM Element Exports ---
export let generatorSection, scannerSection, tabGenerator, tabScanner, qrTypeSelector, generateBtn, qrResultDiv, qrcodeContainer, downloadPngBtn, downloadSvgBtn, video, canvasElement, scannerLoading, scannerResultContainer, scannerResultText, scannerActions, scannerPermissionMsg, requestCameraBtn, switchCameraBtn, flashBtn, scannerControls, generatorHistoryContainer, generatorHistoryList, scannerHistoryContainer, scannerHistoryList, clearGeneratorHistoryBtn, clearScannerHistoryBtn, rescanBtn, scannerViewport;

// --- DOM Element Initialization ---
export const reinit = () => {
    generatorSection = document.getElementById('generator-section');
    scannerSection = document.getElementById('scanner-section');
    tabGenerator = document.getElementById('tab-generator');
    tabScanner = document.getElementById('tab-scanner');
    qrTypeSelector = document.getElementById('qr-type-selector');
    generateBtn = document.getElementById('generate-btn');
    qrResultDiv = document.getElementById('qr-result');
    qrcodeContainer = document.getElementById('qrcode');
    downloadPngBtn = document.getElementById('download-png-btn');
    downloadSvgBtn = document.getElementById('download-svg-btn');
    video = document.getElementById('scanner-video');
    canvasElement = document.getElementById('scanner-canvas');
    scannerLoading = document.getElementById('scanner-loading');
    scannerResultContainer = document.getElementById('scanner-result-container');
    scannerResultText = document.getElementById('scanner-result-text');
    scannerActions = document.getElementById('scanner-actions');
    scannerPermissionMsg = document.getElementById('scanner-permission-msg');
    requestCameraBtn = document.getElementById('request-camera-btn');
    switchCameraBtn = document.getElementById('switch-camera-btn');
    flashBtn = document.getElementById('flash-btn');
    scannerControls = document.getElementById('scanner-controls');
    generatorHistoryContainer = document.getElementById('generator-history-container');
    generatorHistoryList = document.getElementById('generator-history-list');
    scannerHistoryContainer = document.getElementById('scanner-history-container');
    scannerHistoryList = document.getElementById('scanner-history-list');
    clearGeneratorHistoryBtn = document.getElementById('clear-generator-history-btn');
    clearScannerHistoryBtn = document.getElementById('clear-scanner-history-btn');
    rescanBtn = document.getElementById('rescan-btn');
    scannerViewport = document.getElementById('scanner-viewport');
};

const toast = document.getElementById('toast-notification');

// --- UI Functions ---

/**
 * Displays a toast notification message.
 * @param {string} message - The message to display.
 */
export const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    // Dispatch an event to play the sound from the main audio handler
    window.dispatchEvent(new CustomEvent('sound-play', { detail: 'toast-pop-sound' }));
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

/**
 * Formats a date object into a "time ago" string.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted time ago string.
 */
export const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return t('timeAgo.year', { count: Math.floor(interval) });
    interval = seconds / 2592000;
    if (interval > 1) return t('timeAgo.month', { count: Math.floor(interval) });
    interval = seconds / 86400;
    if (interval > 1) return t('timeAgo.day', { count: Math.floor(interval) });
    interval = seconds / 3600;
    if (interval > 1) return t('timeAgo.hour', { count: Math.floor(interval) });
    interval = seconds / 60;
    if (interval > 1) return t('timeAgo.minute', { count: Math.floor(interval) });
    if (seconds < 10) return t('timeAgo.justNow');
    return t('timeAgo.second', { count: Math.floor(seconds) });
};

/**
 * Parses a VCard string into a simple object.
 * @param {string} vcardString - The VCard data string.
 * @returns {object} An object with N, TEL, EMAIL, ORG properties.
 */
export const parseVCard = (vcardString) => {
    const lines = vcardString.split('\n');
    const vcard = {};
    lines.forEach(line => {
        if (line.includes(':')) {
            let [key, value] = line.split(':');
            key = key.split(';')[0]; // Handle cases like N;CHARSET=UTF-8:
            if (['N', 'TEL', 'EMAIL', 'ORG', 'ADR'].includes(key)) {
                vcard[key] = value.trim();
            }
        }
    });
    return vcard;
};