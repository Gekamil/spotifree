import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export const SpotifyLogoNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-white', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.495 17.307c-.216.353-.676.467-1.03.25-2.825-1.728-6.381-2.119-10.569-1.162-.403.092-.81-.161-.902-.564-.092-.403.161-.81.564-.902 4.588-1.047 8.52-.606 11.687 1.348.354.217.467.677.25 1.03zm1.464-3.26c-.272.441-.853.582-1.294.31-3.235-1.988-8.167-2.562-11.994-1.399-.499.151-1.026-.134-1.177-.633-.151-.499.134-1.026.633-1.177 4.375-1.328 9.816-.69 13.522 1.589.441.272.582.853.31 1.294zm.126-3.41c-3.878-2.302-10.274-2.514-13.985-1.387-.594.18-1.223-.156-1.403-.75-.18-.594.156-1.223.75-1.403 4.261-1.293 11.31-1.048 15.753 1.588.535.318.71 1.011.392 1.546-.318.535-1.011.71-1.546.392z" />
  </svg>
);

export const HomeNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M12.5 3.247a1 1 0 0 0-1 0L4 7.577V20h4.5v-6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6H20V7.577zm-2-1.732a3 3 0 0 1 3 0l7.5 4.33a2 2 0 0 1 1 1.732V21a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1v-6h-3v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.577a2 2 0 0 1 1-1.732z" />
  </svg>
);

export const HomeFilledNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-white', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M13.5 1.515a3 3 0 0 0-3 0L3 5.845a2 2 0 0 0-1 1.732V21a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6h4v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7.577a2 2 0 0 0-1-1.732z" />
  </svg>
);

export const CompactListNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M15 4H1V2.5h14V4zm0 4.5H1V7h14v1.5zm0 4.5H1v-1.5h14V13z" />
  </svg>
);

export const DetailedListNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M15 14.5H5V13h10v1.5zm0-5.5H5V7.5h10V9zm-10-5.5h10V2H5v1.5zM3 3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
  </svg>
);

export const GridViewNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M1 1h3.5v3.5H1V1zm5.25 0h3.5v3.5h-3.5V1zM11.5 1H15v3.5h-3.5V1zM1 6.25h3.5v3.5H1v-3.5zm5.25 0h3.5v3.5h-3.5v-3.5zm5.25 0H15v3.5h-3.5v-3.5zM1 11.5h3.5V15H1v-3.5zm5.25 0h3.5V15h-3.5v-3.5zm5.25 0H15V15h-3.5v-3.5z" />
  </svg>
);

export const BigGridViewNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z" />
  </svg>
);

export const SearchNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M10.533 1.27893C5.35215 1.27893 1.12598 5.41887 1.12598 10.5579C1.12598 15.697 5.35215 19.8369 10.533 19.8369C12.767 19.8369 14.8235 19.0671 16.4402 17.7794L20.7929 22.132C21.1834 22.5226 21.8166 22.5226 22.2071 22.132C22.5976 21.7415 22.5976 21.1083 22.2071 20.7178L17.8634 16.3741C19.1616 14.7849 19.94 12.7634 19.94 10.5579C19.94 5.41887 15.7138 1.27893 10.533 1.27893ZM3.12598 10.5579C3.12598 6.55226 6.42768 3.27893 10.533 3.27893C14.6383 3.27893 17.94 6.55226 17.94 10.5579C17.94 14.5636 14.6383 17.8369 10.533 17.8369C6.42768 17.8369 3.12598 14.5636 3.12598 10.5579Z" />
  </svg>
);

export const ExploreNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M15 15.5c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2" />
    <path d="M1.513 9.37A1 1 0 0 1 2.291 9h19.418a1 1 0 0 1 .979 1.208l-2.339 11a1 1 0 0 1-.978.792H4.63a1 1 0 0 1-.978-.792l-2.339-11a1 1 0 0 1 .201-.837zM3.525 11l1.913 9h13.123l1.913-9zM4 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4h-2V3H6v3H4z" />
  </svg>
);

export const ExploreFilledNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-white', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M4 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4H4zM1.513 9.37A1 1 0 0 1 2.291 9H21.71a1 1 0 0 1 .978 1.208l-2.17 10.208A2 2 0 0 1 18.562 22H5.438a2 2 0 0 1-1.956-1.584l-2.17-10.208a1 1 0 0 1 .201-.837zM12 17.834c1.933 0 3.5-1.044 3.5-2.333s-1.567-2.333-3.5-2.333S8.5 14.21 8.5 15.5s1.567 2.333 3.5 2.333z" />
  </svg>
);

export const CollabInviteNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M12.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0m-3.5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4m-7 12a5.5 5.5 0 0 1 11 0v1h-11zm1.516-.5a4.001 4.001 0 0 1 7.968 0zM19 10h2v1.5h-2v2h-1.5v-2h-2V10h2V8H19z" />
  </svg>
);

export const InstallAppNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M4.995 8.745a.75.75 0 0 1 1.06 0L7.25 9.939V4a.75.75 0 0 1 1.5 0v5.94l1.195-1.195a.75.75 0 1 1 1.06 1.06L8 12.811l-.528-.528-.005-.005-2.472-2.473a.75.75 0 0 1 0-1.06" />
    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13" />
  </svg>
);

export const BellNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M8 1.5a4 4 0 0 0-4 4v3.27a.75.75 0 0 1-.1.373L2.255 12h11.49L12.1 9.142a.75.75 0 0 1-.1-.374V5.5a4 4 0 0 0-4-4m-5.5 4a5.5 5.5 0 0 1 11 0v3.067l2.193 3.809a.75.75 0 0 1-.65 1.124H10.5a2.5 2.5 0 0 1-5 0H.957a.75.75 0 0 1-.65-1.124L2.5 8.569zm4.5 8a1 1 0 1 0 2 0z" />
  </svg>
);

export const FriendsNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M3.849 10.034c-.021-.465.026-.93.139-1.381H1.669c.143-.303.375-.556.665-.724l.922-.532a1.63 1.63 0 0 0 .436-2.458 1.8 1.8 0 0 1-.474-1.081q-.014-.287.057-.563a1.12 1.12 0 0 1 .627-.7 1.2 1.2 0 0 1 .944 0q.225.1.392.281c.108.12.188.263.237.417q.074.276.057.561a1.8 1.8 0 0 1-.475 1.084 1.6 1.6 0 0 0-.124 1.9c.36-.388.792-.702 1.272-.927v-.015c.48-.546.768-1.233.821-1.958a3.2 3.2 0 0 0-.135-1.132 2.657 2.657 0 0 0-5.04 0c-.111.367-.157.75-.135 1.133.053.724.341 1.41.821 1.955A.13.13 0 0 1 2.565 6a.13.13 0 0 1-.063.091l-.922.532A3.2 3.2 0 0 0-.004 9.396v.75h3.866c.001-.033-.01-.071-.013-.112m10.568-3.4-.922-.532a.13.13 0 0 1-.064-.091.12.12 0 0 1 .028-.1c.48-.546.768-1.233.821-1.958a3.3 3.3 0 0 0-.135-1.135A2.64 2.64 0 0 0 12.7 1.233a2.67 2.67 0 0 0-3.042.64 2.65 2.65 0 0 0-.554.948c-.11.367-.156.75-.134 1.133.053.724.341 1.41.821 1.955.005.006 0 .011 0 .018.48.225.911.54 1.272.927a1.6 1.6 0 0 0-.125-1.907 1.8 1.8 0 0 1-.474-1.081q-.015-.287.057-.563a1.12 1.12 0 0 1 .627-.7 1.2 1.2 0 0 1 .944 0q.225.1.392.281.162.182.236.413c.05.184.07.375.058.565a1.8 1.8 0 0 1-.475 1.084 1.633 1.633 0 0 0 .438 2.456l.922.532c.29.169.52.421.664.724h-2.319c.113.452.16.918.139 1.383 0 .04-.013.078-.017.117h3.866v-.75a3.2 3.2 0 0 0-1.58-2.778v.004zm-3.625 6-.922-.532a.13.13 0 0 1-.061-.144.1.1 0 0 1 .025-.047 3.33 3.33 0 0 0 .821-1.958 3.2 3.2 0 0 0-.135-1.132 2.657 2.657 0 0 0-5.041 0c-.11.367-.156.75-.134 1.133.053.724.341 1.41.821 1.955a.13.13 0 0 1 .028.106.13.13 0 0 1-.063.091l-.922.532a3.2 3.2 0 0 0-1.584 2.773v.75h8.75v-.75a3.2 3.2 0 0 0-1.583-2.781zm-5.5 2.023c.143-.303.375-.556.665-.724l.922-.532a1.63 1.63 0 0 0 .436-2.458 1.8 1.8 0 0 1-.474-1.081q-.015-.287.057-.563a1.12 1.12 0 0 1 .627-.7 1.2 1.2 0 0 1 .944 0q.225.1.392.281c.108.12.188.263.237.417q.073.276.057.561a1.8 1.8 0 0 1-.475 1.084 1.632 1.632 0 0 0 .438 2.456l.922.532c.29.169.52.421.664.724z" />
  </svg>
);

export const CollapseLibraryNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M10.97 5.47a.75.75 0 1 1 1.06 1.06L10.56 8l1.47 1.47a.75.75 0 1 1-1.06 1.06l-2-2a.75.75 0 0 1 0-1.06z" />
    <path d="M1 0a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm.5 1.5H5v13H1.5zm13 13h-8v-13h8z" />
  </svg>
);

export const CreateNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75" />
  </svg>
);

export const ExpandLibraryNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M6.53 9.47a.75.75 0 0 1 0 1.06l-2.72 2.72h1.018a.75.75 0 0 1 0 1.5H1.25v-3.579a.75.75 0 0 1 1.5 0v1.018l2.72-2.72a.75.75 0 0 1 1.06 0zm2.94-2.94a.75.75 0 0 1 0-1.06l2.72-2.72h-1.018a.75.75 0 1 1 0-1.5h3.578v3.579a.75.75 0 0 1-1.5 0V3.81l-2.72 2.72a.75.75 0 0 1-1.06 0" />
  </svg>
);

export const SearchLibraryNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5M.25 7a6.75 6.75 0 1 1 12.096 4.12l3.184 3.185a.75.75 0 1 1-1.06 1.06L11.304 12.2A6.75 6.75 0 0 1 .25 7" />
  </svg>
);

export const SortListNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M15 14.5H5V13h10zm0-5.75H5v-1.5h10zM15 3H5V1.5h10zM3 3H1V1.5h2zm0 11.5H1V13h2zm0-5.75H1v-1.5h2z" />
  </svg>
);

export const PinNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#1ed760]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M8.822.797a2.72 2.72 0 0 1 3.847 0l2.534 2.533a2.72 2.72 0 0 1 0 3.848l-3.678 3.678-1.337 4.988-4.486-4.486L1.28 15.78a.75.75 0 0 1-1.06-1.06l4.422-4.422L.156 5.812l4.987-1.337z" />
  </svg>
);

export const NowPlayingViewNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M15 4v12.167a3.5 3.5 0 1 1-3.5-3.5H13V4zm-2 10.667h-1.5a1.5 1.5 0 1 0 1.5 1.5z" />
  </svg>
);

export const AddTrackNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8" />
    <path d="M11.75 8a.75.75 0 0 1-.75.75H8.75V11a.75.75 0 0 1-1.5 0V8.75H5a.75.75 0 0 1 0-1.5h2.25V5a.75.75 0 0 1 1.5 0v2.25H11a.75.75 0 0 1 .75.75" />
  </svg>
);

export const CheckTrackNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#1ed760]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8" />
    <path d="m11.83 5.45-5.3 5.3-2.36-2.36a.75.75 0 0 0-1.06 1.06l2.89 2.89a.75.75 0 0 0 1.06 0l5.83-5.83a.75.75 0 0 0-1.06-1.06" />
  </svg>
);

export const ShuffleNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z" />
    <path d="m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z" />
  </svg>
);

export const PrevNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7z" />
  </svg>
);

export const PlayNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-black', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z" />
  </svg>
);

export const PauseNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-black', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z" />
  </svg>
);

export const NextNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z" />
  </svg>
);

export const RepeatNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75z" />
  </svg>
);

export const LyricsNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M13.426 2.574a2.831 2.831 0 0 0-4.797 1.55l3.247 3.247a2.831 2.831 0 0 0 1.55-4.797M10.5 8.118l-2.619-2.62L4.74 9.075 2.065 12.12a1.287 1.287 0 0 0 1.816 1.816l3.06-2.688 3.56-3.129zM7.12 4.094a4.331 4.331 0 1 1 4.786 4.786l-3.974 3.493-3.06 2.689a2.787 2.787 0 0 1-3.933-3.933l2.676-3.045z" />
  </svg>
);

export const QueueNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M15 15H1v-1.5h14zm0-4.5H1V9h14zm-14-7A2.5 2.5 0 0 1 3.5 1h9a2.5 2.5 0 0 1 0 5h-9A2.5 2.5 0 0 1 1 3.5m2.5-1a1 1 0 0 0 0 2h9a1 1 0 1 0 0-2z" />
  </svg>
);

export const DeviceNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M6 2.75C6 1.784 6.784 1 7.75 1h6.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15h-6.5A1.75 1.75 0 0 1 6 13.25zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25zm-6 0a.25.25 0 0 0-.25.25v6.5c0 .138.112.25.25.25H4V11H1.75A1.75 1.75 0 0 1 0 9.25v-6.5C0 1.784.784 1 1.75 1H4v1.5zM4 15H2v-1.5h2z" />
    <path d="M13 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0m-1-5a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
  </svg>
);

export const VolumeNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88" />
    <path d="M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127z" />
  </svg>
);

export const MiniplayerNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M16 2.45c0-.8-.65-1.45-1.45-1.45H1.45C.65 1 0 1.65 0 2.45v11.1C0 14.35.65 15 1.45 15h5.557v-1.5H1.5v-11h13V7H16z" />
    <path d="M15.25 9.007a.75.75 0 0 1 .75.75v4.493a.75.75 0 0 1-.75.75H9.325a.75.75 0 0 1-.75-.75V9.757a.75.75 0 0 1 .75-.75z" />
  </svg>
);

export const FullscreenNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M0.25 3C0.25 2.0335 1.0335 1.25 2 1.25H5.375V2.75H2C1.86193 2.75 1.75 2.86193 1.75 3V5.42857H0.25V3ZM14 2.75H10.625V1.25H14C14.9665 1.25 15.75 2.0335 15.75 3V5.42857H14.25V3C14.25 2.86193 14.1381 2.75 14 2.75ZM1.75 10.5714V13C1.75 13.1381 1.86193 13.25 2 13.25H5.375V14.75H2C1.0335 14.75 0.25 13.9665 0.25 13V10.5714H1.75ZM14.25 13V10.5714H15.75V13C15.75 13.9665 14.9665 14.75 14 14.75H10.625V13.25H14C14.1381 13.25 14.25 13.1381 14.25 13Z" />
  </svg>
);

export const SmartShuffleNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#1ed760]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z" />
    <path d="m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z" />
    <path d="M14.5.5c.15.8.6 1.3 1.4 1.45-.8.15-1.25.65-1.4 1.45-.15-.8-.6-1.3-1.4-1.45.8-.15 1.25-.65 1.4-1.45z" />
  </svg>
);

export const RepeatOneNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#1ed760]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75z" />
    <path d="M8.3 5.3h-.9l-1 .7.4.8.7-.5v3.4h1.1V5.3z" />
  </svg>
);

export const VerifiedArtistNativeIcon: React.FC<IconProps> = ({ size = 20, className = 'text-[#3d91f4]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 14.8l-4.1-4.1 1.4-1.4 2.7 2.7 6.3-6.3 1.4 1.4-7.7 7.7z" />
  </svg>
);

export const SpotifyConnectNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'text-[#1ed760]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <path d="M6 2.75C6 1.784 6.784 1 7.75 1h6.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15h-6.5A1.75 1.75 0 0 1 6 13.25V2.75zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25h-6.5z" />
    <path d="M2.5 4a.75.75 0 0 0-.75.75v6.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 0-1.5H3.25v-5h.75a.75.75 0 0 0 0-1.5h-1.5z" />
  </svg>
);

export const ShareNativeIcon: React.FC<IconProps> = ({ size = 18, className = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="18" cy="5" r="3" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="19" r="3" fill="currentColor" stroke="none" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" strokeWidth="2" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" strokeWidth="2" />
  </svg>
);

export const SearchActiveNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-white', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M10.533 1.279c-5.18 0-9.407 4.14-9.407 9.279s4.226 9.279 9.407 9.279c2.234 0 4.29-.77 5.907-2.058l4.353 4.353a1 1 0 1 0 1.414-1.414l-4.344-4.344a9.157 9.157 0 0 0 2.077-5.816c0-5.14-4.226-9.279-9.407-9.279zm-7.407 9.279c0-4.006 3.302-7.279 7.407-7.279s7.407 3.273 7.407 7.279-3.302 7.279-7.407 7.279-7.407-3.273-7.407-7.279z" />
    <circle cx="10.533" cy="10.558" r="4.2" fill="currentColor" />
  </svg>
);

export const OptionsNativeIcon: React.FC<IconProps> = ({ size = 20, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <circle cx="4.5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19.5" cy="12" r="2" />
  </svg>
);

export const VideoSwitchNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M4 4h10a2 2 0 0 1 2 2v2.5l4-2.5v12l-4-2.5V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
  </svg>
);

export const AudioSwitchNativeIcon: React.FC<IconProps> = ({ size = 16, className = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);

export const DownloadCircleNativeIcon: React.FC<IconProps> = ({ size = 22, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 7v8" />
    <path d="m8.5 11.5 3.5 3.5 3.5-3.5" />
    <path d="M8 17h8" />
  </svg>
);

export const DownloadActiveCircleNativeIcon: React.FC<IconProps> = ({ size = 22, className = 'text-[#1ed760]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <circle cx="12" cy="12" r="11" />
    <path d="M12 7v7.5" stroke="#121212" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="m8.5 11 3.5 3.5 3.5-3.5" stroke="#121212" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M8 17h8" stroke="#121212" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const AutomixNativeIcon: React.FC<IconProps> = ({ size = 22, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <line x1="3" y1="8" x2="21" y2="8" />
    <circle cx="8" cy="8" r="2.8" fill="currentColor" stroke="none" />
    <line x1="3" y1="16" x2="21" y2="16" />
    <circle cx="16" cy="16" r="2.8" fill="currentColor" stroke="none" />
  </svg>
);

export const EditNativeIcon: React.FC<IconProps> = ({ size = 20, className = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const TrashNativeIcon: React.FC<IconProps> = ({ size = 20, className = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export const CheckCircleNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-[#1ed760]', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <circle cx="12" cy="12" r="11" />
    <path d="M7.5 12.2l3 3 6-6" stroke="#121212" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const PlusCircleNativeIcon: React.FC<IconProps> = ({ size = 24, className = 'text-white/80', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);


