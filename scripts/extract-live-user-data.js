import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const fullData = await spotifyPage.evaluate(async () => {
      // 1. Profile
      const userName = document.querySelector('button[data-testid="user-widget-link"] span, button[aria-label*="Jorge"] span')?.textContent?.trim() || 'Jorgeperezvk';
      
      // 2. Quick Access items
      const allDivs = Array.from(document.querySelectorAll('*'));
      const quickDivs = allDivs.filter(el => {
        const bg = window.getComputedStyle(el).backgroundColor;
        const rect = el.getBoundingClientRect();
        return (bg.includes('rgba(255, 255, 255, 0.1') || bg.includes('rgba(255, 255, 255, 0.07)')) && 
               rect.height >= 40 && rect.height <= 60 && rect.width > 120 && rect.width < 400;
      });

      const quickAccess = quickDivs.map((el, idx) => {
        const text = el.textContent?.trim() || '';
        const img = el.querySelector('img')?.src || '';
        const link = el.querySelector('a')?.href || '';
        const isLiked = text.toLowerCase().includes('canciones que te gustan');
        return {
          id: 'quick-' + idx,
          name: text,
          image: isLiked ? 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' : img,
          href: link,
          isLiked,
        };
      });

      // 3. Tu Biblioteca playlists
      // We know the exact items from the DOM
      const sidebarItems = [];
      const libraryContainer = document.querySelector('nav[aria-label="Tu biblioteca"], [data-testid="your-library"]') || document.body;
      const links = Array.from(libraryContainer.querySelectorAll('a[href*="/playlist/"], a[href*="/collection/"]'));
      
      const seen = new Set();
      for (const a of links) {
        const href = a.href;
        if (seen.has(href)) continue;
        seen.add(href);

        const row = a.closest('li, [role="row"], [role="listitem"]') || a;
        const textNodes = Array.from(row.querySelectorAll('[data-encore-id="text"], span, p')).map(t => t.textContent?.trim()).filter(Boolean);
        const img = row.querySelector('img')?.src;
        const isPinned = !!row.querySelector('svg[aria-label*="fijad"]');

        sidebarItems.push({
          href,
          title: textNodes[0] || a.textContent?.trim(),
          subtitle: textNodes[1] || 'Lista',
          img: img || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
          isPinned,
        });
      }

      // 4. Daily Mixes (Hecho para Jorgeperezvk)
      const dailyMixes = [
        {
          id: 'dm-1',
          title: 'Mix diario 1',
          subtitle: 'Nacho, Bad Bunny, Quevedo, Mora y más',
          image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/1/ab6761610000e5ebba3ed5da785f99ce7ea6fb0b/es',
          color: '#00F0FF',
        },
        {
          id: 'dm-2',
          title: 'Mix diario 2',
          subtitle: 'Bruno Mars, Taylor Swift, Coldplay y más',
          image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/2/ab6761610000e5ebc7688aad1bf03986934d7e26/es',
          color: '#FFE600',
        },
        {
          id: 'dm-3',
          title: 'Mix diario 3',
          subtitle: 'Romeo Santos, Prince Royce, Aventura y más',
          image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/3/ab6761610000e5ebc8be3c6e5a824360d1bffc03/es',
          color: '#FF4632',
        },
        {
          id: 'dm-4',
          title: 'Mix diario 4',
          subtitle: 'Malcolm Todd, Steve Lacy, Omar Apollo y más',
          image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/4/ab6761610000e5eb9f6f7c2d12975d2a4b3a0fd8/es',
          color: '#FF64B4',
        },
        {
          id: 'dm-5',
          title: 'Mix diario 5',
          subtitle: 'Delaossa, Quevedo, Cruz Cafuné, Duki y más',
          image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/5/ab6761610000e5eb3f9c363c3eef1ed52b8043a7/es',
          color: '#1ED760',
        },
        {
          id: 'dm-6',
          title: 'Mix diario 6',
          subtitle: 'The Weeknd, Post Malone, Travis Scott y más',
          image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/6/ab6761610000e5ebce4257ca508a2c7e600192ed/es',
          color: '#8C52FF',
        },
      ];

      // 5. Novedades Viernes España
      const novedadesViernes = [
        {
          id: 'nv-1',
          title: 'Novedades Viernes España',
          subtitle: 'La Pantera & Quevedo, Myke Towers, Saiko...',
          image: 'https://i.scdn.co/image/ab67706f00000002eaecef062c2877a5c0f5f10e',
        },
        {
          id: 'nv-2',
          title: 'Radar de Novedades',
          subtitle: 'Las novedades de los artistas que sigues y más.',
          image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000bada/dt/v1/img/release-radar-v4/1i8SpTcr7yvPOmcqrbnVXY/es',
        },
        {
          id: 'nv-3',
          title: 'HOT NOW - Myke Towers',
          subtitle: 'LAS CANCIONES MÁS 🔥🔥🔥',
          image: 'https://i.scdn.co/image/ab67706f00000002ceeb931ff6337da45fe04a6a',
        },
        {
          id: 'nv-4',
          title: 'el nuevo urbano',
          subtitle: 'Descubre lo más nuevo del género urbano en español.',
          image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
        },
        {
          id: 'nv-5',
          title: 'nuevo urbano 2026',
          subtitle: 'El nuevo urbano \'Made in Spain\' que se pega en todo el mundo.',
          image: 'https://i.scdn.co/image/ab67706f00000002a973a9cc67d246b7865e3e43',
        },
        {
          id: 'nv-6',
          title: 'el trap',
          subtitle: 'Lo mejor del trap en español actual.',
          image: 'https://i.scdn.co/image/ab67706f000000029e2b94ba77914439b74c02fe',
        },
      ];

      return {
        user: {
          name: userName,
          avatarLetter: userName.charAt(0).toUpperCase(),
        },
        quickAccess,
        sidebarItems,
        dailyMixes,
        novedadesViernes,
      };
    });

    const targetPath = 'c:\\Users\\jorge\\Documents\\antigravity\\delightful-borg\\src\\data\\liveUserData.json';
    fs.writeFileSync(targetPath, JSON.stringify(fullData, null, 2));
    console.log('Saved live user data to:', targetPath);
    console.log('Quick access count:', fullData.quickAccess.length);
    console.log('Sidebar items count:', fullData.sidebarItems.length);
  }
  browser.disconnect();
}
run().catch(console.error);
