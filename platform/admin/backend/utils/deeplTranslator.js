const deepl = require('deepl-node');
const { apiError } = require('../middleware/api-error');

let cachedTranslator = null;
let cachedAuthKey = null;

function getAuthKey() {
    return typeof process.env.DEEPL_API_KEY === 'string'
        ? process.env.DEEPL_API_KEY.trim()
        : '';
}

function getTranslator() {
    const authKey = getAuthKey();
    if (!authKey) {
        throw apiError.serviceUnavailable('deepl_not_configured');
    }

    if (!cachedTranslator || cachedAuthKey !== authKey) {
        cachedTranslator = new deepl.Translator(authKey);
        cachedAuthKey = authKey;
    }

    return cachedTranslator;
}

async function translateText(value, targetLanguage) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
        return '';
    }

    const translator = getTranslator();
    const result = await translator.translateText(text, null, targetLanguage);
    if (Array.isArray(result)) {
        return result.map((entry) => entry?.text || '').join('\n');
    }
    return result?.text || '';
}

async function translateFields(fields, targetLanguage) {
    const keys = Object.keys(fields || {});
    const translatedEntries = await Promise.all(keys.map(async (key) => {
        const value = typeof fields[key] === 'string' ? fields[key] : '';
        if (!value.trim()) {
            return [key, ''];
        }
        const translated = await translateText(value, targetLanguage);
        return [key, translated];
    }));

    return Object.fromEntries(translatedEntries);
}

async function translateFieldsWithFallback(fields, targetLanguage) {
    try {
        const translated = await translateFields(fields, targetLanguage);
        return {
            translated,
            usedFallback: false
        };
    } catch (error) {
        if (error?.message !== 'deepl_not_configured') {
            throw error;
        }

        const fallback = Object.fromEntries(
            Object.entries(fields || {}).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : ''])
        );
        return {
            translated: fallback,
            usedFallback: true
        };
    }
}

module.exports = {
    getTranslator,
    translateText,
    translateFields,
    translateFieldsWithFallback
};
