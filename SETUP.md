# GradeSmart Setup Guide

## Quick Start

1. **Install Dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Add Asset Images:**
   The app requires image assets to run. You need to add the following files to the `assets/` directory:
   - `icon.png` (1024x1024px) - App icon
   - `splash.png` (1242x2436px) - Splash screen
   - `adaptive-icon.png` (1024x1024px) - Android adaptive icon
   - `favicon.png` (48x48px) - Web favicon

   You can create these using any image editor, or use online tools like:
   - [Canva](https://www.canva.com)
   - [Figma](https://www.figma.com)
   - [GIMP](https://www.gimp.org) (free)

   For quick testing, you can use simple solid color images or download placeholder images.

3. **Start the Development Server:**
   ```bash
   npm start
   ```

4. **Run on Your Device:**
   - Install Expo Go app on your iOS or Android device
   - Scan the QR code shown in the terminal
   - The app should load on your device

## Troubleshooting

### SDK Version Mismatch
If you see an SDK version mismatch error:
- The project is configured for Expo SDK 54
- Make sure your Expo Go app is updated to the latest version
- Or use `npx expo start --dev-client` for a development build

### Missing Assets Error
If you see "Asset not found" errors:
- Make sure all required image files exist in the `assets/` directory
- The files must be valid PNG images (not empty files)
- Check that file names match exactly: `icon.png`, `splash.png`, etc.

### Dependency Issues
If you encounter dependency conflicts:
- Run `npm install --legacy-peer-deps` to install with relaxed peer dependency checks
- Or use `npx expo install --fix` to auto-fix compatible versions

### Camera Permission
- On first launch, the app will request camera permission
- Make sure to grant permission when prompted
- If denied, you can enable it in device settings

## Notes

- The app uses React 19.1.0 and React Native 0.81.5 (Expo SDK 54)
- All dependencies are installed with `--legacy-peer-deps` flag to handle peer dependency conflicts
- The Camera API uses the newer `CameraView` component from expo-camera v17

## Next Steps

1. Replace placeholder assets with actual app icons
2. Customize colors and branding in `src/theme/colors.js`
3. Add backend integration for data persistence
4. Implement OCR functionality for answer detection
5. Add export functionality for results
