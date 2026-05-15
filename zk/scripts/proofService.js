const http = require('http');
const {
  generateEligibilityProofArtifacts,
  verifyGeneratedEligibilityProof,
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

function isInputValidationError(message) {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('missing')
    || normalized.includes('required')
    || normalized.includes('invalid json')
    || normalized.includes('unsupported check key')
  );
}

function isAssertionOrWitnessFailure(message) {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('assert failed')
    || normalized.includes('assertion failed')
    || normalized.includes('failed to generate witness')
    || normalized.includes('proof generation failed')
    || normalized.includes('proof verification failed')
    || normalized.includes('constraint')
  );
}

function toPublicErrorMessage(error, fallbackMessage) {
  const message = error instanceof Error ? error.message : '';

  if (isInputValidationError(message)) {
    return message;
  }

  if (isAssertionOrWitnessFailure(message)) {
    return fallbackMessage;
  }

  return message || fallbackMessage;
}

function normalizeProofError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('Assert Failed') || message.includes('Error in template')) {
    return 'Not eligible: credential does not satisfy the requirements.';
  }
  return message || 'Proof generation failed.';
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
        proof: result.proof,
        publicSignals: result.publicSignals,
        calldata: result.calldata,
      });
      return;
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: normalizeProofError(error),
      });
      return;
    }
  }

  const generateMatch = req.method === 'POST' && req.url && req.url.match(/^\/proof\/([^/]+)\/generate$/);
  if (generateMatch) {
    const checkKey = generateMatch[1];
    if (checkKey !== 'age' && checkKey !== 'eligibility') {
      sendJson(res, 400, { ok: false, error: `Unsupported check key: ${checkKey}` });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = await generateEligibilityProofArtifacts({
        input: body,
        surveyId: body.surveyId,
      });

      sendJson(res, 200, {
        ok: true,
        inputPath: result.inputPath,
        input: result.input,
        proof: result.proof,
        publicSignals: result.publicSignals,
        calldata: result.calldata,
      });
      return;
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: normalizeProofError(error),
      });
      return;
    }
  }

  const verifyMatch = req.method === 'POST' && req.url && req.url.match(/^\/proof\/([^/]+)\/verify$/);
  if (verifyMatch) {
    const checkKey = verifyMatch[1];
    if (checkKey !== 'age' && checkKey !== 'eligibility') {
      sendJson(res, 400, { ok: false, error: `Unsupported check key: ${checkKey}` });
      return;
    }

    try {
      const result = await verifyGeneratedEligibilityProof();
      sendJson(res, 200, { ok: result.ok });
      return;
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: toPublicErrorMessage(error, 'Eligibility verification failed.'),
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
