const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Create a promise that resolves when the credentials are found
  const credentialsPromise = new Promise((resolve, reject) => {
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('cognito-identity.eu-south-1.amazonaws.com')) {
        console.log('Cognito response captured from:', url);
        try {
          const json = await response.json();
          // The actual credentials are in a nested structure
          if (json.Credentials) {
            const credentials = {
              accessKeyId: json.Credentials.AccessKeyId,
              secretAccessKey: json.Credentials.SecretKey,
              sessionToken: json.Credentials.SessionToken,
            };
            fs.writeFileSync('./tmp/aws_creds.json', JSON.stringify(credentials, null, 2));
            console.log('Successfully extracted AWS credentials and saved to ./tmp/aws_creds.json');
            resolve(credentials);
          } else {
            console.log('Cognito response does not contain Credentials.');
          }
        } catch (error) {
          console.error('Failed to parse or save JSON response from Cognito:', error);
          reject(error);
        }
      }
    });
  });

  try {
    console.log('Navigating to the page to obtain AWS credentials...');
    await page.goto('https://www.piattaformaunicanazionale.it/idr', { waitUntil: 'networkidle' });
    console.log('Navigation complete. Waiting for Cognito response...');

    // Wait for the credentials to be captured, with a timeout
    await Promise.race([
        credentialsPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for Cognito response')), 30000))
    ]);

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await browser.close();
  }
})();
