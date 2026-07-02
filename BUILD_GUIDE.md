# MediPlus — Android APK Build Guide

## Prerequisites

Install these on your Windows / Mac / Linux computer:

1. **Node.js 18+** → https://nodejs.org
2. **Java JDK 17** → https://adoptium.net
3. **Android Studio** → https://developer.android.com/studio
   - During install, enable: Android SDK, Android SDK Platform, Android Virtual Device
4. **React Native CLI**
   ```
   npm install -g react-native-cli
   ```

---

## Step 1 — Create the React Native project

```bash
npx react-native@0.73.6 init MediPlus
cd MediPlus
```

---

## Step 2 — Replace source files

Copy ALL files from this ZIP into your `MediPlus/` folder:
- `App.js` → root
- `src/` folder → root
- `package.json` → root (merge dependencies)

---

## Step 3 — Install dependencies

```bash
npm install
```

---

## Step 4 — Run on Android Emulator (for testing)

```bash
# Start Metro bundler
npx react-native start

# In a second terminal, run on Android
npx react-native run-android
```

---

## Step 5 — Build a Release APK

### 5a. Generate a signing key
```bash
keytool -genkey -v -keystore mediplus.keystore \
  -alias mediplus -keyalg RSA -keysize 2048 -validity 10000
```
Move `mediplus.keystore` to `android/app/`

### 5b. Configure signing in `android/app/build.gradle`
```gradle
android {
  ...
  signingConfigs {
    release {
      storeFile file('mediplus.keystore')
      storePassword 'YOUR_PASSWORD'
      keyAlias 'mediplus'
      keyPassword 'YOUR_PASSWORD'
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled true
      proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
  }
}
```

### 5c. Build the APK
```bash
cd android
./gradlew assembleRelease
```

### 5d. Find your APK
```
android/app/build/outputs/apk/release/app-release.apk
```

Transfer to your Android phone and install! ✅

---

## App Structure

```
MediPlus/
├── App.js                        ← Entry point
├── src/
│   ├── data/
│   │   └── medicines.js          ← All data & colours
│   ├── navigation/
│   │   └── AppNavigator.js       ← Bottom tab navigation
│   └── screens/
│       ├── DashboardScreen.js    ← Home, stats, alerts
│       ├── InventoryScreen.js    ← Stock list, search, filter
│       ├── BillingScreen.js      ← POS billing, GST calc
│       ├── CustomersScreen.js    ← Customer list & dues
│       └── ReportsScreen.js      ← Sales, top items, GST
└── package.json
```

---

## Features Included

| Feature | Screen |
|---|---|
| Daily sales stats | Dashboard |
| Low stock & expiry alerts | Dashboard |
| Medicine search + category filter | Inventory |
| Add to bill from inventory | Inventory |
| Live billing with GST (5%) | Billing |
| Print / WhatsApp / UPI / Complete | Billing |
| Customer list with dues | Customers |
| Loyalty tier (Regular / Gold / VIP) | Customers |
| Revenue, profit, bills summary | Reports |
| Top-selling chart | Reports |
| Payment method breakdown | Reports |
| GST report + export | Reports |

---

## Next Steps (Advanced)

- **Database**: Add SQLite via `react-native-sqlite-storage`
- **Barcode scan**: Add `react-native-vision-camera`
- **PDF receipts**: Add `react-native-pdf-lib`
- **WhatsApp sharing**: Add `react-native-share`
- **Cloud backup**: Add Firebase / Supabase
- **Play Store**: Follow https://reactnative.dev/docs/signed-apk-android

---

## Support
Built with React Native 0.73 · Navigation 6 · Paper UI
