
gcloud config set project benchmark-results
bq show speedometer3 || bq mk speedometer3
bq show speedometer3.submission || bq mk --table speedometer3.submission name:STRING,score:FLOAT,useragent:STRING,client_hash:STRING,url:STRING,created:TIMESTAMP,notes:STRING,json:STRING,csv:STRING

gcloud functions deploy insertData \
  --source=functions \
  --runtime=nodejs18 \
  --trigger-http \
  --allow-unauthenticated
