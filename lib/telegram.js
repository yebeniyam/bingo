/**
 * Telegram WebApp SDK helper functions
 * Provides utilities for Telegram Mini App integration
 */

/**
 * Telegram WebApp SDK instance
 * @type {TelegramWebApp}
 */
let tg = null;

/**
 * Initialize Telegram WebApp SDK
 * @returns {boolean} True if SDK is available and initialized
 */
export function initTelegramSDK() {
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        return true;
    }
    return false;
}

/**
 * Get Telegram WebApp instance
 * @returns {TelegramWebApp|null} Telegram WebApp instance or null if not available
 */
export function getTelegramWebApp() {
    return tg;
}

/**
 * Get user ID from Telegram WebApp
 * @returns {string|null} User ID or null if not available
 */
export function getUserId() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        return tg.initDataUnsafe.user.id.toString();
    }
    return null;
}

/**
 * Get user information from Telegram WebApp
 * @returns {Object|null} User object or null if not available
 */
export function getUserInfo() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        return tg.initDataUnsafe.user;
    }
    return null;
}

/**
 * Get Telegram theme parameters
 * @returns {Object} Theme parameters object
 */
export function getThemeParams() {
    if (tg && tg.themeParams) {
        return tg.themeParams;
    }

    // Fallback theme parameters for development
    return {
        bg_color: '#ffffff',
        text_color: '#000000',
        hint_color: '#707070',
        link_color: '#4673d1',
        button_color: '#4673d1',
        button_text_color: '#ffffff',
        secondary_bg_color: '#f0f0f0',
        accent_text_color: '#000000'
    };
}

/**
 * Apply Telegram theme to CSS custom properties
 */
export function applyTelegramTheme() {
    const themeParams = getThemeParams();

    const root = document.documentElement;
    root.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
    root.style.setProperty('--tg-theme-text-color', themeParams.text_color);
    root.style.setProperty('--tg-theme-hint-color', themeParams.hint_color);
    root.style.setProperty('--tg-theme-link-color', themeParams.link_color);
    root.style.setProperty('--tg-theme-button-color', themeParams.button_color);
    root.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color);
    root.style.setProperty('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color);
    root.style.setProperty('--tg-theme-accent-text-color', themeParams.accent_text_color);
}

/**
 * Expand the Telegram WebApp to full screen
 */
export function expandWebApp() {
    if (tg && tg.expand) {
        tg.expand();
    }
}

/**
 * Set the Telegram WebApp header color
 * @param {string} color - Hex color code (e.g., '#ffffff')
 */
export function setHeaderColor(color) {
    if (tg && tg.setHeaderColor) {
        tg.setHeaderColor(color);
    }
}

/**
 * Set the Telegram WebApp background color
 * @param {string} color - Hex color code (e.g., '#ffffff')
 */
export function setBackgroundColor(color) {
    if (tg && tg.setBackgroundColor) {
        tg.setBackgroundColor(color);
    }
}

/**
 * Show the back button in Telegram WebApp
 */
export function showBackButton() {
    if (tg && tg.BackButton) {
        tg.BackButton.show();
    }
}

/**
 * Hide the back button in Telegram WebApp
 */
export function hideBackButton() {
    if (tg && tg.BackButton) {
        tg.BackButton.hide();
    }
}

/**
 * Set up back button callback
 * @param {Function} callback - Function to call when back button is pressed
 */
export function onBackButtonClick(callback) {
    if (tg && tg.BackButton) {
        tg.BackButton.onClick(callback);
    }
}

/**
 * Show loading indicator
 */
export function showLoading() {
    if (tg && tg.MainButton) {
        tg.MainButton.showProgress();
    }
}

/**
 * Hide loading indicator
 */
export function hideLoading() {
    if (tg && tg.MainButton) {
        tg.MainButton.hideProgress();
    }
}

/**
 * Set main button properties
 * @param {string} text - Button text
 * @param {Function} callback - Click callback function
 */
export function setMainButton(text, callback) {
    if (tg && tg.MainButton) {
        tg.MainButton.setText(text);
        tg.MainButton.onClick(callback);
        tg.MainButton.show();
    }
}

/**
 * Hide main button
 */
export function hideMainButton() {
    if (tg && tg.MainButton) {
        tg.MainButton.hide();
    }
}

/**
 * Show alert popup
 * @param {string} message - Alert message
 * @param {Function} callback - Callback function (optional)
 */
export function showAlert(message, callback) {
    if (tg && tg.showAlert) {
        tg.showAlert(message, callback);
    } else {
        // Fallback for development
        alert(message);
        if (callback) callback();
    }
}

/**
 * Show confirm popup
 * @param {string} message - Confirm message
 * @param {Function} callback - Callback function with confirmed parameter
 */
export function showConfirm(message, callback) {
    if (tg && tg.showConfirm) {
        tg.showConfirm(message, callback);
    } else {
        // Fallback for development
        const confirmed = confirm(message);
        callback(confirmed);
    }
}

/**
 * Show popup with custom buttons
 * @param {string} title - Popup title
 * @param {string} message - Popup message
 * @param {Array} buttons - Array of button objects with text and callback
 */
export function showPopup(title, message, buttons) {
    if (tg && tg.showPopup) {
        tg.showPopup({
            title: title,
            message: message,
            buttons: buttons.map(btn => ({
                type: 'default',
                text: btn.text,
                id: btn.id || btn.text
            }))
        }, (buttonId) => {
            const button = buttons.find(btn => (btn.id || btn.text) === buttonId);
            if (button && button.callback) {
                button.callback();
            }
        });
    } else {
        // Fallback for development
        const buttonTexts = buttons.map(btn => btn.text).join(', ');
        const confirmed = confirm(`${title}\n\n${message}\n\nButtons: ${buttonTexts}`);
        if (confirmed && buttons[0] && buttons[0].callback) {
            buttons[0].callback();
        }
    }
}

/**
 * Open Telegram invoice for payment
 * @param {Object} invoiceParams - Invoice parameters
 * @param {Function} callback - Callback function with invoice status
 */
export function openInvoice(invoiceParams, callback) {
    if (tg && tg.openInvoice) {
        tg.openInvoice(invoiceParams, callback);
    } else {
        // Mock implementation for development
        console.log('Mock invoice opened:', invoiceParams);
        setTimeout(() => {
            callback('paid');
        }, 2000);
    }
}

/**
 * Open Telegram link
 * @param {string} url - URL to open
 */
export function openLink(url) {
    if (tg && tg.openLink) {
        tg.openLink(url);
    } else {
        // Fallback for development
        window.open(url, '_blank');
    }
}

/**
 * Open Telegram app
 * @param {string} path - Path to open in Telegram app
 */
export function openTelegramLink(path) {
    if (tg && tg.openTelegramLink) {
        tg.openTelegramLink(path);
    } else {
        // Fallback for development
        console.log('Would open Telegram link:', path);
    }
}

/**
 * Share content to Telegram
 * @param {string} text - Text to share
 * @param {string} url - URL to share (optional)
 */
export function shareToTelegram(text, url) {
    if (tg && tg.shareToTelegram) {
        tg.shareToTelegram({
            text: text,
            url: url
        });
    } else {
        // Fallback for development
        console.log('Would share to Telegram:', text, url);
    }
}

/**
 * Get init data for server-side validation
 * @returns {string|null} Init data string or null if not available
 */
export function getInitData() {
    if (tg && tg.initData) {
        return tg.initData;
    }
    return null;
}

/**
 * Get init data unsafe (parsed) for client-side use
 * @returns {Object|null} Parsed init data or null if not available
 */
export function getInitDataUnsafe() {
    if (tg && tg.initDataUnsafe) {
        return tg.initDataUnsafe;
    }
    return null;
}

/**
 * Validate init data (client-side validation)
 * @param {string} botToken - Bot token for validation
 * @returns {boolean} True if init data is valid
 */
export function validateInitData(botToken) {
    if (tg && tg.validateInitData) {
        return tg.validateInitData(botToken);
    }
    return false;
}

/**
 * Check if running in Telegram WebApp
 * @returns {boolean} True if running in Telegram WebApp
 */
export function isInTelegramWebApp() {
    return typeof window !== 'undefined' &&
           window.Telegram &&
           window.Telegram.WebApp &&
           window.Telegram.WebApp.initData;
}

/**
 * Check if running in development mode (outside Telegram)
 * @returns {boolean} True if in development mode
 */
export function isDevelopmentMode() {
    return !isInTelegramWebApp();
}

/**
 * Get platform information
 * @returns {string} Platform name
 */
export function getPlatform() {
    if (tg && tg.platform) {
        return tg.platform;
    }
    return 'unknown';
}

/**
 * Get version information
 * @returns {string} WebApp version
 */
export function getVersion() {
    if (tg && tg.version) {
        return tg.version;
    }
    return '1.0';
}

/**
 * Check if specific WebApp method is supported
 * @param {string} method - Method name to check
 * @returns {boolean} True if method is supported
 */
export function isMethodSupported(method) {
    if (!tg) return false;

    switch (method) {
        case 'expand':
            return !!tg.expand;
        case 'setHeaderColor':
            return !!tg.setHeaderColor;
        case 'setBackgroundColor':
            return !!tg.setBackgroundColor;
        case 'showPopup':
            return !!tg.showPopup;
        case 'showAlert':
            return !!tg.showAlert;
        case 'showConfirm':
            return !!tg.showConfirm;
        case 'openInvoice':
            return !!tg.openInvoice;
        case 'openLink':
            return !!tg.openLink;
        case 'shareToTelegram':
            return !!tg.shareToTelegram;
        default:
            return false;
    }
}

/**
 * Get WebApp capabilities
 * @returns {Object} Object with supported features
 */
export function getCapabilities() {
    return {
        platform: getPlatform(),
        version: getVersion(),
        isInTelegram: isInTelegramWebApp(),
        isDevelopment: isDevelopmentMode(),
        supportedMethods: {
            expand: isMethodSupported('expand'),
            setHeaderColor: isMethodSupported('setHeaderColor'),
            setBackgroundColor: isMethodSupported('setBackgroundColor'),
            showPopup: isMethodSupported('showPopup'),
            showAlert: isMethodSupported('showAlert'),
            showConfirm: isMethodSupported('showConfirm'),
            openInvoice: isMethodSupported('openInvoice'),
            openLink: isMethodSupported('openLink'),
            shareToTelegram: isMethodSupported('shareToTelegram')
        }
    };
}

/**
 * Initialize all Telegram WebApp features
 * Call this at the start of your application
 */
export function initializeWebApp() {
    if (!initTelegramSDK()) {
        console.warn('Telegram WebApp SDK not available');
        return false;
    }

    // Apply theme
    applyTelegramTheme();

    // Expand to full screen
    expandWebApp();

    // Set up error handling
    if (tg.onEvent) {
        tg.onEvent('viewportChanged', applyTelegramTheme);
    }

    return true;
}

/**
 * Clean up Telegram WebApp resources
 * Call this when closing the application
 */
export function cleanupWebApp() {
    if (tg && tg.BackButton) {
        tg.BackButton.hide();
    }

    if (tg && tg.MainButton) {
        tg.MainButton.hide();
    }
}
