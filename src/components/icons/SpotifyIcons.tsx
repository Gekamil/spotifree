import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  filled?: boolean;
}

export const SpotifyLogo: React.FC<IconProps> = ({ size = 24, className = "text-white", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export const HomeIcon: React.FC<IconProps> = ({ size = 24, className = "text-spotify-textSubdued", filled = false, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    {filled ? (
      <path d="M12.5 3.247a1 1 0 0 0-1 0L4 7.577V20h4.5v-6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6H20V7.577l-7.5-4.33z" />
    ) : (
      <path d="M13.5 1.515a3 3 0 0 0-3 0L3 5.845a2 2 0 0 0-1 1.732V21a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6h4v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7.577a2 2 0 0 0-1-1.732l-7.5-4.33zM4 7.577l7.5-4.33a1 1 0 0 1 1 0L20 7.577V20h-4v-6a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v6H4V7.577z" />
    )}
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 24, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M10.533 1.278a9.255 9.255 0 1 0 5.64 16.596l4.673 4.673a1 1 0 0 0 1.414-1.414l-4.673-4.673a9.255 9.255 0 0 0-7.054-15.182zm-7.255 9.255a7.255 7.255 0 1 1 14.51 0 7.255 7.255 0 0 1-14.51 0z" />
  </svg>
);

export const SearchIconSmall: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5zM.25 7a6.75 6.75 0 1 1 12.096 4.12l3.184 3.185a.75.75 0 1 1-1.06 1.06L11.28 12.18A6.75 6.75 0 0 1 .25 7z" />
  </svg>
);

export const LibraryIcon: React.FC<IconProps> = ({ size = 24, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M3 22a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v18a1 1 0 0 1-1 1zM15.5 2.134A1 1 0 0 0 14 3v18a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1.5-.866l-5 3zM16 4.732l4-2.4V20h-4V4.732zM8 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1.447.894l4-2A1 1 0 0 0 13 18V4a1 1 0 0 0-1.447-.894l-3.553 1.776V4a1 1 0 0 0-.001-.001L8 3zm1 3.236 2-1v12.528l-2 1V6.236z" />
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ size = 16, className = "text-black", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z" />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ size = 16, className = "text-black", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7H5.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7h-2.6z" />
  </svg>
);

export const NextIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.606L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6z" />
  </svg>
);

export const PreviousIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.606L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6z" />
  </svg>
);

export const ShuffleIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.39a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75 13.15.922zM.39 3.5H0V2h.39a3.75 3.75 0 0 1 2.873 1.34L4.89 5.277l-.98 1.17-1.785-2.143A2.25 2.25 0 0 0 .39 3.5zm12.76 7.422a.75.75 0 0 1 0 1.06L12.132 13h1.948a2.25 2.25 0 0 0 1.724-.804l1.786-2.143-.98-1.17-1.627 1.936a3.75 3.75 0 0 1-2.873 1.34h-1.947l1.017 1.018a.75.75 0 0 1-1.06 1.06L7.29 11.42l2.83-2.828a.75.75 0 0 1 1.06 1.06L10.164 10.67h1.948a.75.75 0 0 1 .53.22z" />
  </svg>
);

export const RepeatIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.81 12h2.44A2.25 2.25 0 0 0 14.5 9.75v-5A2.25 2.25 0 0 0 12.25 2.5h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z" />
  </svg>
);

export const HeartIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", filled = false, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    {filled ? (
      <path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-3.62-1.13 4.315 4.315 0 0 0-3.533 3.406c-.363 2.166.303 4.41 1.825 6.155 1.522 1.743 7.898 6.015 7.898 6.015s6.376-4.272 7.898-6.015c1.522-1.745 2.188-3.99 1.825-6.155z" fill="#1ed760" />
    ) : (
      <path d="M1.69 2A4.582 4.582 0 0 1 8 2.023 4.583 4.583 0 0 1 11.88.817h.002a4.618 4.618 0 0 1 3.79 3.65c.4 2.38-.33 4.84-2 6.74L8 15.707l-5.672-4.5C.66 9.307-.07 6.847.33 4.467A4.618 4.618 0 0 1 4.12.817H4.12A4.584 4.584 0 0 1 8 2.023 4.58 4.58 0 0 1 1.69 2zm6.31 1.488a3.084 3.084 0 0 0-2.6-1.135 3.12 3.12 0 0 0-2.56 2.47c-.27 1.61.22 3.27 1.34 4.56L8 12.923l3.82-3.14c1.12-1.29 1.61-2.95 1.34-4.56a3.12 3.12 0 0 0-2.56-2.47 3.084 3.084 0 0 0-2.6 1.135z" />
    )}
  </svg>
);

export const LyricsIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M13.426 2.574a2.831 2.831 0 0 0-4.797 1.55l3.247 3.247a2.831 2.831 0 0 0 1.55-4.797zM10.5 8.693 7.307 5.5 1.5 11.307V14.5h3.193L10.5 8.693z" />
  </svg>
);

export const QueueIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm-14-7A2.5 2.5 0 0 1 3.5 1h9A2.5 2.5 0 0 1 15 3.5v2A2.5 2.5 0 0 1 12.5 8h-9A2.5 2.5 0 0 1 1 5.5v-2zM3.5 2.5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-9z" />
  </svg>
);

export const DeviceIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M6 2.75C6 1.784 6.784 1 7.75 1h6.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15h-6.5A1.75 1.75 0 0 1 6 13.25V2.75zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25h-6.5zM1 4.75C1 3.784 1.784 3 2.75 3H5v1.5H2.75a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25H5v1.5H2.75A1.75 1.75 0 0 1 1 13.25V4.75z" />
  </svg>
);

export const VolumeHighIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-4.5-2.65H1.5A1.5 1.5 0 0 1 0 11V5a1.5 1.5 0 0 1 1.5-1.5h2.991l4.5-2.65a.75.75 0 0 1 .75 0zm-1.241 2.2L4.57 5.37a.75.75 0 0 1-.383.13H1.5a.25.25 0 0 0-.25.25v4.5c0 .138.112.25.25.25h2.687a.75.75 0 0 1 .383.13l3.93 2.32V3.05zm3.896 1.488a.75.75 0 0 1 1.06 0 7.001 7.001 0 0 1 0 9.902.75.75 0 0 1-1.06-1.06 5.501 5.501 0 0 0 0-7.782.75.75 0 0 1 0-1.06zM11.5 6.03a.75.75 0 0 1 1.06 0 3.5 3.5 0 0 1 0 4.95.75.75 0 1 1-1.06-1.06 2 2 0 0 0 0-2.83.75.75 0 0 1 0-1.06z" />
  </svg>
);

export const FullScreenIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M6.53 9.47a.75.75 0 0 1 0 1.06l-2.72 2.72h1.94a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1-.75-.75v-3.75a.75.75 0 0 1 1.5 0v1.94l2.72-2.72a.75.75 0 0 1 1.06 0zm2.94-2.94a.75.75 0 0 1 0-1.06l2.72-2.72H10.25a.75.75 0 0 1 0-1.5H14a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V3.75L10.53 6.53a.75.75 0 0 1-1.06 0z" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75z" />
  </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M7.19 1.47a.75.75 0 0 1 1.06 0L14.53 7.75a.75.75 0 0 1 0 1.06L8.25 15.09a.75.75 0 0 1-1.06-1.06l5.22-5.28H1.75a.75.75 0 0 1 0-1.5h10.66L7.19 2.53a.75.75 0 0 1 0-1.06z" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = 16, className = "text-spotify-textSubdued", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm9-3.25V8H11.5v1.5H7.5V4.75H9z" />
  </svg>
);

export const PinIcon: React.FC<IconProps> = ({ size = 12, className = "text-spotify-green", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M8.5 1.5a1.5 1.5 0 0 0-3 0v1.793a1 1 0 0 1-.293.707L3.707 5.5A1 1 0 0 0 3 6.207V7.5a.5.5 0 0 0 .5.5H7v5.5a.5.5 0 0 0 1 0V8h3.5a.5.5 0 0 0 .5-.5V6.207a1 1 0 0 0-.293-.707l-1.5-1.5A1 1 0 0 1 10 3.293V1.5z" />
  </svg>
);
