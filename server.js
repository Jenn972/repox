const compression = require('compression');
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express();

const thirdTour = process.argv[2] == 3;
const forcePort = process.argv[3];
const useHttp = process.argv[4] !== 'https';

const port = process.env.PORT || (forcePort ? +forcePort : (thirdTour ? 8443 : 80));

app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(compression());

// For development, we'll proxy to Vite dev server
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = require('vite');
  
  createViteServer({
    server: { middlewareMode: true }
  }).then(vite => {
    app.use(vite.middlewares);
  });
} else {
  app.use(express.static('public'));
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const server = useHttp ? http : https;

let options = {};
if(!useHttp) {
  options.key = fs.readFileSync(__dirname + '/certs/server-key.pem');
  options.cert = fs.readFileSync(__dirname + '/certs/server-cert.pem');
}

server.createServer(options, app).listen(port, () => {
  console.log('Listening port:', port);
});
