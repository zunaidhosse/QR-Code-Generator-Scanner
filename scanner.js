// scanner.js: Handles all QR code scanning logic

import * as ui from '/ui.js';
import { showToast, parseVCard, formatTimeAgo } from '/ui.js';
import { t } from '/language.js';

// --- State ---
let currentStream;
let currentFacingMode = 'environment';
let flashEnabled = false;
let animationFrameId;
let scannerHistory = JSON.parse(localStorage.getItem('scannerHistory')) || [];
let lastScanTime = 0;
const SCAN_COOLDOWN = 3000; // 3 seconds
let playSoundCallback = () => {};

// --- Camera & Scanner Control ---

/**
 * Checks if the scanner is currently active.
 * @returns {boolean} True if scanning.
 */
export const isScanning = () => !!currentStream;

/**
 * Starts the camera and begins scanning for QR codes.
 * @param {boolean} isExplicitRequest - True if user clicked the "allow" button.
 */
export const startScanner = async (isExplicitRequest = false) => {
    if (currentStream) return;
    ui.scannerLoading.style.display = 'flex';
    ui.scannerPermissionMsg.style.display = 'none';
    ui.scannerResultContainer.style.display = 'none'; // Hide previous results
    
    // Make sure viewport is visible
    if(ui.scannerViewport) ui.scannerViewport.style.display = 'block';

    // Reset scanner view state
    const scannerLine = document.getElementById('scanner-line');
    if (scannerLine) scannerLine.style.display = 'none';
    ui.scannerControls.style.display = 'none';
    ui.video.style.display = 'block';

    // Show scanner overlay
    const overlay = document.getElementById('scanner-overlay');
    if(overlay) overlay.style.display = 'block';
    
    try {
        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        ui.video.srcObject = currentStream;
        ui.video.setAttribute("playsinline", true); // Required for iOS

        // Dynamically mirror video for user-facing camera for better UX
        ui.video.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
        
        ui.video.onloadedmetadata = () => {
            ui.video.play().then(() => {
                animationFrameId = requestAnimationFrame(tick);
                ui.scannerLoading.style.display = 'none';
                ui.scannerControls.style.display = 'flex';
        
                // Check for flash support after a short delay
                setTimeout(async () => {
                    if (!currentStream) return;
                    const track = currentStream.getVideoTracks()[0];
                    const capabilities = track.getCapabilities();
                    if (!capabilities.torch) {
                         ui.flashBtn.style.display = 'none';
                    } else {
                         ui.flashBtn.style.display = 'inline-block';
                         flashEnabled = false;
                         ui.flashBtn.textContent = t('toggleFlashOn');
                         ui.flashBtn.classList.remove('bg-yellow-500');
                         ui.flashBtn.classList.add('bg-gray-600/50', 'border-gray-400/50');
                    }
                }, 500);
            }).catch(e => {
                console.error("Video play error:", e);
                ui.scannerLoading.style.display = 'none';
                ui.scannerPermissionMsg.querySelector('p').textContent = t('cameraError.play');
                ui.scannerPermissionMsg.style.display = 'flex';
            });
        };

    } catch (err) {
        console.error("Camera Error:", err);
        ui.scannerLoading.style.display = 'none';
        ui.scannerPermissionMsg.style.display = 'flex';
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            ui.scannerPermissionMsg.querySelector('p').textContent = t('cameraError.notAllowed');
            ui.requestCameraBtn.style.display = 'none';
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
             ui.scannerPermissionMsg.querySelector('p').textContent = t('cameraError.notFound');
             ui.requestCameraBtn.style.display = 'none';
        } else {
             ui.scannerPermissionMsg.querySelector('p').textContent = t('cameraError.generic');
        }
    }
};

/**
 * Stops the camera stream and scanning.
 */
export const stopScanner = () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
     const overlay = document.getElementById('scanner-overlay');
    if(overlay) overlay.style.display = 'none';
    const scannerLine = document.getElementById('scanner-line');
    if (scannerLine) scannerLine.style.display = 'none';
    ui.scannerControls.style.display = 'none';
};

/**
 * The main scanning loop, called on each animation frame.
 */
const tick = () => {
    if (ui.video.readyState === ui.video.HAVE_ENOUGH_DATA) {
        ui.scannerLoading.style.display = 'none';
        
        // Start CSS animation for scanner line
        const scannerLine = document.getElementById('scanner-line');
        if(scannerLine) scannerLine.style.display = 'block';

        const canvasElement = ui.canvasElement;
        const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
        canvasElement.height = ui.video.videoHeight;
        canvasElement.width = ui.video.videoWidth;

        // Un-mirror the canvas context if the video is mirrored (for front camera)
        // This ensures jsQR receives a non-mirrored image.
        canvas.setTransform(currentFacingMode === 'user' ? -1 : 1, 0, 0, 1, currentFacingMode === 'user' ? canvasElement.width : 0, 0);

        canvas.drawImage(ui.video, 0, 0, canvasElement.width, canvasElement.height);
        const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });

        if (code && code.data) { // Check for data to prevent empty scans
            const now = Date.now();
            if(now - lastScanTime > SCAN_COOLDOWN) {
                lastScanTime = now;
                handleScannedCode(code.data);
                // Don't stop, let the user decide
            }
        }
    }
    if(currentStream) {
       animationFrameId = requestAnimationFrame(tick);
    }
};

// --- Result Handling ---

/**
 * Processes the scanned QR code data and displays results and actions.
 * @param {string} data - The data from the scanned QR code.
 */
const handleScannedCode = (data) => {
    // Stop the scanner to show result clearly and save battery
    stopScanner();

    // Hide the camera view
    if (ui.scannerViewport) {
        ui.scannerViewport.style.display = 'none';
    }

    // Play success sound
    playSoundCallback('scan-success-sound');
    
    ui.scannerResultText.textContent = data;
    ui.scannerActions.innerHTML = '';

    // Smart actions
    if (data.startsWith('http://') || data.startsWith('https://')) {
        createActionButton(t('actions.openLink'), () => window.open(data, '_blank'));
    } else if (data.toLowerCase().startsWith('tel:')) {
        createActionButton(t('actions.call'), () => window.location.href = data);
    } else if (data.toLowerCase().startsWith('mailto:')) {
        createActionButton(t('actions.sendEmail'), () => window.location.href = data);
    } else if (data.toLowerCase().startsWith('smsto:')) {
        createActionButton(t('actions.sendSMS'), () => window.location.href = data);
    } else if (data.toLowerCase().startsWith('geo:')) {
        createActionButton(t('actions.viewOnMap'), () => window.open(`https://maps.google.com/?q=${data.substring(4)}`, '_blank'));
    } else if (data.toLowerCase().startsWith('wifi:')) {
         ui.scannerResultText.textContent = t('vcard.wifiPrefix') + "\n" + data;
    } else if (data.toUpperCase().startsWith('BEGIN:VCARD')) {
        const vcardInfo = parseVCard(data);
        let displayText = t('vcard.prefix') + "\n";
        if (vcardInfo.N) displayText += `${t('vcard.name')}: ${vcardInfo.N}\n`;
        if (vcardInfo.TEL) displayText += `${t('vcard.phone')}: ${vcardInfo.TEL}\n`;
        if (vcardInfo.EMAIL) displayText += `${t('vcard.email')}: ${vcardInfo.EMAIL}\n`;
        if (vcardInfo.ORG) displayText += `${t('vcard.org')}: ${vcardInfo.ORG}\n`;
        ui.scannerResultText.textContent = displayText.trim();
    } else if (data.toUpperCase().startsWith('BEGIN:VEVENT')) {
        ui.scannerResultText.textContent = t('vcard.calendarEvent');
    }
    
    createActionButton(t('actions.copy'), () => {
        navigator.clipboard.writeText(data);
        showToast(t('toast.copied'));
    });

    ui.scannerResultContainer.style.display = 'block';
    ui.rescanBtn.style.display = 'block';
    
    // Save to history
    const historyEntry = { data, timestamp: new Date().toISOString() };
    scannerHistory.unshift(historyEntry);
    scannerHistory = scannerHistory.slice(0, 10);
    localStorage.setItem('scannerHistory', JSON.stringify(scannerHistory));
    renderScannerHistory();
};

/**
 * Creates an action button for the scanned result.
 * @param {string} text - The button text.
 * @param {function} onClick - The function to call on click.
 */
const createActionButton = (text, onClick) => {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = 'bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors';
    button.onclick = onClick;
    ui.scannerActions.appendChild(button);
};

// --- History Functions ---

/**
 * Clears the scanner history from state and localStorage.
 */
const clearScannerHistory = () => {
    if (confirm(t('confirm.clearScannerHistory'))) {
        scannerHistory = [];
        localStorage.removeItem('scannerHistory');
        renderScannerHistory();
        showToast(t('toast.scannerHistoryCleared'));
    }
};

/**
 * Renders the list of scanned QR codes from history.
 */
const renderScannerHistory = () => {
    if(scannerHistory.length === 0) {
        ui.scannerHistoryContainer.style.display = 'none';
        return;
    }
    ui.scannerHistoryContainer.style.display = 'block';
    ui.scannerHistoryList.innerHTML = '';
    scannerHistory.forEach(item => {
        const li = document.createElement('li');
        li.className = 'bg-gray-700 p-3 rounded-md flex justify-between items-center gap-3';
        
        const textContainer = document.createElement('div');
        textContainer.className = 'flex-grow truncate';

        const dataText = document.createElement('p');
        dataText.textContent = item.data.substring(0, 40) + (item.data.length > 40 ? '...' : '');
        dataText.className = 'text-gray-300 truncate';

        const timeText = document.createElement('p');
        timeText.textContent = formatTimeAgo(new Date(item.timestamp));
        timeText.className = 'text-xs text-gray-400 mt-1';
        
        textContainer.appendChild(dataText);
        textContainer.appendChild(timeText);

        const btn = document.createElement('button');
        btn.textContent = t('actions.copy');
        btn.className = 'bg-emerald-600 text-white text-sm font-semibold py-1 px-3 rounded-md hover:bg-emerald-700 flex-shrink-0';
        btn.onclick = () => {
            navigator.clipboard.writeText(item.data);
            showToast(t('toast.copied'));
        };
        li.appendChild(textContainer);
        li.appendChild(btn);
        ui.scannerHistoryList.appendChild(li);
    });
};


// --- Event Handlers ---

const handleSwitchCamera = () => {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    stopScanner();
    setTimeout(() => startScanner(), 100); // Give time for old stream to release
};

const handleToggleFlash = async () => {
    if (!currentStream) return;
    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (capabilities.torch) {
        flashEnabled = !flashEnabled;
        try {
            await track.applyConstraints({ advanced: [{ torch: flashEnabled }] });
            ui.flashBtn.textContent = flashEnabled ? t('toggleFlashOff') : t('toggleFlashOn');
            ui.flashBtn.classList.toggle('bg-yellow-500', flashEnabled); 
            ui.flashBtn.classList.toggle('bg-gray-600/50', !flashEnabled);
            ui.flashBtn.classList.toggle('border-gray-400/50', !flashEnabled);

        } catch(e) {
            console.error('Flash error:', e);
            showToast(t('toast.flashError'));
        }
    } else {
        showToast(t('toast.noFlash'));
    }
};

/**
 * Initializes the scanner functionality and event listeners.
 */
export const initScanner = (playSound) => {
    playSoundCallback = playSound;
    ui.clearScannerHistoryBtn.addEventListener('click', clearScannerHistory);
    ui.switchCameraBtn.addEventListener('click', handleSwitchCamera);
    ui.flashBtn.addEventListener('click', handleToggleFlash);
    renderScannerHistory();

    // Add sound to dynamically created buttons
    ui.scannerHistoryList.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            playSoundCallback('click-sound');
        }
    });
    
    ui.scannerActions.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            playSoundCallback('click-sound');
        }
    });
};