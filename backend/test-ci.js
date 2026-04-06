const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/data',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';

  res.on('data', chunk => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        console.log('TEST PASS: /data returned JSON array');
        process.exit(0);
      } else {
        console.error('TEST FAIL: Response is not an array');
        process.exit(1);
      }
    } catch (err) {
      console.error('TEST FAIL: Invalid JSON');
      process.exit(1);
    }
  });
});

req.on('error', err => {
  console.error('TEST FAIL: Cannot connect to backend -', err.message);
  process.exit(1);
});

req.end();