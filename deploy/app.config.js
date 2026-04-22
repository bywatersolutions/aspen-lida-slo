const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadSync(url, filepath) {
  if (fs.existsSync(filepath)) {
    console.log(`✓ ${path.basename(filepath)} already exists`);
    return;
  }

  console.log(`Downloading ${url}`);
  execSync(`curl -L --fail "${url}" -o "${filepath}"`, {
    stdio: 'inherit',
  });
}

const app = require('../deploy/app.json');

const ASSETS_DIR = path.resolve(__dirname, 'assets/generated');
ensureDir(ASSETS_DIR);

const types = [
  'appIcon',
  'appSplash',
  'appIconAndroid',
  'appNotification',
  'appLogin',
  'logoApp',
];

for (const type of types) {
  const params = new URLSearchParams({
    method: 'getLogoFile',
    themeId: String(app['themeId']),
    type: type,
    slug: app['slug'],
  });

  const url = `${app['discoveryUrl']}/API/SystemAPI?${params.toString()}`;
  const filepath = path.join(ASSETS_DIR, `${type}.png`);

  downloadSync(url, filepath);
}

module.exports = () => {
    const version = require('../version.json');
    const build = require('../deploy/build.json');
    let versionAsInt = build['build'];
    versionAsInt = parseInt(versionAsInt, 10);
    
    const generated = file => path.resolve(__dirname, 'assets/generated', file);
     
    const googleApiKeyApple = process.env.GOOGLE_API_KEY_APPLE;
    const googleApiKeyAndroid = process.env.GOOGLE_API_KEY_ANDROID;
    const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
    let extraHeaders = [];
    if (process.env.EXTRA_HEADERS) {
        try {
            const parsed = JSON.parse(process.env.EXTRA_HEADERS);
            if (Array.isArray(parsed)) {
                extraHeaders = parsed;
            } else {
                console.warn('EXTRA_HEADERS must be a JSON array, ignoring');
            }
        } catch (e) {
            console.warn('EXTRA_HEADERS is not valid JSON, ignoring:', e.message);
        }
    }

    let config = {
         name: app['name'],
         slug: app['slug'],
         scheme: app['slug'],
         owner: "bywater-solutions",
         platforms: ['ios', 'android'],
         version: version['version'],
         sdkVersion: '53.0.0',
         newArchEnabled: false,
         userInterfaceStyle: 'automatic',
         orientation: 'default',
         icon: generated('appIcon.png'),
         updates: {
              enabled: true,
              checkAutomatically: 'ON_LOAD',
              fallbackToCacheTimeout: 250000,
              url: 'https://u.expo.dev/' + app['easId'],
         },
         runtimeVersion: build['build'],
         splash: {
              image: generated('appSplash.png'),
              resizeMode: 'contain',
              backgroundColor: app['background'],
         },
         assetBundlePatterns: ['**/*'],
         ios: {
              buildNumber: build['build'],
              bundleIdentifier: app['reverseDns'],
              supportsTablet: true,
              icon: generated('appIcon.png'),
              infoPlist: {
                   NSLocationAlwaysAndWhenInUseUsageDescription: 'This app uses your location to find nearby libraries to make logging in easier',
                   NSLocationWhenInUseUsageDescription: 'This app uses your location to find nearby libraries to make logging in easier',
                   LSApplicationQueriesSchemes: ['comgooglemaps', 'citymapper', 'uber', 'lyft', 'waze', 'aspen-lida', 'aspen-lida-beta', 'itms-apps'],
                   CFBundleAllowMixedLocalizations: true,
                   NSCameraUsageDescription: 'This app uses your camera to scan barcodes when searching for items in the library catalog',
                   NSMicrophoneUsageDescription: 'This app uses your microphone when scanning barcodes when searching for items in the library catalog',
                   NSCalendarsUsageDescription: 'This app can add library events to your calendar',
                   NSRemindersUsageDescription: 'This app can add library events to your reminders',
              },
              config: {
                   googleMapsApiKey: googleApiKeyApple,
                   usesNonExemptEncryption: false,
              },
              privacyManifests: {
                   NSPrivacyAccessedAPITypes: [
                        {
                             NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
                             NSPrivacyAccessedAPITypeReasons: ['E174.1'],
                        },
                        {
                             NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
                             NSPrivacyAccessedAPITypeReasons: ['8FFB.1'],
                        },
                        {
                             NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
                             NSPrivacyAccessedAPITypeReasons: ['DDA9.1'],
                        },
                        {
                             NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
                             NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
                        },
                   ],
              },
         },
         android: {
              allowBackup: false,
              package: app['reverseDns'],
              versionCode: versionAsInt,
              permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'RECEIVE_BOOT_COMPLETED', 'SCHEDULE_EXACT_ALARM', 'CAMERA', 'READ_CALENDAR', 'WRITE_CALENDAR'],
              adaptiveIcon: {
                   foregroundImage: generated('appIconAndroid.png'),
                   backgroundColor: app['background'],
              },
              icon: generated('appIconAndroid.png'),
              config: {
                   googleMaps: {
                        apiKey: googleApiKeyAndroid,
                   },
              },
              edgeToEdgeEnabled: true
         },
         notification: {
              icon: generated('appNotification.png'),
         },
         extra: {
              apiUrl: app['discoveryUrl'],
              greenhouseUrl: app['greenhouseUrl'],
              loginLogo: generated('appLogin.png'),
              libraryCardLogo: generated('logoApp.png'),
              backgroundColor: app['background'],
              libraryId: app['libraryId'],
              themeId: app['themeId'],
              sentryDSN: app['sentryDsn'],
              eas: {
                   projectId: app['easId'],
              },
              iosStoreUrl: 'itms-apps://apps.apple.com/id/app/' + app['slug'] + '/id' + app['ascAppId'],
              androidStoreUrl: 'market://details?id=' + app['reverseDns'],
              patch: version['patch'],
              stage: version['stage'],
              logLevel: app['logLevel'],
              headers: extraHeaders
         },
         plugins: [
              'expo-secure-store',
              'expo-localization',
              'expo-notifications',
              [
                   'expo-location',
                   {
                        locationAlwaysAndWhenInUsePermission: 'This app uses your location to find nearby libraries to make logging in easier',
                   },
              ],
              ['expo-calendar', { calendarPermission: 'This app can add library events to your calendar' }],
              ['expo-camera', { cameraPermission: 'This app uses your camera to scan barcodes when searching for items in the library catalog or when scanning your library card.' }],
              [
                   '@sentry/react-native/expo',
                   {
                        authToken: sentryAuthToken,
                        organization: "bywater-solutions",
                        project: app['sentryProject'],
                   },
              ],
              [
                   'expo-build-properties',
                   {
                        android: {
                             compileSdkVersion: 35,
                             targetSdkVersion: 35,
                             buildToolsVersion: '35.0.0',
                        },
                        ios: {
                             deploymentTarget: '15.1',
                        },
                   },
              ],
              [
                 'expo-web-browser'
              ]
         ],
     };
     return config;
};
