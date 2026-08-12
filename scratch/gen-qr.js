const QRCode = require('qrcode');
const path = require('path');

const url = 'https://swift-jobs-search.loca.lt';
const outFile = path.join(__dirname, '..', 'public', 'vote-qr.png');

QRCode.toFile(outFile, url, {
  width: 600,
  margin: 2,
  color: { dark: '#000000', light: '#ffffff' }
}, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log('✅ QR code saved to:', outFile);
});
