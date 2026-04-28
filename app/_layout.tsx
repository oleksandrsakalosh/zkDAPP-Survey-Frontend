import 'react-native-get-random-values';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Stack, useRouter } from "expo-router";
import * as Linking from 'expo-linking';
import { WalletProvider } from '@/utils/vocdoni/WalletProvider';
export default function RootLayout() {
  const router = useRouter();
  const [moproReady, setMoproReady] = useState(false);

  useEffect(() => {
    import('mopro-ffi')
      .then(({ uniffiInitAsync }) => uniffiInitAsync())
      .then(() => setMoproReady(true))
      .catch((e) => {
        console.error('[mopro] init failed, native module unavailable:', e);
        setMoproReady(true); // still let the app render; proof screens will fail gracefully
      });
  }, []);

  useEffect(() => {
    const handleDeepLink = (url: string) => {
      if (url.includes('expo-development-client') || url.startsWith('exp://')) {
        return;
      }

      console.log('🔗 Deep link received:', url);

      const { hostname, path, queryParams } = Linking.parse(url);

      if (hostname === 'survey' || path === '/survey') {
        const surveyId = queryParams?.id;
        if (surveyId) {
          router.push(`/(tabs)/explore?surveyId=${surveyId}` as any);
        }
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    console.log('✅ Deep link event listener registered');

    return () => {
      subscription.remove();
    };
  }, [router]);

  if (!moproReady) return null;

  return (
    <WalletProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }}/>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }}/>
        <Stack.Screen 
          name="auth" 
          options={{ 
            headerShown: false,
            presentation: 'card',
            animation: 'none'
          }}
        />
        <Stack.Screen name="create-survey" options={{ headerShown: false }}/>
        <Stack.Screen name="survey/manage/[id]" options={{ headerShown: false }}/>
        <Stack.Screen name="survey/manage/[id]/responses" options={{ headerShown: false }}/>
        <Stack.Screen name="voter-eligibility-profile" options={{ headerShown: false }}/>
      </Stack>
    </WalletProvider>
  );
}
