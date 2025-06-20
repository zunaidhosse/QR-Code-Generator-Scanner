// generator.js: Handles all QR code generation logic

import * as ui from '/ui.js';
import { showToast, formatTimeAgo } from '/ui.js';
import { t } from '/language.js';

// --- State ---
let qrCodeInstance;
let generatorHistory = JSON.parse(localStorage.getItem('generatorHistory')) || [];

// --- Functions ---

/**
 * Shows the correct form section based on the selected QR code type.
 */
const updateForm = () => {
    const selectedType = document.querySelector('input[name="qrType"]:checked').value;
    document.querySelectorAll('.form-section').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(`form-${selectedType}`).classList.add('active');
};

/**
 * Gathers data from the active form to generate the QR code.
 * @returns {string} The data string for the QR code.
 */
const getQrData = () => {
    const type = document.querySelector('input[name="qrType"]:checked').value;
    switch (type) {
        case 'text':
            return document.getElementById('text-input').value;
        case 'vcard':
            const name = document.getElementById('vcard-name').value;
            const tel = document.getElementById('vcard-tel').value;
            const email = document.getElementById('vcard-email').value;
            const org = document.getElementById('vcard-org').value;
            const address = document.getElementById('vcard-address').value;
            return `BEGIN:VCARD\nVERSION:3.0\nN:${name}\nTEL:${tel}\nEMAIL:${email}\nORG:${org}\nADR:${address}\nEND:VCARD`;
        case 'wifi':
            const ssid = document.getElementById('wifi-ssid').value;
            const password = document.getElementById('wifi-password').value;
            const encryption = document.getElementById('wifi-encryption').value;
            return `WIFI:T:${encryption};S:${ssid};P:${password};;`;
        case 'email':
            const to = document.getElementById('email-to').value;
            const subject = document.getElementById('email-subject').value;
            const body = document.getElementById('email-body').value;
            return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        case 'sms':
            return `smsto:${document.getElementById('sms-tel').value}:${document.getElementById('sms-body').value}`;
        case 'tel':
            return `tel:${document.getElementById('tel-number').value}`;
        case 'geo':
            const lat = document.getElementById('geo-lat').value;
            const lon = document.getElementById('geo-lon').value;
            return `geo:${lat},${lon}`;
        case 'event':
            const summary = document.getElementById('event-summary').value;
            const start = document.getElementById('event-start').value;
            const end = document.getElementById('event-end').value;
            const desc = document.getElementById('event-desc').value;
            // Format to iCalendar standard (YYYYMMDDTHHMMSSZ)
            const formatDT = (dt) => dt ? new Date(dt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : '';
            return `BEGIN:VEVENT\nSUMMARY:${summary}\nDTSTART:${formatDT(start)}\nDTEND:${formatDT(end)}\nDESCRIPTION:${desc}\nEND:VEVENT`;
        default:
            return '';
    }
};

/**
 * Renders the generated QR code to the screen as a PNG.
 */
const handleGenerate = () => {
    const data = getQrData();
    if (!data) {
        showToast(t('toast.fillInfo'));
        return;
    }

    const type = document.querySelector('input[name="qrType"]:checked').value;
    const errorCorrectionLevel = document.getElementById('error-correction').value;
    const fgColor = document.getElementById('fg-color').value;
    const bgColorInput = document.getElementById('bg-color').value;
    // For glass effect, we want a transparent background for the QR code itself
    // so it sits nicely on the card. The user's color choice is for the container.
    const bgColor = '#00000000'; // Always transparent for the QR code image
    
    ui.qrcodeContainer.style.backgroundColor = bgColorInput;

    qrCodeInstance = qrcode(0, errorCorrectionLevel);
    qrCodeInstance.addData(data);
    qrCodeInstance.make();

    // Create canvas for PNG download
    const canvas = document.createElement('canvas');
    const scale = 8;
    const size = qrCodeInstance.getModuleCount();
    canvas.width = canvas.height = size * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fgColor;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (qrCodeInstance.isDark(row, col)) {
                ctx.fillRect(col * scale, row * scale, scale, scale);
            }
        }
    }
    
    ui.qrcodeContainer.innerHTML = '';
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    img.style.width = '256px';
    img.style.height = '256px';
    img.style.imageRendering = 'pixelated';
    ui.qrcodeContainer.appendChild(img);

    ui.downloadPngBtn.href = img.src;
    ui.downloadPngBtn.download = 'qrcode.png';

    ui.qrResultDiv.style.display = 'block';

    // Save to history
    const historyEntry = { type, data, timestamp: new Date().toISOString() };
    generatorHistory.unshift(historyEntry);
    generatorHistory = generatorHistory.slice(0, 10); // Keep last 10
    localStorage.setItem('generatorHistory', JSON.stringify(generatorHistory));
    renderGeneratorHistory();
};

/**
 * Triggers the download of the QR code as an SVG file.
 */
const handleSvgDownload = () => {
    if (!qrCodeInstance) return;

    const fgColor = document.getElementById('fg-color').value;
    const bgColor = document.getElementById('bg-color').value;
    const size = qrCodeInstance.getModuleCount();
    const margin = 4;
    const scale = 1; // SVG is scalable, so we use 1 module = 1 unit
    const svgSize = size + margin * 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" shape-rendering="crispEdges">`;
    svg += `<rect width="100%" height="100%" fill="${bgColor}"/>`;
    
    svg += `<g fill="${fgColor}">`;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (qrCodeInstance.isDark(row, col)) {
                svg += `<rect x="${col + margin}" y="${row + margin}" width="${scale}" height="${scale}"/>`;
            }
        }
    }
    svg += `</g></svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrcode.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// --- History Functions ---

/**
 * Clears the generator history from state and localStorage.
 */
const clearGeneratorHistory = () => {
    if (confirm(t('confirm.clearGeneratorHistory'))) {
        generatorHistory = [];
        localStorage.removeItem('generatorHistory');
        renderGeneratorHistory();
        showToast(t('toast.generatorHistoryCleared'));
    }
};

/**
 * Renders the list of generated QR codes from history.
 */
const renderGeneratorHistory = () => {
    if(generatorHistory.length === 0) {
        ui.generatorHistoryContainer.style.display = 'none';
        return;
    }
    ui.generatorHistoryContainer.style.display = 'block';
    ui.generatorHistoryList.innerHTML = '';
    generatorHistory.forEach(item => {
        const li = document.createElement('li');
        li.className = 'bg-gray-700 p-3 rounded-md flex justify-between items-center gap-3';
        
        const textContainer = document.createElement('div');
        textContainer.className = 'flex-grow truncate';

        const dataText = document.createElement('p');
        const typeName = t(`type.${item.type}`);
        dataText.textContent = `(${typeName}) ${item.data.substring(0, 30)}...`;
        dataText.className = 'text-gray-300 truncate';

        const timeText = document.createElement('p');
        timeText.textContent = formatTimeAgo(new Date(item.timestamp));
        timeText.className = 'text-xs text-gray-400 mt-1';
        
        textContainer.appendChild(dataText);
        textContainer.appendChild(timeText);

        const btn = document.createElement('button');
        btn.textContent = t('regenerate');
        btn.className = 'bg-indigo-600 text-white text-sm font-semibold py-1 px-3 rounded-md hover:bg-indigo-700 flex-shrink-0';
        btn.onclick = () => {
            populateFormFromHistory(item);
            showToast(t('toast.formPopulated'));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        li.appendChild(textContainer);
        li.appendChild(btn);
        ui.generatorHistoryList.appendChild(li);
    });
};

/**
 * Fills the generator form with data from a history item.
 * @param {object} item - The history item.
 */
const populateFormFromHistory = (item) => {
    // Switch to the correct type
    const radio = document.querySelector(`input[name="qrType"][value="${item.type}"]`);
    if (radio) {
        radio.checked = true;
        updateForm();
    }

    const data = item.data;

    // Populate fields based on type
    switch (item.type) {
        case 'text':
            document.getElementById('text-input').value = data;
            break;
        case 'wifi':
            document.getElementById('wifi-ssid').value = data.match(/S:([^;]+)/)?.[1] || '';
            document.getElementById('wifi-password').value = data.match(/P:([^;]+)/)?.[1] || '';
            document.getElementById('wifi-encryption').value = data.match(/T:([^;]+)/)?.[1] || 'WPA';
            break;
        case 'email':
            document.getElementById('email-to').value = data.match(/mailto:([^?]+)/)?.[1] || '';
            document.getElementById('email-subject').value = decodeURIComponent(data.match(/subject=([^&]+)/)?.[1] || '');
            document.getElementById('email-body').value = decodeURIComponent(data.match(/body=([^&]+)/)?.[1] || '');
            break;
        case 'sms':
             const smsParts = data.replace('smsto:', '').split(':');
             document.getElementById('sms-tel').value = smsParts[0] || '';
             document.getElementById('sms-body').value = smsParts[1] || '';
            break;
        case 'tel':
            document.getElementById('tel-number').value = data.replace('tel:', '');
            break;
         case 'vcard':
            const vcard = parseVCard(data);
            document.getElementById('vcard-name').value = vcard.N || '';
            document.getElementById('vcard-tel').value = vcard.TEL || '';
            document.getElementById('vcard-email').value = vcard.EMAIL || '';
            document.getElementById('vcard-org').value = vcard.ORG || '';
            document.getElementById('vcard-address').value = vcard.ADR || '';
            break;
        case 'geo':
            const coords = data.replace('geo:', '').split(',');
            document.getElementById('geo-lat').value = coords[0] || '';
            document.getElementById('geo-lon').value = coords[1] || '';
            break;
        case 'event':
             const toLocalDT = (isoStr) => {
                if(!isoStr) return '';
                const date = new Date(isoStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
                // Adjust for timezone offset to display correctly in local time input
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                return date.toISOString().slice(0, 16);
             };
            document.getElementById('event-summary').value = data.match(/SUMMARY:(.*)/)?.[1]?.trim() || '';
            document.getElementById('event-start').value = toLocalDT(data.match(/DTSTART:(.*)/)?.[1]?.trim() || '');
            document.getElementById('event-end').value = toLocalDT(data.match(/DTEND:(.*)/)?.[1]?.trim() || '');
            document.getElementById('event-desc').value = data.match(/DESCRIPTION:(.*)/)?.[1]?.trim() || '';
            break;
    }
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * Initializes the generator functionality and event listeners.
 */
export const initGenerator = (playClickSound) => {
    ui.qrTypeSelector.addEventListener('change', updateForm);
    ui.qrTypeSelector.addEventListener('click', (e) => {
        // Play sound when user clicks on the type labels
        if (e.target.closest('label')) {
            playClickSound();
        }
    });
    ui.generateBtn.addEventListener('click', handleGenerate);
    ui.downloadSvgBtn.addEventListener('click', handleSvgDownload);
    ui.downloadPngBtn.addEventListener('click', () => {}); // Let the sound play from main.js
    ui.clearGeneratorHistoryBtn.addEventListener('click', clearGeneratorHistory);
    updateForm();
    renderGeneratorHistory();

    // Add sound to history buttons as they are created dynamically
    ui.generatorHistoryList.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            playClickSound();
        }
    });
};