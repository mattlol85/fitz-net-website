/**
 * Illustrated stand-ins for the seeded mock recipes' photos (SVG, 800 x 800), so the mock book is
 * full of pictures without shipping binary assets. Mock-only: recipesMock.js serves them through
 * the same image endpoint as real uploads.
 */

const frame = (defs, body, bg = '#f3e6dc') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
<defs>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0.10 0"/></filter>
<radialGradient id="light" cx="30%" cy="22%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></radialGradient>
${defs}
</defs>
<rect width="800" height="800" fill="${bg}"/>
${body}
<rect width="800" height="800" filter="url(#grain)"/>
<rect width="800" height="800" fill="url(#light)" style="mix-blend-mode:soft-light"/>
</svg>`;

const linen = (color) => `
<rect width="800" height="800" fill="${color}"/>
<g opacity="0.18" stroke="#fff" stroke-width="2">${Array.from({ length: 40 }, (_, i) => `<path d="M0 ${i * 20 + 6}H800"/>`).join('')}</g>
<g opacity="0.08" stroke="#5a3a2a" stroke-width="2">${Array.from({ length: 40 }, (_, i) => `<path d="M${i * 20 + 10} 0V800"/>`).join('')}</g>`;

const pancakes = frame(
  `<linearGradient id="pc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9b062"/><stop offset="0.5" stop-color="#c98634"/><stop offset="1" stop-color="#9c5f22"/></linearGradient>
<radialGradient id="pctop" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#f2c57c"/><stop offset="0.8" stop-color="#d9973f"/><stop offset="1" stop-color="#b8742c"/></radialGradient>
<linearGradient id="syrup" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0521a" stop-opacity="0.95"/><stop offset="1" stop-color="#6e3210" stop-opacity="0.9"/></linearGradient>
<radialGradient id="berry" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#6b7fd1"/><stop offset="0.7" stop-color="#2d3577"/><stop offset="1" stop-color="#1a1d47"/></radialGradient>`,
  `${linen('#f2d7d9')}
<ellipse cx="400" cy="610" rx="330" ry="120" fill="#7a4a52" opacity="0.35" filter="url(#soft)"/>
<ellipse cx="400" cy="585" rx="320" ry="115" fill="#fbf7f2"/>
<ellipse cx="400" cy="578" rx="250" ry="84" fill="#efe7de"/>
${[0, 1, 2, 3, 4].map((i) => {
    const y = 560 - i * 52;
    return `<path d="M170 ${y} Q170 ${y + 46} 400 ${y + 52} Q630 ${y + 46} 630 ${y} L630 ${y - 10} Q400 ${y + 30} 170 ${y - 10}Z" fill="url(#pc)"/>
<ellipse cx="400" cy="${y - 10}" rx="230" ry="62" fill="url(#pctop)"/>`;
  }).join('')}
<path d="M250 318 Q330 270 470 282 Q590 296 560 330 Q520 360 520 400 Q516 430 506 404 Q500 372 470 370 Q440 372 438 420 Q434 468 424 420 Q420 376 380 366 Q330 360 316 392 Q306 420 300 384 Q296 346 250 318Z" fill="url(#syrup)"/>
<path d="M300 300 Q380 284 450 290" stroke="#ffd9a8" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.6"/>
<rect x="355" y="262" width="84" height="54" rx="10" fill="#fff3b8" transform="rotate(-8 397 289)"/>
<rect x="355" y="262" width="84" height="16" rx="8" fill="#fffbe2" transform="rotate(-8 397 289)"/>
${[[300, 300], [520, 318], [470, 262], [600, 600], [640, 560], [180, 600], [560, 700]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17" fill="url(#berry)"/><circle cx="${x - 5}" cy="${y - 6}" r="4" fill="#cfd8ff" opacity="0.7"/>`).join('')}
<path d="M90 140 l40 -40 M110 160 l40 -40" stroke="#c9a27a" stroke-width="10" stroke-linecap="round" opacity="0.5"/>`,
);

const soup = frame(
  `<radialGradient id="soupg" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#f0743d"/><stop offset="0.7" stop-color="#d4441f"/><stop offset="1" stop-color="#a62c14"/></radialGradient>
<radialGradient id="bowl" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dcd3cb"/></radialGradient>
<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fae4a"/><stop offset="1" stop-color="#2f6e2a"/></linearGradient>`,
  `${linen('#dfe8e0')}
<rect x="40" y="520" width="300" height="240" rx="8" fill="#f6f0e6" transform="rotate(-12 190 640)"/>
<g opacity="0.5" stroke="#e48aa8" stroke-width="6" transform="rotate(-12 190 640)"><path d="M40 560H340M40 600H340M40 640H340M40 680H340M40 720H340"/></g>
<circle cx="420" cy="420" r="275" fill="#3a3a2c" opacity="0.35" filter="url(#soft)"/>
<circle cx="410" cy="400" r="270" fill="url(#bowl)"/>
<circle cx="410" cy="400" r="210" fill="#e8e0d8"/>
<circle cx="410" cy="400" r="200" fill="url(#soupg)"/>
<path d="M300 380 C340 300 470 300 500 370 C530 440 430 480 390 440 C360 410 400 370 440 390" stroke="#fff6ee" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.92"/>
<path d="M300 380 C340 300 470 300 500 370" stroke="#ffffff" stroke-width="5" fill="none" opacity="0.6"/>
${[[360, 300, -30], [470, 460, 40], [330, 470, 10], [500, 300, 70]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="34" ry="18" fill="url(#leaf)"/><path d="M${x - 30} ${y} H${x + 30}" stroke="#bfe3a4" stroke-width="2"/></g>`).join('')}
${[[420, 340], [440, 410], [380, 360], [460, 380], [400, 450]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#2a1a10"/>`).join('')}
<path d="M640 120 L720 40" stroke="#b8b0a6" stroke-width="16" stroke-linecap="round"/>
<ellipse cx="610" cy="160" rx="40" ry="56" transform="rotate(42 610 160)" fill="#cfc8bf"/>
<g transform="translate(610 640)"><circle r="56" fill="#e23b2a"/><circle r="56" fill="none" stroke="#9e2316" stroke-width="4"/><path d="M-8 -50 q8 -18 20 -6" stroke="#3d7a2a" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="-20" cy="-18" r="10" fill="#ff9a86" opacity="0.6"/></g>`,
);

const chicken = frame(
  `<radialGradient id="skin" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#f5c06a"/><stop offset="0.6" stop-color="#c77a2a"/><stop offset="1" stop-color="#7d4115"/></radialGradient>
<linearGradient id="tin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5e1dc"/><stop offset="1" stop-color="#8f8a84"/></linearGradient>
<radialGradient id="lemon" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fff7a8"/><stop offset="1" stop-color="#f2c51c"/></radialGradient>
<radialGradient id="potato" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#f3d48a"/><stop offset="1" stop-color="#b9842f"/></radialGradient>`,
  `<rect width="800" height="800" fill="#6b4630"/>
<g opacity="0.35" stroke="#3e2516" stroke-width="3" fill="none">${Array.from({ length: 18 }, (_, i) => `<path d="M0 ${i * 46 + 10} C200 ${i * 46 - 10} 600 ${i * 46 + 30} 800 ${i * 46 + 6}"/>`).join('')}</g>
<rect x="90" y="150" width="640" height="520" rx="70" fill="#1d120b" opacity="0.5" filter="url(#soft)"/>
<rect x="80" y="130" width="640" height="520" rx="70" fill="url(#tin)"/>
<rect x="115" y="165" width="570" height="450" rx="50" fill="#5b3a1e"/>
${[[190, 240], [600, 230], [200, 540], [610, 540], [270, 590], [540, 600], [150, 390], [650, 390]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="44" ry="34" fill="url(#potato)"/><ellipse cx="${x - 12}" cy="${y - 10}" rx="12" ry="7" fill="#fff4cc" opacity="0.5"/>`).join('')}
<path d="M250 390 C250 270 330 220 400 220 C470 220 550 270 550 390 C550 500 480 560 400 560 C320 560 250 500 250 390Z" fill="url(#skin)"/>
<path d="M300 300 C340 260 390 250 430 262" stroke="#ffe0a0" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.6"/>
<ellipse cx="275" cy="560" rx="40" ry="26" transform="rotate(-30 275 560)" fill="url(#skin)"/>
<ellipse cx="525" cy="560" rx="40" ry="26" transform="rotate(30 525 560)" fill="url(#skin)"/>
<path d="M400 230 V540" stroke="#8a4a1a" stroke-width="4" opacity="0.35"/>
${[[330, 180], [470, 600]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="46" fill="url(#lemon)"/><circle r="38" fill="#fff6b0"/>${Array.from({ length: 8 }, (_, k) => `<path d="M0 0 L${Math.cos((k * Math.PI) / 4) * 36} ${Math.sin((k * Math.PI) / 4) * 36}" stroke="#f2d248" stroke-width="3"/>`).join('')}</g>`).join('')}
${[[220, 320, 20], [560, 310, -30], [420, 470, 60], [360, 360, -10]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})" stroke="#2f5a26" stroke-width="4"><path d="M${x - 40} ${y} H${x + 40}"/>${[-30, -15, 0, 15, 30].map((d) => `<path d="M${x + d} ${y} l-8 -12 M${x + d} ${y} l-8 12"/>`).join('')}</g>`).join('')}`,
  '#6b4630',
);

const bread = frame(
  `<linearGradient id="crust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a3f17"/><stop offset="1" stop-color="#4f260c"/></linearGradient>
<linearGradient id="crumb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a35c"/><stop offset="1" stop-color="#b47b3a"/></linearGradient>
<linearGradient id="board" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7a56b"/><stop offset="1" stop-color="#a87238"/></linearGradient>`,
  `${linen('#e9e2f1')}
<rect x="60" y="470" width="680" height="200" rx="26" fill="#3b2a1e" opacity="0.35" filter="url(#soft)"/>
<rect x="60" y="440" width="680" height="200" rx="26" fill="url(#board)"/>
<g stroke="#8a5a2a" stroke-width="3" opacity="0.35" fill="none"><path d="M80 480 C300 470 500 500 720 476"/><path d="M80 540 C300 530 500 560 720 536"/><path d="M80 600 C300 590 500 620 720 596"/></g>
<path d="M120 500 L120 330 C120 240 200 200 330 200 C460 200 520 240 520 330 L520 500Z" fill="url(#crust)"/>
<path d="M160 260 C240 230 330 220 470 250" stroke="#2e1406" stroke-width="12" fill="none" stroke-linecap="round"/>
<path d="M170 262 C250 236 330 228 460 254" stroke="#d99a55" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.7"/>
${[0, 1, 2].map((i) => `<g transform="translate(${555 + i * 34} ${i * 4}) rotate(${6 + i * 4} 600 420)"><path d="M0 500 L0 340 C0 290 40 270 70 270 C100 270 120 290 120 340 L120 500Z" fill="url(#crust)"/><path d="M10 500 L10 346 C10 300 40 284 66 284 C94 284 110 300 110 346 L110 500Z" fill="url(#crumb)"/>${[[40, 380], [80, 430], [50, 460], [86, 360]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#5c3412"/>`).join('')}</g>`).join('')}
<g transform="translate(180 690) rotate(-14)"><path d="M0 0 C60 -70 200 -80 260 -10" stroke="#f4d35e" stroke-width="44" fill="none" stroke-linecap="round"/><path d="M0 0 C60 -70 200 -80 260 -10" stroke="#e3b52e" stroke-width="10" fill="none" stroke-linecap="round" transform="translate(0 14)"/><path d="M260 -10 l18 6" stroke="#3a2a16" stroke-width="12" stroke-linecap="round"/></g>`,
);

const shortcake = frame(
  `<radialGradient id="straw" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ff6b7d"/><stop offset="0.7" stop-color="#d8203a"/><stop offset="1" stop-color="#9b0f24"/></radialGradient>
<linearGradient id="cake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1c37c"/><stop offset="1" stop-color="#c88a3e"/></linearGradient>`,
  `${linen('#fbe3ea')}
<ellipse cx="400" cy="640" rx="300" ry="90" fill="#8a3a4a" opacity="0.3" filter="url(#soft)"/>
<ellipse cx="400" cy="620" rx="290" ry="86" fill="#ffffff"/>
<ellipse cx="400" cy="612" rx="220" ry="58" fill="#f2ece6"/>
<path d="M200 600 Q200 520 400 512 Q600 520 600 600 Q600 640 400 646 Q200 640 200 600Z" fill="url(#cake)"/>
<path d="M190 520 Q260 470 330 500 Q380 460 440 498 Q510 462 610 520 Q630 560 400 566 Q170 560 190 520Z" fill="#fffaf2"/>
${[[270, 520], [360, 500], [460, 506], [540, 524], [320, 540], [500, 546]].map(([x, y]) => `<g transform="translate(${x} ${y})"><ellipse rx="34" ry="24" fill="url(#straw)"/><path d="M-22 0 h44" stroke="#fff2f2" stroke-width="3" opacity="0.6"/></g>`).join('')}
<path d="M210 470 Q210 400 400 392 Q590 400 590 470 Q590 500 400 506 Q210 500 210 470Z" fill="url(#cake)"/>
<path d="M230 430 Q400 380 570 430" stroke="#fff0d0" stroke-width="8" fill="none" opacity="0.5"/>
<path d="M300 400 Q330 300 400 300 Q470 300 500 400Z" fill="#fffaf2"/>
<path d="M330 380 Q350 330 400 322" stroke="#ffffff" stroke-width="8" fill="none" opacity="0.8"/>
<g transform="translate(400 300)"><path d="M0 -70 C50 -70 70 -20 40 30 C20 60 -20 60 -40 30 C-70 -20 -50 -70 0 -70Z" fill="url(#straw)"/>${[[-20, -30], [10, -40], [20, -10], [-10, 0], [0, 25], [-30, 5], [30, 15]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="4.5" fill="#ffe27a"/>`).join('')}<path d="M-30 -66 L0 -90 L30 -66 L10 -70 L0 -84 L-10 -70Z" fill="#3f8a30"/></g>
${[[640, 200], [690, 270], [140, 220]].map(([x, y]) => `<g transform="translate(${x} ${y}) rotate(20)"><path d="M0 -40 C34 -40 46 -12 26 20 C14 40 -14 40 -26 20 C-46 -12 -34 -40 0 -40Z" fill="url(#straw)"/><path d="M-18 -38 L0 -54 L18 -38Z" fill="#3f8a30"/></g>`).join('')}`,
);

const lemonade = frame(
  `<linearGradient id="pink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9cc2"/><stop offset="1" stop-color="#ec4f8c"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.2" stop-color="#ffffff" stop-opacity="0.1"/><stop offset="0.8" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.45"/></linearGradient>
<radialGradient id="lem" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fff9b8"/><stop offset="1" stop-color="#f6cf2a"/></radialGradient>`,
  `${linen('#fff1c9')}
<ellipse cx="380" cy="700" rx="200" ry="40" fill="#8a5a2a" opacity="0.3" filter="url(#soft)"/>
<path d="M230 170 L250 690 Q380 720 510 690 L530 170Z" fill="url(#pink)" opacity="0.92"/>
${[[300, 260, 12], [400, 230, -10], [450, 330, 20], [320, 380, -6], [420, 450, 8]].map(([x, y, r]) => `<rect x="${x}" y="${y}" width="74" height="70" rx="12" transform="rotate(${r} ${x + 37} ${y + 35})" fill="#ffffff" opacity="0.45"/>`).join('')}
<path d="M230 170 L250 690 Q380 720 510 690 L530 170Z" fill="url(#glass)"/>
<path d="M226 168 L534 168" stroke="#ffffff" stroke-width="8" opacity="0.8"/>
<g transform="translate(520 190)"><circle r="78" fill="url(#lem)"/><circle r="66" fill="#fffbd0"/>${Array.from({ length: 10 }, (_, k) => `<path d="M0 0 L${Math.cos((k * Math.PI) / 5) * 62} ${Math.sin((k * Math.PI) / 5) * 62}" stroke="#f3d34c" stroke-width="4"/>`).join('')}<rect x="-80" y="-4" width="40" height="8" fill="#fff1c9"/></g>
<path d="M330 40 L380 690" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/>
<path d="M330 40 L380 690" stroke="#ec4f8c" stroke-width="22" stroke-dasharray="24 24" stroke-linecap="butt"/>
<g transform="translate(250 120) rotate(-30)" fill="#4f9b45"><ellipse rx="40" ry="18"/><ellipse cx="44" cy="-26" rx="34" ry="15" transform="rotate(-40 44 -26)"/></g>
${[[640, 560], [690, 640], [120, 600]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M0 -30 C24 -30 30 -6 18 16 C8 30 -8 30 -18 16 C-30 -6 -24 -30 0 -30Z" fill="#e8335f"/>${[[-8, -10], [6, -14], [0, 4], [10, 8], [-10, 8]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="5" fill="#ff7896" opacity="0.6"/>`).join('')}</g>`).join('')}`,
);

export const SEED_PHOTOS = { pancakes, soup, chicken, bread, shortcake, lemonade };
