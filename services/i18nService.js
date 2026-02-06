const fs = require('fs');
const path = require('path');

class I18nService {
  constructor() {
    this.translations = {};
    this.defaultLocale = 'pt';
    this.loadTranslations();
  }

  loadTranslations() {
    const locales = ['pt', 'en', 'es'];
    const baseDir = path.join(__dirname, '../i18n');

    locales.forEach(locale => {
      const filePath = path.join(baseDir, locale, 'translation.json');
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          this.translations[locale] = JSON.parse(content);
        } catch (error) {
          console.error(`Error loading translations for ${locale}:`, error);
          this.translations[locale] = {};
        }
      } else {
        console.warn(`Translation file not found for ${locale}`);
        this.translations[locale] = {};
      }
    });
  }

  t(key, locale = this.defaultLocale, params = {}) {
    const translationObj = this.translations[locale] || this.translations[this.defaultLocale] || {};
    let translated = translationObj[key] || key;

    // Replace placeholders with parameters
    Object.keys(params).forEach(param => {
      translated = translated.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
    });

    return translated;
  }

  getSupportedLocales() {
    return Object.keys(this.translations);
  }

  getDefaultLocale() {
    return this.defaultLocale;
  }

  setDefaultLocale(locale) {
    if (this.translations[locale]) {
      this.defaultLocale = locale;
    }
  }
}

module.exports = new I18nService();