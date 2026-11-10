import React from 'react';

export type SettingsPage = 'account' | 'display' | 'playback' | 'eq' | 'advanced' | 'storage' | 'social' | 'about';

export const SETTINGS_PAGE_TITLES: Record<SettingsPage, string> = {
  account: 'Cuenta y gustos',
  display: 'Idioma y pantalla',
  playback: 'Reproducción',
  eq: 'Ecualizador',
  advanced: 'Ajustes avanzados',
  storage: 'Almacenamiento',
  social: 'Escuchar juntos',
  about: 'Acerca de',
};

const ICONS: Record<SettingsPage, React.ReactNode> = {
  account: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z" />,
  display: <path d="M3 5h18v11H3zm6 14h6v2H9z" />,
  playback: <path d="M8 5v14l11-7z" />,
  eq: <path d="M5 21v-7m0-4V3m7 18v-9m0-4V3m7 18v-5m0-4V3M2 14h6m1-6h6m1 8h6" />,
  advanced: <path d="M4 7h10m4 0h2M4 17h4m4 0h8M14 4v6m-4 4v6" />,
  storage: <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3zm0 0c0 1.7 3.6 3 8 3s8-1.3 8-3M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />,
  social: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a2.5 2.5 0 1 0 0-5M3 20c0-3 2.7-5 6-5s6 2 6 5m2-5c2.4.3 4 1.9 4 4.5" />,
  about: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-11v6m0-9h.01" />,
};

const GROUPS: Array<{ title: string; items: Array<{ id: SettingsPage; subtitle: string }> }> = [
  {
    title: 'General',
    items: [
      { id: 'account', subtitle: 'Cuenta de Spotifree, sincronización y tus gustos' },
      { id: 'display', subtitle: 'Idioma, banners e icono de la app' },
    ],
  },
  {
    title: 'Sonido',
    items: [
      { id: 'playback', subtitle: 'Volumen, fundido, DJ y reproducción automática' },
      { id: 'eq', subtitle: 'Ajusta graves y agudos a tu gusto' },
      { id: 'advanced', subtitle: 'Cómo funciona el aleatorio' },
    ],
  },
  {
    title: 'Más',
    items: [
      { id: 'storage', subtitle: 'Espacio usado y caché' },
      { id: 'social', subtitle: 'Amigos que escuchan contigo' },
      { id: 'about', subtitle: 'Versión y novedades' },
    ],
  },
];

/** Settings home (Spotify style): grouped rows that open each page */
export const SettingsMenu: React.FC<{ onOpen: (p: SettingsPage) => void }> = ({ onOpen }) => (
  <div className="space-y-6">
    {GROUPS.map((g) => (
      <section key={g.title}>
        <h3 className="px-1 pb-2 text-[13px] font-bold text-[#b3b3b3]">{g.title}</h3>
        <div className="rounded-xl bg-[#181818] overflow-hidden divide-y divide-white/[0.05]">
          {g.items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onOpen(it.id)}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <span className="w-9 h-9 rounded-full bg-[#2a2a2a] flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={it.id === 'playback' || it.id === 'account' ? 'currentColor' : 'none'} stroke={it.id === 'playback' || it.id === 'account' ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  {ICONS[it.id]}
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-bold text-white">{SETTINGS_PAGE_TITLES[it.id]}</span>
                <span className="block text-[12.5px] text-[#a7a7a7] truncate">{it.subtitle}</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#727272] shrink-0">
                <path d="M5.47 2.47a.75.75 0 0 1 1.06 0l5 5a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 1 1-1.06-1.06L9.94 8 5.47 3.53a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          ))}
        </div>
      </section>
    ))}
  </div>
);
