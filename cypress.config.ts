import { defineConfig } from 'cypress';
import path from 'path';

export default defineConfig({
  video: true,
  videosFolder: 'artifacts/videos',
  screenshotsFolder: 'artifacts/screenshots',
  videoCompression: 32,
  viewportWidth: 1280,
  viewportHeight: 800,
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      on('before:browser:launch', (browser, launchOptions) => {
        // Load unpacked extension into Chromium browser instance
        if (browser.family === 'chromium') {
          const extensionPath = path.resolve(process.cwd(), 'dist');
          launchOptions.args.push(`--disable-extensions-except=${extensionPath}`);
          launchOptions.args.push(`--load-extension=${extensionPath}`);
          launchOptions.args.push('--no-sandbox');
          launchOptions.args.push('--disable-gpu');
        }
        return launchOptions;
      });
      return config;
    },
  },
});
