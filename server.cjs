
// Endpoint to serve backend logs
app.get('/api/logs', (req, res) => {
  const fs = require('fs');
  const logFile = '/tmp/backend.log';
  if (fs.existsSync(logFile)) {
    const logs = fs.readFileSync(logFile, 'utf8');
    res.send(logs);
  } else {
    res.send('No backend logs available');
  }
});
