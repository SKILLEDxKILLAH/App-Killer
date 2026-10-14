import { BerkshireSwash_400Regular } from '@expo-google-fonts/berkshire-swash/400Regular';
import { Cinzel_400Regular } from '@expo-google-fonts/cinzel/400Regular';
import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel/600SemiBold';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond/500Medium_Italic';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond/700Bold';
import { CrimsonText_400Regular } from '@expo-google-fonts/crimson-text/400Regular';
import { DancingScript_400Regular } from '@expo-google-fonts/dancing-script/400Regular';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { Jura_500Medium } from '@expo-google-fonts/jura/500Medium';
import { Lexend_400Regular } from '@expo-google-fonts/lexend/400Regular';
import { Monoton_400Regular } from '@expo-google-fonts/monoton/400Regular';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p/400Regular';
import { RockSalt_400Regular } from '@expo-google-fonts/rock-salt/400Regular';
import { VT323_400Regular } from '@expo-google-fonts/vt323/400Regular';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider, useStore } from '../state/store';
import { jaiFontKey } from '../ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { palette, loaded } = useStore();
  const [fontsLoaded, fontError] = useFonts({
    Cinzel_400Regular,
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    // JAI bio fonts, so the font picker can show each real typeface.
    [jaiFontKey('Berkshire Swash')]: BerkshireSwash_400Regular,
    [jaiFontKey('Crimson Text')]: CrimsonText_400Regular,
    [jaiFontKey('Dancing Script')]: DancingScript_400Regular,
    [jaiFontKey('Fraunces')]: Fraunces_600SemiBold,
    [jaiFontKey('Inter')]: Inter_400Regular,
    [jaiFontKey('JetBrains Mono')]: JetBrainsMono_400Regular,
    [jaiFontKey('Jura')]: Jura_500Medium,
    [jaiFontKey('Lexend')]: Lexend_400Regular,
    [jaiFontKey('Monoton')]: Monoton_400Regular,
    [jaiFontKey('Poppins')]: Poppins_400Regular,
    [jaiFontKey('Press Start 2P')]: PressStart2P_400Regular,
    [jaiFontKey('Rock Salt')]: RockSalt_400Regular,
    [jaiFontKey('VT323')]: VT323_400Regular,
  });
  const ready = (fontsLoaded || !!fontError) && loaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <>
      <StatusBar style={palette.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.page }, animation: 'slide_from_right' }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
