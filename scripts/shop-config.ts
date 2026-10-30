// Writes rundot/shop.config.json from the catalog in src/game/shop.ts.
// Run: npm run shop-config   (a unit test fails if the two drift apart)

import { writeFileSync } from 'node:fs';
import { shopConfig } from '../src/game/shop';

const path = new URL('../rundot/shop.config.json', import.meta.url);
writeFileSync(path, `${JSON.stringify(shopConfig(), null, 2)}\n`);
console.log(`wrote ${path.pathname}`);
