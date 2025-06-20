// main.js: Application entry point

import * as ui from '/ui.js';
import * as lang from '/language.js';
import { initGenerator } from '/generator.js';
import { startScanner, stopScanner, initScanner, isScanning } from '/scanner.js';

// --- PWA Installation ---
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

// --- Audio Context Management ---
let audioContext;
const audioBuffers = {};
let isAudioUnlocked = false;

const initAudio = async () => {
    if (isAudioUnlocked || !window.AudioContext) return;
    try {
        audioContext = new AudioContext();
        // Decode all audio files on the first interaction
        const audioElements = document.querySelectorAll('audio');
        for (const el of audioElements) {
            const response = await fetch(el.src);
            const arrayBuffer = await response.arrayBuffer();
            audioBuffers[el.id] = await audioContext.decodeAudioData(arrayBuffer);
        }
        isAudioUnlocked = true;
        console.log("Audio unlocked and pre-loaded.");
    } catch (e) {
        console.error("Could not initialize or decode audio:", e);
    }
};

const playSound = (soundId) => {
    if (!isAudioUnlocked || !audioContext || !audioBuffers[soundId]) {
        // Fallback for when audio context is not ready
        const soundElement = document.getElementById(soundId);
        if (soundElement) {
             soundElement.currentTime = 0;
             soundElement.play().catch(e => {});
        }
        return;
    }
    
    // Use WebAudio API for reliable playback
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffers[soundId];
    source.connect(audioContext.destination);
    source.start(0);
};

const setupInstallButton = () => {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI to notify the user they can install the PWA
        if (installBtn) {
            installBtn.classList.remove('hidden');
            installBtn.addEventListener('click', handleInstallClick);
        }
    });

    window.addEventListener('appinstalled', () => {
        // Hide the install button if the app is installed
        deferredPrompt = null;
        if (installBtn) {
            installBtn.classList.add('hidden');
        }
        // Also remove the event listener
        installBtn.removeEventListener('click', handleInstallClick);
    });
};

const handleInstallClick = async () => {
    if (!deferredPrompt) {
        return;
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
};

document.addEventListener('DOMContentLoaded', async () => {
    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.error('ServiceWorker registration failed: ', err);
                });
        });
    }

    // --- Load HTML Partials ---
    const loadPartials = async () => {
        try {
            const [generatorHtml, scannerHtml] = await Promise.all([
                fetch('./generator-view.html').then(res => res.text()),
                fetch('./scanner-view.html').then(res => res.text())
            ]);
            document.getElementById('generator-section').innerHTML = generatorHtml;
            document.getElementById('scanner-section').innerHTML = scannerHtml;
        } catch (error) {
            console.error("Error loading HTML partials:", error);
            // Display a user-friendly error message
            document.body.innerHTML = '<div class="text-center p-8 text-red-400">Error loading application components. Please refresh the page.</div>';
        }
    };
    
    // --- Initialize Language ---
    // Must be done before loading partials so partials can be translated on load.
    await lang.initLanguage();

    await loadPartials();
    // Re-initialize UI elements after loading HTML
    ui.reinit();

    // Translate the now-loaded partials
    lang.applyTranslations();

    // Setup install button logic after UI is ready
    setupInstallButton();
    
    // Add a single event listener to unlock audio on first interaction
    document.body.addEventListener('click', initAudio, { once: true });
    document.body.addEventListener('touchend', initAudio, { once: true });

    // Global listener for sound events
    window.addEventListener('sound-play', (e) => playSound(e.detail));

    // --- Tab Switching ---
    const switchTab = (tab) => {
        if (tab === 'generator') {
            ui.generatorSection.style.display = 'block';
            ui.scannerSection.style.display = 'none';
            ui.tabGenerator.classList.replace('tab-inactive', 'tab-active');
            ui.tabScanner.classList.replace('tab-active', 'tab-inactive');
            stopScanner();
        } else {
            ui.generatorSection.style.display = 'none';
            ui.scannerSection.style.display = 'block';
            ui.tabGenerator.classList.replace('tab-active', 'tab-inactive');
            ui.tabScanner.classList.replace('tab-inactive', 'tab-active');
            startScanner();
        }
    };

    // --- Language Switcher ---
    const langSwitcher = document.getElementById('language-switcher');
    langSwitcher.addEventListener('click', (e) => {
        if(e.target.matches('.lang-button')) {
            playClickSound();
            const newLang = e.target.dataset.langCode;
            lang.setLanguage(newLang);
            
            // Update active class on buttons
            document.querySelectorAll('.lang-button').forEach(btn => btn.classList.remove('lang-active', 'text-white'));
            document.querySelectorAll('.lang-button').forEach(btn => btn.classList.add('text-gray-400'));
            e.target.classList.add('lang-active', 'text-white');
            e.target.classList.remove('text-gray-400');
        }
    });
    // Set initial active button
    const currentLang = lang.getCurrentLanguage();
    document.querySelectorAll('.lang-button').forEach(btn => btn.classList.remove('lang-active', 'text-white'));
    document.querySelectorAll('.lang-button').forEach(btn => btn.classList.add('text-gray-400'));
    const activeBtn = document.getElementById(`lang-${currentLang}`);
    if (activeBtn) {
        activeBtn.classList.add('lang-active', 'text-white');
        activeBtn.classList.remove('text-gray-400');
    }

    // --- Sound Effects ---
    const playClickSound = () => {
        playSound('click-sound');
    };

    // --- Initial Load ---
    ui.tabGenerator.addEventListener('click', () => {
        playClickSound();
        switchTab('generator');
    });
    ui.tabScanner.addEventListener('click', () => {
        playClickSound();
        switchTab('scanner');
    });
    ui.requestCameraBtn.addEventListener('click', () => {
        playClickSound();
        // Hide permission message immediately for better UX
        if (ui.scannerPermissionMsg) {
            ui.scannerPermissionMsg.style.display = 'none';
        }
        startScanner(true); // Explicitly request again
    });

    ui.rescanBtn.addEventListener('click', () => {
        playClickSound();
        ui.scannerResultContainer.style.display = 'none';
        if (ui.scannerViewport) {
            ui.scannerViewport.style.display = 'block';
        }
        startScanner();
    });

    // Add another button to allow user to rescan
    // Add click sounds to other major buttons
    document.querySelectorAll('button:not(#tab-generator):not(#tab-scanner):not(#request-camera-btn):not(#rescan-btn), a[id^="download-"]').forEach(btn => {
        btn.addEventListener('click', playClickSound);
    });

    initGenerator(playClickSound);
    initScanner(playSound);
    
    switchTab('generator');
});