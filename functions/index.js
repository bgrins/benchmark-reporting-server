const { BigQuery } = require('@google-cloud/bigquery');
const { createHash } = require('crypto');
const UAParser = require('ua-parser-js');

function hash(string) {
  return createHash('sha256').update(string).digest('hex');
}

const projectId = 'benchmark-results';
const datasetId = 'speedometer3';

const bigquery = new BigQuery({ projectId });

exports.ping = async (req, res) => {
  const ua = req.headers['user-agent'];
  res.status(200).send(`Pong ${ua}`);
}

exports.insertData = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  const requestBody = req.body;
  if (req.method !== 'POST' || !requestBody || !requestBody.json || !requestBody.csv) {
    return res.status(400).send('Invalid request. Please provide the required data.' + Object.keys(requestBody));
  }

  const useragent = req.headers['user-agent'];
  const referer = req.headers['referer'];
  const client_hash = hash(req.connection.remoteAddress);
  const {csv, json, notes} = requestBody;
  let parser = new UAParser(useragent);
  let parserResults = parser.getResult();
  try {
    const score = parseFloat(json.Score.mean);

    if (!score) {
      return res.status(400).send('Score not found. Please provide the required data.');
    }
    // name:STRING,score:FLOAT,useragent:STRING,client_hash:STRING,url:STRING,created:TIMESTAMP,notes:STRING,json:STRING,csv:STRING
    const [submission] = await bigquery
      .dataset(datasetId)
      .table('submission')
      .insert({
        name: requestBody.name || 'Anonymous',
        score,
        useragent: JSON.stringify(parserResults),
        client_hash,
        url: referer,
        created: bigquery.datetime(new Date().toISOString()),
        notes: notes || "",
        json: JSON.stringify(json),
        csv,
      });

    res.status(200).send('Data inserted successfully.');
  } catch (error) {
    console.error('Error inserting data:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    res.status(500).send('Internal Server Error');
  }
};