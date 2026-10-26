import fs from 'fs';

async function validateFeed() {
  const data = JSON.parse(fs.readFileSync('src/data/liveRealSpotifyFeed.json', 'utf-8'));
  console.log(`Checking shelves in liveRealSpotifyFeed.json...`);

  const cleanShelves = [];
  for (const shelf of data.shelves) {
    console.log(`\nChecking shelf: ${shelf.title}`);
    const validCards = [];
    for (const card of shelf.cards) {
      try {
        const res = await fetch(card.image, { method: 'HEAD' });
        if (res.status === 200) {
          validCards.push(card);
        } else {
          console.warn(`Card image broken (${res.status}): ${card.title} -> ${card.image}`);
        }
      } catch (e) {
        console.warn(`Card image fetch error: ${card.title} -> ${e.message}`);
      }
    }

    if (validCards.length >= 3) {
      cleanShelves.push({ ...shelf, cards: validCards });
      console.log(`Shelf retained with ${validCards.length} valid cards.`);
    } else {
      console.log(`Shelf dropped: insufficient valid cards (${validCards.length}).`);
    }
  }

  data.shelves = cleanShelves;
  fs.writeFileSync('src/data/liveRealSpotifyFeed.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\nUpdated liveRealSpotifyFeed.json with only 100% verified 200 OK images!`);
}

validateFeed().catch(console.error);
