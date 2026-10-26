async function checkEmbed() {
  const res = await fetch('https://open.spotify.com/embed/playlist/37i9dQZF1DX2EiUAL7Wdfc');
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (match) {
    const data = JSON.parse(match[1]);
    const entity = data.props?.pageProps?.state?.data?.entity;
    console.log('Entity name:', entity?.name);
    console.log('Track count:', entity?.trackList?.length);
    console.log('First 3 tracks:', entity?.trackList?.slice(0, 3).map(t => ({ title: t.title, subtitle: t.subtitle })));
  }
}
checkEmbed().catch(console.error);
