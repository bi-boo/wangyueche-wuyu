import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const avatarDir = path.join(root, 'assets', 'pixel', 'avatars');
const vehicleDir = path.join(root, 'assets', 'pixel', 'vehicles');

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function rect(x, y, w, h, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(fill)}"${extra ? ` ${extra}` : ''}/>`;
}

function svg(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">
${body.join('\n')}
</svg>
`;
}

function avatarAsset({
  id,
  skin,
  hair = '#2A2320',
  hat = null,
  shirt = '#2E7D6A',
  accent = '#FFD93D',
  glasses = false,
  headset = false,
  tie = false,
  beard = false,
}) {
  const body = [
    rect(0, 0, 64, 64, 'transparent'),
    rect(18, 44, 28, 14, shirt),
    rect(14, 50, 36, 10, '#2A2320'),
    rect(18, 48, 28, 10, shirt),
    rect(26, 38, 12, 10, skin),
    rect(20, 18, 24, 24, skin),
    rect(18, 24, 4, 12, skin),
    rect(42, 24, 4, 12, skin),
    rect(20, 14, 24, 8, hair),
    rect(16, 20, 6, 12, hair),
    rect(42, 20, 6, 12, hair),
    rect(25, 28, 4, 4, '#2A2320'),
    rect(35, 28, 4, 4, '#2A2320'),
    rect(29, 37, 8, 3, '#7A3F2B'),
    rect(20, 42, 24, 3, '#2A2320'),
  ];

  if (hat === 'cap') {
    body.push(rect(18, 10, 28, 9, accent), rect(14, 18, 36, 4, accent), rect(21, 13, 7, 3, '#FFF8E7'));
  }
  if (hat === 'flat') {
    body.push(rect(16, 12, 30, 7, accent), rect(12, 18, 38, 4, accent), rect(38, 10, 8, 4, accent));
  }
  if (hat === 'taxi') {
    body.push(rect(17, 11, 30, 8, accent), rect(14, 18, 36, 4, '#2A2320'), rect(25, 12, 14, 4, '#FFF8E7'));
  }
  if (hat === 'helmet') {
    body.push(rect(14, 10, 36, 16, accent), rect(18, 24, 28, 5, '#FFF8E7'), rect(46, 18, 4, 8, '#2A2320'));
  }
  if (glasses) {
    body.push(rect(23, 27, 8, 5, '#FFFFFF'), rect(34, 27, 8, 5, '#FFFFFF'), rect(31, 29, 3, 2, '#2A2320'), rect(22, 26, 21, 2, '#2A2320'));
  }
  if (headset) {
    body.push(rect(15, 18, 4, 18, '#2A2320'), rect(45, 18, 4, 18, '#2A2320'), rect(18, 14, 28, 4, '#2A2320'), rect(43, 36, 8, 3, accent));
  }
  if (tie) {
    body.push(rect(30, 47, 5, 5, accent), rect(29, 52, 7, 8, accent));
  }
  if (beard) {
    body.push(rect(24, 35, 16, 8, hair), rect(28, 36, 8, 3, skin), rect(29, 40, 7, 3, '#2A2320'));
  }

  return { id, content: svg(64, 64, body) };
}

function vehicleAsset({ id, bodyColor, roofColor, windowColor = '#BDEBFF', accent = '#FFD93D', premium = false, van = false, ev = false }) {
  const y = van ? 16 : 20;
  const h = van ? 19 : 16;
  const body = [
    rect(0, 0, 96, 48, 'transparent'),
    rect(10, y, 76, h, bodyColor),
    rect(14, y + h, 68, 4, '#2A2320'),
    rect(22, y - 10, van ? 46 : 36, 10, roofColor),
    rect(25, y - 8, van ? 14 : 12, 7, windowColor),
    rect(43, y - 8, van ? 16 : 13, 7, windowColor),
    rect(64, y - 6, van ? 10 : 8, 5, windowColor),
    rect(14, y + 5, 10, 5, '#FFF8E7'),
    rect(76, y + 6, 7, 4, premium ? '#F6D365' : '#E84545'),
    rect(23, y + h - 2, 12, 12, '#2A2320'),
    rect(61, y + h - 2, 12, 12, '#2A2320'),
    rect(27, y + h + 2, 4, 4, '#FFF8E7'),
    rect(65, y + h + 2, 4, 4, '#FFF8E7'),
    rect(42, y + 7, 14, 5, accent),
  ];
  if (ev) {
    body.push(rect(12, y + h - 5, 70, 3, '#70E1C8'), rect(70, y + 2, 8, 8, '#FFFFFF'));
  }
  if (premium) {
    body.push(rect(30, y + 2, 36, 2, '#FFF8E7'), rect(42, y + 14, 12, 3, '#F6D365'));
  }
  if (van) {
    body.push(rect(72, y - 4, 10, 9, windowColor), rect(47, y + 5, 3, 16, '#2A2320'));
  }
  return { id, content: svg(96, 48, body) };
}

const avatars = [
  avatarAsset({ id: 'veteran', skin: '#D79A6D', hair: '#26351F', hat: 'cap', shirt: '#3F5A3A', accent: '#5C7C46' }),
  avatarAsset({ id: 'beidrift', skin: '#F0C795', hair: '#2A2320', hat: 'flat', shirt: '#2E7D6A', accent: '#C14A1D' }),
  avatarAsset({ id: 'dad', skin: '#E8B788', hair: '#3B2D26', shirt: '#335C81', accent: '#6F8FFF', glasses: true }),
  avatarAsset({ id: 'unemployed', skin: '#D9A878', hair: '#5D4737', shirt: '#6D635A', accent: '#D8B36A', beard: true }),
  avatarAsset({ id: 'influencer', skin: '#F5D0AB', hair: '#2A2320', shirt: '#FF6B35', accent: '#FF6B35', headset: true }),
  avatarAsset({ id: 'old_taxi', skin: '#C9A07A', hair: '#3A2A1E', hat: 'taxi', shirt: '#8B5A2B', accent: '#FFD93D' }),
  avatarAsset({ id: 'ex_didi_gold', skin: '#E0AF85', hair: '#2A2320', shirt: '#243B53', accent: '#FFD93D', glasses: true, tie: true }),
  avatarAsset({ id: 'soe_manager', skin: '#D9A878', hair: '#1F2937', shirt: '#1F2937', accent: '#4A90E2', glasses: true, tie: true }),
  avatarAsset({ id: 'driving_master', skin: '#E8B788', hair: '#2A2320', hat: 'helmet', shirt: '#E84545', accent: '#E84545', headset: true }),
  avatarAsset({ id: 'service_master', skin: '#F0C795', hair: '#4B3621', hat: 'cap', shirt: '#2E7D6A', accent: '#FFD93D', tie: true }),
];

const vehicles = [
  vehicleAsset({ id: 'taxi', bodyColor: '#F2C94C', roofColor: '#FFF3A6', accent: '#2A2320' }),
  vehicleAsset({ id: 'didi_d1', bodyColor: '#1FA971', roofColor: '#6EE7B7', accent: '#FFF8E7', ev: true }),
  vehicleAsset({ id: 'camry', bodyColor: '#2E7D6A', roofColor: '#5FA891', accent: '#FFD93D' }),
  vehicleAsset({ id: 'benz_e', bodyColor: '#20242C', roofColor: '#3A4250', accent: '#F6D365', premium: true }),
];

await mkdir(avatarDir, { recursive: true });
await mkdir(vehicleDir, { recursive: true });

await Promise.all(avatars.map((asset) => writeFile(path.join(avatarDir, `${asset.id}.svg`), asset.content)));
await Promise.all(vehicles.map((asset) => writeFile(path.join(vehicleDir, `${asset.id}.svg`), asset.content)));

console.log(`Generated ${avatars.length} avatars and ${vehicles.length} vehicles.`);
