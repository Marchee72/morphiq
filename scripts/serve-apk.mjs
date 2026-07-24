import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apkPath = path.resolve(__dirname, '../android/app/build/outputs/apk/release/app-release.apk');
const PORT = 8088;

const server = http.createServer((req, res) => {
  if (req.url === '/app-release.apk' || req.url === '/download') {
    if (!fs.existsSync(apkPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('APK not found');
      return;
    }
    const stat = fs.statSync(apkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename=MorphIQ.apk',
    });
    fs.createReadStream(apkPath).pipe(res);
    return;
  }

  // Mobile landing page
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Descargar MorphIQ</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #101013; color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
          .card { background: #1a1a20; padding: 32px 24px; border-radius: 24px; border: 1px solid #2a2a35; max-width: 360px; width: 100%; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h1 { font-size: 26px; margin: 0 0 8px 0; color: #6366f1; }
          p { font-size: 14px; color: #94a3b8; margin: 0 0 24px 0; line-height: 1.5; }
          a.btn { display: block; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; text-decoration: none; padding: 16px 24px; border-radius: 16px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); transition: transform 0.2s; }
          a.btn:active { transform: scale(0.97); }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>💪 MorphIQ</h1>
          <p>Instalador oficial para tu teléfono Samsung. Tocá el botón para descargar el APK firmado.</p>
          <a class="btn" href="/download">📲 Descargar e Instalar APK</a>
        </div>
      </body>
    </html>
  `);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor APK de MorphIQ corriendo en: http://192.168.100.129:${PORT}`);
});
