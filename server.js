const http = require('http');
const fs = require('fs');
const path = require('path');

const START_PORT = 5000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    let filePath = req.url === '/' ? './index.html' : '.' + req.url;
    filePath = path.resolve(__dirname, filePath);

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

function startServer(port) {
    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`[AVISO] El puerto ${port} está ocupado. Probando con el puerto ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Error del servidor:', err);
        }
    });

server.listen(port, () => {
    // Copiar automáticamente el avatar cargado por el usuario de forma segura
    const sourcePath = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\abd95e07-e571-459d-b8f0-2a2ff06e0452\\media__1779119181991.jpg";
    const destPath = path.resolve(__dirname, "./brad_avatar.png");
    try {
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, destPath);
            console.log("[SISTEMA] ¡Imagen ultra-realista de Brad importada con éxito!");
        }
        
        // Limpiar el script temporal copy_image.js si existe
        const tempScript = path.resolve(__dirname, "./copy_image.js");
        if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript);
        }
    } catch (e) {
        console.log("[ALERTA] No se pudo copiar el avatar automáticamente:", e.message);
    }

    console.log(`==================================================`);
    console.log(`¡SERVIDOR LOCAL INICIADO EXITOSAMENTE!`);
    console.log(`Por favor, abre tu navegador y entra a:`);
    console.log(`👉 http://localhost:${port}`);
    console.log(`==================================================`);
    console.log(`Nota: Al usar http://localhost, el navegador recordará`);
    console.log(`los permisos del micrófono para siempre y no tendrás`);
    console.log(`que volver a presionar "Permitir" cada vez.`);
    console.log(`==================================================`);
});
}

startServer(START_PORT);
