import { createContext, useContext, useEffect, useMemo } from 'react'
import { useStore } from '../store/StoreProvider.jsx'

/**
 * Skin definitions. Each carries:
 *  - `swatch`  : the CSS accent (for the picker chips)
 *  - `palette` : hex colors fed to Three.js meshes
 *  - `material`: shared material flags (flatShading always on per the spec)
 *  - `fog`     : subtle distance fog color to seat the low-poly scene
 *
 * The CSS half of each skin lives in index.css under [data-skin='…'].
 */
export const SKINS = {
  normal: {
    id: 'normal',
    name: 'Normal',
    blurb: 'High-contrast monochrome, one vivid accent.',
    free: true,
    swatch: '#7aa2ff',
    palette: {
      ground: '#3a3a44',
      groundHi: '#5a5a68',
      foliage: '#7aa2ff',
      trunk: '#4a4a55',
      rock: '#2c2c34',
      accent: '#7aa2ff',
      particle: '#aec2ff',
    },
    material: { flatShading: true, wireframe: false, metalness: 0.05, roughness: 0.95 },
    fog: '#0a0a0b',
  },
  wireframe: {
    id: 'wireframe',
    name: 'Wireframe',
    blurb: 'Pure neon mesh. The skeleton of the climb.',
    free: false,
    swatch: '#38ffb4',
    palette: {
      ground: '#0f3d30',
      groundHi: '#1de08f',
      foliage: '#38ffb4',
      trunk: '#1aa377',
      rock: '#0c5a44',
      accent: '#38ffb4',
      particle: '#9bffe0',
    },
    material: { flatShading: true, wireframe: true, metalness: 0, roughness: 1 },
    fog: '#06080a',
  },
  karat: {
    id: 'karat',
    name: 'Karat',
    blurb: 'Brilliant gold on deep charcoal. Luxe.',
    free: false,
    swatch: '#e2b75c',
    palette: {
      ground: '#7a5f24',
      groundHi: '#e2b75c',
      foliage: '#f0cd76',
      trunk: '#6b4f1c',
      rock: '#473614',
      accent: '#e2b75c',
      particle: '#ffe9a8',
    },
    material: { flatShading: true, wireframe: false, metalness: 0.95, roughness: 0.25 },
    fog: '#12100c',
  },
  cedar: {
    id: 'cedar',
    name: 'Cedar',
    blurb: 'Matte earth tones and warm wood grain.',
    free: false,
    swatch: '#c57c4a',
    palette: {
      ground: '#6e4a30',
      groundHi: '#9c6b41',
      foliage: '#5c7a4a',
      trunk: '#3f2a1b',
      rock: '#534036',
      accent: '#c57c4a',
      particle: '#e0b083',
    },
    material: { flatShading: true, wireframe: false, metalness: 0.0, roughness: 1.0 },
    fog: '#1e1812',
  },
}

export const SKIN_LIST = Object.values(SKINS)

const SkinContext = createContext(null)

export function SkinProvider({ children }) {
  const { profile, premium, setProfile } = useStore()
  // Non-premium users are locked to the free skin.
  const effectiveId = premium ? profile.skin || 'normal' : 'normal'
  const def = SKINS[effectiveId] || SKINS.normal

  useEffect(() => {
    document.documentElement.dataset.skin = def.id
  }, [def.id])

  const value = useMemo(
    () => ({
      skin: def.id,
      def,
      setSkin: (id) => {
        if (!premium && !SKINS[id]?.free) return // gated
        setProfile({ skin: id })
      },
    }),
    [def, premium, setProfile],
  )

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>
}

export function useSkin() {
  const ctx = useContext(SkinContext)
  if (!ctx) throw new Error('useSkin must be used within SkinProvider')
  return ctx
}
