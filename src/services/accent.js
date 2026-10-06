const luminance = (rgb) =>
  rgb
    .map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);

export function applyAccent(hex) {
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return;
  let digits = hex.slice(1);
  if (digits.length === 3) digits = [...digits].map((digit) => digit + digit).join('');
  const rgb = [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16));
  const root = document.documentElement;
  const light = root.dataset.theme === 'light';
  const backgroundLuminance = luminance(light ? [236, 236, 240] : [28, 28, 33]);
  let readable = [...rgb];
  const contrast = (color) =>
    (Math.max(luminance(color), backgroundLuminance) + 0.05) /
    (Math.min(luminance(color), backgroundLuminance) + 0.05);
  for (let step = 0; step < 20 && contrast(readable) < 4.5; step++) {
    readable = readable.map((channel) =>
      Math.round(channel + ((light ? 0 : 255) - channel) * 0.12),
    );
  }
  root.style.setProperty('--accent-color', hex);
  root.style.setProperty('--accent-color-rgb', rgb.join(', '));
  root.style.setProperty('--accent-ink', luminance(rgb) > 0.179 ? '#000' : '#fff');
  root.style.setProperty('--accent-readable', `rgb(${readable.join(', ')})`);
}
