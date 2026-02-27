
### Android SDK Setup

1. Open Android Studio
2. Go to **Settings** → **Appearance & Behavior** → **System Settings** → **Android SDK**
3. Note your **Android SDK Location** (you'll need this later)
4. Ensure the following are installed:
   - Android SDK Platform 34 (or later)
   - Android SDK Build-Tools
   - Android Emulator
   - Android SDK Platform-Tools
   
***
## Project Setup

### 1. Clone the Repository

```bash
cd zkDAPP-Survey-Frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Android SDK Path

Create a file at `android/local.properties` with your Android SDK location:

**Example:**
```properties
sdk.dir=C:\\Users\\<YourUsername>\\AppData\\Local\\Android\\Sdk
```
### 4. Start Expo

```bash
npx expo start
```

### 5. Run on Android Emulator

#### Option A: Build and Install APK

```bash
npx expo run:android
```

This will:
- Build the Android app
- Install it on your emulator/device
- Connect to the Metro bundler automatically

#### Option B: Use Expo Development Client

1. Start the emulator from Android Studio
2. In the Metro bundler terminal, press `a` to open on Android

***
## Valera Wallet Integration

To test the credential sharing functionality, you need Valera wallet running on the same Android emulator.
### Setup Valera

See the Valera repository for detailed setup instructions. Quick summary:

1. Clone Valera repository
2. Navigate to the project directory
3. Create `local.properties` with SDK path (same as above)
4. Build and install:
   ```bash
   ./gradlew :androidApp:installDebug
   ```


