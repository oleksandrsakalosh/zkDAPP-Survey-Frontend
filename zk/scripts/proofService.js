const http = require('http');
const {
  runAgeProofFlow,
  generateAgeProofArtifacts,
  verifyGeneratedAgeProof,
} = require('./runAgeProofFlow');

const PORT = Number(process.env.PROOF_SERVICE_PORT || 8787);

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === 'POST' && req.url === '/proof/age') {
    try {
      const body = await readJsonBody(req);
      const result = await runAgeProofFlow({
        currentDate: body.currentDate,
        dobValue: body.dobValue,
        minAge: body.minAge,
      });

      sendJson(res, 200, {
        ok: result.ok,
        inputPath: result.inputPath,
        input: result.input,
      });
      return;
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : 'Proof generation failed.',
      });
      return;
    }
  }

  const generateMatch = req.method === 'POST' && req.url && req.url.match(/^\/proof\/([^/]+)\/generate$/);
  if (generateMatch) {
    const checkKey = generateMatch[1];
    if (checkKey !== 'age') {
      sendJson(res, 400, { ok: false, error: `Unsupported check key: ${checkKey}` });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = await generateAgeProofArtifacts({
        currentDate: body.currentDate,
        dobValue: body.dobValue,
        minAge: body.minAge,
      });

      sendJson(res, 200, {
        ok: true,
        inputPath: result.inputPath,
        input: result.input,
      });
      return;
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : 'Proof generation failed.',
      });
      return;
    }
  }

  const verifyMatch = req.method === 'POST' && req.url && req.url.match(/^\/proof\/([^/]+)\/verify$/);
  if (verifyMatch) {
    const checkKey = verifyMatch[1];
    if (checkKey !== 'age') {
      sendJson(res, 400, { ok: false, error: `Unsupported check key: ${checkKey}` });
      return;
    }

    try {
      const result = await verifyGeneratedAgeProof();
      sendJson(res, 200, { ok: result.ok });
      return;
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : 'Proof verification failed.',
      });
      return;
    }
  }

  sendJson(res, 404, { ok: false, error: 'Not found.' });
});

server.listen(PORT, () => {
  console.log(`Proof service running on http://localhost:${PORT}`);
  console.log('POST /proof/{checkKey}/generate');
  console.log('POST /proof/{checkKey}/verify');
});
