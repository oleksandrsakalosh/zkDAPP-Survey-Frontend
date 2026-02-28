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
- IDE: VS Code (recommended)
- Expo Go app installed on physical mobile device

## Detailed Setup

Check [SETUP.md](SETUP.md) for detailed setup instructions (both Valera and zkDAPP)


## Install Dependencies

```bash
npm install
```

## Run The Project

Start the Expo dev server:

```bash
npx expo start
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Useful Scripts

- `npm run start` - start Expo dev server
- `npm run android` - run on Android emulator/device
- `npm run ios` - run on iOS simulator/device
- `npm run web` - run web target
- `npm run lint` - run lint checks

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