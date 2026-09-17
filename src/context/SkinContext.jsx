import { createContext, useContext, useEffect, useMemo } from 'react'
import { useProfile } from '../store/StoreProvider.jsx'

/**
 * Skin definitions. Each carries:
 *  - `swatch`   : the CSS accent shown in the skin picker
 *  - `accentHex`: the same accent for canvas/SVG charts
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
    accentHex: '#7aa2ff',
  },
  ledger: {
    id: 'ledger',
    name: 'Ledger',
    blurb: 'Emerald on deep pine. Habits that compound.',
    free: true,
    swatch: '#34d399',
    accentHex: '#34d399',
  },
  wireframe: {
    id: 'wireframe',
    name: 'Wireframe',
    blurb: 'Pure neon mesh. The skeleton of the climb.',
    free: false,
    swatch: '#38ffb4',
    accentHex: '#38ffb4',
  },
  karat: {
    id: 'karat',
    name: 'Karat',
    blurb: 'Brilliant gold on deep charcoal. Luxe.',
    free: false,
    swatch: '#e2b75c',
    accentHex: '#e2b75c',
  },
  cedar: {
    id: 'cedar',
    name: 'Cedar',
    blurb: 'Matte earth tones and warm wood grain.',
    free: false,
    swatch: '#c57c4a',
    accentHex: '#c57c4a',
  },
}

export const SKIN_LIST = Object.values(SKINS)

const SkinContext = createContext(null)

export function SkinProvider({ children }) {
  const { profile, premium, setProfile } = useProfile()
  // Non-premium users can still use any free skin; paid skins need premium.
  const requested = SKINS[profile.skin || 'normal'] || SKINS.normal
  const def = premium || requested.free ? requested : SKINS.normal

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
