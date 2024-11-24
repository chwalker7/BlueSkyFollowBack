const fs = require('fs');
const { createCanvas } = require('canvas');

// Create icons directory if it doesn't exist
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  gradient.addColorStop(0, '#0090ff');
  gradient.addColorStop(1, '#0070ff');
  
  // Draw circle background
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw bird silhouette
  ctx.fillStyle = 'white';
  ctx.save();
  ctx.translate(size/2, size/2);
  const scale = size/100;
  ctx.scale(scale, scale);
  
  // Simplified bird shape
  ctx.beginPath();
  ctx.moveTo(-30, -15);
  ctx.quadraticCurveTo(0, -40, 30, -15);
  ctx.quadraticCurveTo(0, 0, -30, -15);
  
  // Body
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 20);
  
  // Wings
  ctx.moveTo(-20, 15);
  ctx.quadraticCurveTo(0, 30, 20, 15);
  
  ctx.fill();
  ctx.restore();
  
  return canvas.toBuffer('image/png');
}

// Generate both icon sizes
[48, 96].forEach(size => {
  const iconData = generateIcon(size);
  fs.writeFileSync(`icons/icon${size}.png`, iconData);
  console.log(`Generated ${size}x${size} icon`);
});
