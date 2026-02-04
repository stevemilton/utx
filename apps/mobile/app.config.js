// Dynamic Expo config - supports EAS secrets for Firebase credentials
const IS_EAS_BUILD = process.env.EAS_BUILD === 'true';

module.exports = {
  expo: {
    name: 'UTx',
    slug: 'utx',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: false,
    scheme: 'utx',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#FFFFFF',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.utx.app',
      usesAppleSignIn: true,
      infoPlist: {
        NSCameraUsageDescription: 'UTx needs camera access to photograph your erg screen',
        NSPhotoLibraryUsageDescription: 'UTx needs photo library access to upload erg screen photos',
        ITSAppUsesNonExemptEncryption: false,
      },
      // Use EAS secret file path when building on EAS, otherwise use local file
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      package: 'com.utx.app',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
      permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-apple-authentication',
      [
        'expo-camera',
        {
          cameraPermission: 'Allow UTx to access your camera to photograph erg screens',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow UTx to access your photos to upload erg screen images',
        },
      ],
      [
        '@sentry/react-native/expo',
        {
          organization: 'polar-industries',
          project: 'utx',
          // Disable source map upload until auth token is configured in EAS
          // Set SENTRY_AUTH_TOKEN in EAS env vars to enable
          uploadNativeSymbols: process.env.SENTRY_AUTH_TOKEN ? true : false,
          autoUploadSourceMaps: process.env.SENTRY_AUTH_TOKEN ? true : false,
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'e091f145-3f0a-459a-990d-bd18db0d747d',
      },
    },
    owner: 'stevemilton',
  },
};
