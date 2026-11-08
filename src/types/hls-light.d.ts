// hls.js "light" build (no subtitles / DRM / alternate audio): same API as the full one
declare module 'hls.js/light' {
  import Hls from 'hls.js';
  export default Hls;
}
