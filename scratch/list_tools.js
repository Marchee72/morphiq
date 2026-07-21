import { spawn } from 'child_process';

const child = spawn('npx', ['-y', 'chrome-devtools-mcp@latest'], {
  shell: true
});

let outputData = '';

child.stdout.on('data', (data) => {
  outputData += data.toString();
  // Check if we received a complete JSON response
  try {
    const lines = outputData.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('{')) {
        const json = JSON.parse(line);
        console.log(JSON.stringify(json, null, 2));
        child.kill();
        process.exit(0);
      }
    }
  } catch (e) {
    // Wait for more data if JSON parsing fails
  }
});

child.stderr.on('data', (data) => {
  console.error('stderr:', data.toString());
});

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});

// Send the tools/list request
const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
};

child.stdin.write(JSON.stringify(request) + '\n');
