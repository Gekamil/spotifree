async function check() {
  try {
    const res = await fetch('https://spotifreeweb.vercel.app/');
    const text = await res.text();
    const match = text.match(/src="(\/assets\/[^"]+)"/);
    console.log('Vercel script tag:', match ? match[1] : 'none');

    const renderRes = await fetch('https://spotifree-backend-o4a7.onrender.com/');
    const renderText = await renderRes.text();
    const renderMatch = renderText.match(/src="(\/assets\/[^"]+)"/);
    console.log('Render script tag:', renderMatch ? renderMatch[1] : 'none');

    const resolveRes = await fetch('https://spotifree-backend-o4a7.onrender.com/api/audio/resolve?query=Coldplay+Yellow');
    const resolveData = await resolveRes.json();
    console.log('Render /api/audio/resolve test:', resolveData);
  } catch (err) {
    console.error('Error:', err);
  }
}

check();
