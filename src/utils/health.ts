import { createServer } from 'http';

export function startHealthServer(port: number = 3000): void {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'swiszjobs-bot'
      }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`🏥 Health check server listening on port ${port}`);
  });
}
