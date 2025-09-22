import http from 'http';

const port = process.env.PORT || 3001;
const host = process.env.HOST || 'localhost';

const options = {
  hostname: host,
  port: port,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const request = http.request(options, (response) => {
  let data = '';
  
  response.on('data', (chunk) => {
    data += chunk;
  });
  
  response.on('end', () => {
    try {
      const healthData = JSON.parse(data);
      
      if (response.statusCode === 200 && healthData.status === 'healthy') {
        console.log('✅ Health check passed');
        process.exit(0);
      } else {
        console.error('❌ Health check failed:', healthData);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Health check parsing failed:', error.message);
      process.exit(1);
    }
  });
});

request.on('error', (error) => {
  console.error('❌ Health check request failed:', error.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.error('❌ Health check timed out');
  request.destroy();
  process.exit(1);
});

request.end();