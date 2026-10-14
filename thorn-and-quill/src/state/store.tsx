import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';

import { duplicateBio, newBio } from '../core/factory';
import type { Bio } from '../core/types';
import { NIGHTFALL, PARCHMENT, type Palette } from '../ui/theme';

const BIOS_KEY = 'tq.bios.v1';
const SETTINGS_KEY = 'tq.settings.v1';

export type Appearance = 'system' | 'parchment' | 'nightfall';

export interface Settings {
  appearance: Appearance;
  prologueDismissed: boolean;
}

const DEFAULT_SETTINGS: Settings = { appearance: 'system', prologueDismissed: false };

interface Store {
  loaded: boolean;
  bios: Bio[];
  settings: Settings;
  palette: Palette;
  getBio: (id: string) => Bio | undefined;
  createBio: (name: string, themeId: string, kitId: string) => Bio;
  saveBio: (bio: Bio) => void;
  deleteBio: (id: string) => void;
  duplicate: (id: string) => Bio | undefined;
  renameBio: (id: string, name: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [bios, setBios] = useState<Bio[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const scheme = useColorScheme();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [rawBios, rawSettings] = await Promise.all([AsyncStorage.getItem(BIOS_KEY), AsyncStorage.getItem(SETTINGS_KEY)]);
        if (rawBios) setBios(JSON.parse(rawBios));
        if (rawSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) });
      } catch {
        // Corrupt or unavailable storage: start fresh rather than crash.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Debounced persistence of the library.
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(BIOS_KEY, JSON.stringify(bios)).catch(() => {});
    }, 400);
  }, [bios, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  const getBio = useCallback((id: string) => bios.find((b) => b.id === id), [bios]);

  const createBio = useCallback((name: string, themeId: string, kitId: string) => {
    const bio = newBio(name, themeId, kitId);
    setBios((prev) => [bio, ...prev]);
    return bio;
  }, []);

  const saveBio = useCallback((bio: Bio) => {
    setBios((prev) => {
      const next = { ...bio, updatedAt: Date.now() };
      const idx = prev.findIndex((b) => b.id === bio.id);
      if (idx === -1) return [next, ...prev];
      const copy = prev.slice();
      copy[idx] = next;
      return copy;
    });
  }, []);

  const deleteBio = useCallback((id: string) => setBios((prev) => prev.filter((b) => b.id !== id)), []);

  const duplicate = useCallback(
    (id: string) => {
      const src = bios.find((b) => b.id === id);
      if (!src) return undefined;
      const copy = duplicateBio(src);
      setBios((prev) => [copy, ...prev]);
      return copy;
    },
    [bios],
  );

  const renameBio = useCallback((id: string, name: string) => {
    setBios((prev) => prev.map((b) => (b.id === id ? { ...b, name: name.trim() || b.name, updatedAt: Date.now() } : b)));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const palette =
    settings.appearance === 'parchment' ? PARCHMENT : settings.appearance === 'nightfall' ? NIGHTFALL : scheme === 'dark' ? NIGHTFALL : PARCHMENT;

  const value = useMemo<Store>(
    () => ({ loaded, bios, settings, palette, getBio, createBio, saveBio, deleteBio, duplicate, renameBio, updateSettings }),
    [loaded, bios, settings, palette, getBio, createBio, saveBio, deleteBio, duplicate, renameBio, updateSettings],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}

export const usePalette = () => useStore().palette;

/** Undo/redo history. Rapid edits with the same `mergeKey` (e.g. typing) collapse into one step. */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<{ past: T[]; present: T; future: T[] }>({ past: [], present: initial, future: [] });
  const last = useRef<{ key?: string; at: number }>({ at: 0 });

  const set = useCallback((next: T | ((prev: T) => T), mergeKey?: string) => {
    setState((s) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(s.present) : next;
      if (value === s.present) return s;
      const now = Date.now();
      const merge = mergeKey && last.current.key === mergeKey && now - last.current.at < 900;
      last.current = { key: mergeKey, at: now };
      if (merge) return { ...s, present: value, future: [] };
      return { past: [...s.past.slice(-79), s.present], present: value, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    last.current = { at: 0 };
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);

  const redo = useCallback(() => {
    last.current = { at: 0 };
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  return { value: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
