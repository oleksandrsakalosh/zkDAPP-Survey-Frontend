# zkDAPP Survey Frontend

Mobile frontend for a decentralized voting/survey system.  
This app is built with Expo + React Native and currently includes a tab-based structure for:
- `home`
- `surveyList`
- `newSurvey`
- `profile`

## Tech Stack

- Expo SDK 54
- React 19 + React Native 0.81
- Expo Router (file-based navigation)
- TypeScript

## Prerequisites

- Node.js 20 LTS (recommended)
- npm 10+
- Android Studio (with Android SDK installed)
- Android Emulator or physical device
- IDE: VS Code (recommended)

## Quick Setup

### 1. Install Dependencies

```bash
npm ci
```

> **Note:** Use `npm ci` (not `npm install`) to install exactly from the lockfile. Running `npm install` followed by `npm audit fix` will break the dependency tree.

### 2. Configure Android SDK Path

Create `android/local.properties` with your Android SDK location:

```properties
sdk.dir=C:\\Users\\<YourUsername>\\AppData\\Local\\Android\\Sdk
```

**To find your SDK path:** Open Android Studio → Settings → Appearance & Behavior → System Settings → Android SDK

### 3. Run The Project

Start the Expo dev server:

```bash
npx expo start
```

Build and run on Android emulator:

```bash
npx expo run:android
```

## Running with Valera Wallet

To test credential sharing with Valera wallet, you'll need both apps running on the same Android emulator. 

**Quick steps:**
1. Set up and run zkDAPP Survey Frontend (steps above)
2. Set up Valera wallet - see [Valera README](../valera/README.md#quick-setup) for setup instructions
3. Both apps will communicate via deep links on the same emulator

## Proof Generator (Test Flow)

- Start proof service in a separate terminal:

```bash
npm run proof:service
```

- use emulator for easiest localhost routing
- place your `.ptau` file under `zk/ptau/` before running proof generation
- full native in-app proof generator module is in future-future work and not implemented yet.

## Useful Scripts

- `npm run start` - start Expo dev server
- `npm run android` - run on Android emulator/device
- `npm run ios` - run on iOS simulator/device
- `npm run web` - run web target
- `npm run lint` - run lint checks
- `npm run proof:service` - local proof service for Proof Generator test flow

## Project Structure

```text
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    home.tsx
    surveyList.tsx
    newSurvey.tsx
    profile.tsx
```

## Notes

- Routing is handled with Expo Router based on files under `app/`.
- App metadata and native config live in `app.json`.


## Developer Team

- Anna Sikalenko
- Karolina Skrypova
- Oleh Fedunchyk
- Oleksandr Sakalosh
- Viktoriia Femiak
- Yehor Lykhachov