const { BigQuery } = require("@google-cloud/bigquery");
const { createHash } = require("crypto");
const UAParser = require("ua-parser-js");
const { Storage } = require("@google-cloud/storage");

const { BUCKET_ID, PROJECT_ID, DATASET_ID } = process.env;

function hash(string) {
  return createHash("sha256").update(string).digest("hex");
}

const bigquery = new BigQuery({ projectId: PROJECT_ID });

exports.getJson = async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
    res.status(204).send("");
    return;
  }

  const id = req.query.id;
  if (!id) {
    return res
      .status(400)
      .send("Invalid request. Please provide the required data.");
  }

  const storage = new Storage();
  const bucket = storage.bucket(BUCKET_ID);
  const file = bucket.file(`${id}.json`);
  const [exists] = await file.exists();
  if (exists) {
    const [data] = await file.download();
    res
      .status(200)
      .set("Cache-control", "max-age=31536000, immutable")
      .set("Content-Type", "application/json")
      .send(data);
    return;
  }
  return res.status(404).send("Not found");
};

exports.insertData = async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
    res.status(204).send("");
    return;
  }

  const requestBody = req.body;
  if (
    req.method !== "POST" ||
    !requestBody ||
    !requestBody.json ||
    !requestBody.csv
  ) {
    return res
      .status(400)
      .send(
        "Invalid request. Please provide the required data." +
          Object.keys(requestBody)
      );
  }

  const useragent = req.headers["user-agent"];
  const referer = req.headers["referer"];
  const client_hash = hash(req.ip);
  const { csv, json, notes } = requestBody;
  let parser = new UAParser(useragent);
  let parserResults = parser.getResult();
  try {
    const score = parseFloat(json.Score.mean);

    if (!score) {
      return res
        .status(400)
        .send("Score not found. Please provide the required data.");
    }
    const created = bigquery.datetime(new Date().toISOString());
    // name:STRING,score:FLOAT,useragent:STRING,client_hash:STRING,url:STRING,created:TIMESTAMP,notes:STRING,json:STRING,csv:STRING
    const [result] = await bigquery
      .dataset(DATASET_ID)
      .table("submission")
      .insert({
        name: requestBody.name || "Anonymous",
        score,
        useragent: JSON.stringify(parserResults),
        client_hash,
        url: referer,
        created,
        notes: notes || "",
        json: JSON.stringify(json),
        csv,
      });

    const json_hash = hash(JSON.stringify(json));
    const storage = new Storage();
    const bucket = storage.bucket("benchmark-results-storage");
    const file = bucket.file(`${json_hash}.json`);
    await file.save(JSON.stringify(json));

    // Can't find a good way for the ID to be inferred from the client here and store in the bucket.
    // Maybe the ID should be the SHA of the JSON
    res.status(200).send("Data inserted successfully.");
  } catch (error) {
    console.error(
      "Error inserting data:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    res.status(500).send("Internal Server Error");
  }
};
