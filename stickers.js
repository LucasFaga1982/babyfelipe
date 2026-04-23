const themes = [
  ['#ffd9e8', '#fff4f8', '#ff7fb2'],
  ['#dff4ff', '#f5fbff', '#67b5ff'],
  ['#f1e4ff', '#fbf7ff', '#a07aff'],
  ['#fff1cf', '#fff9ec', '#ffb94d'],
  ['#dff8eb', '#f4fff9', '#58c98c'],
  ['#ffe4d6', '#fff7f2', '#ff9b73'],
  ['#e6ebff', '#f8f9ff', '#7d90ff'],
  ['#fff0f5', '#fff9fc', '#ff85b3'],
  ['#e8fff8', '#f8fffc', '#3cc8a1'],
  ['#fff5da', '#fffdf4', '#e8a52d']
];

const raw = [
  ['osito-miel', '🧸', 'Osito'],
  ['mamadera', '🍼', 'Mamadera'],
  ['luna', '🌙', 'Luna'],
  ['nube', '☁️', 'Nube'],
  ['estrella', '⭐', 'Estrella'],
  ['arcoiris', '🌈', 'Arcoíris'],
  ['patito', '🦆', 'Patito'],
  ['elefantito', '🐘', 'Elefantito'],
  ['globo', '🎈', 'Globo'],
  ['moño', '🎀', 'Moño'],
  ['florcita', '🌼', 'Florcita'],
  ['corazon', '🤍', 'Corazón'],
  ['conejito', '🐰', 'Conejito'],
  ['planetita', '🪐', 'Planetita'],
  ['ballenita', '🐳', 'Ballenita'],
  ['mariposa', '🦋', 'Mariposa'],
  ['pollito', '🐥', 'Pollito'],
  ['calesita', '🎠', 'Calesita'],
  ['pincel', '🎨', 'Pincel'],
  ['tambor', '🥁', 'Tambor'],
  ['musiquita', '🎵', 'Melodía'],
  ['lavanda', '🪻', 'Lavanda'],
  ['brillito', '💫', 'Brillito'],
  ['girasol', '🌻', 'Girasol'],
  ['trebol', '🍀', 'Trébol'],
  ['ovejita', '🐑', 'Ovejita'],
  ['regalito', '🎁', 'Regalito'],
  ['solcito', '☀️', 'Solcito'],
  ['chispa', '✨', 'Chispa'],
  ['chupete', '🧷', 'Chupete'],
  ['sonajero', '🪇', 'Sonajero'],
  ['camarita', '📷', 'Camarita'],
  ['barrilete', '🪁', 'Barrilete'],
  ['frutilla', '🍓', 'Frutilla'],
  ['galletita', '🍪', 'Galletita'],
  ['cupcake', '🧁', 'Cupcake'],
  ['banerito', '🚼', 'Bebé'],
  ['banito', '🛁', 'Bañito'],
  ['medias', '🧦', 'Medias'],
  ['gorrito', '🧢', 'Gorrito'],
  ['cielo', '🩵', 'Cielito'],
  ['lila', '💜', 'Lila'],
  ['flor', '🌸', 'Sakura'],
  ['huellita', '🐾', 'Huellita'],
  ['margarita', '🌷', 'Tulipán'],
  ['hojita', '🍃', 'Hojita'],
  ['campanita', '🔔', 'Campanita'],
  ['dulzura', '🍬', 'Caramelo'],
  ['besito', '💋', 'Besito'],
  ['fogon', '🔥', 'Chispón']
];

export const STICKERS = raw.map((item, index) => {
  const [id, emoji, label] = item;
  const [bg, bgSoft, accent] = themes[index % themes.length];
  return {
    id,
    emoji,
    label,
    colors: { bg, bgSoft, accent }
  };
});
