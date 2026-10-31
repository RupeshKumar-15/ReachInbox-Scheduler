
import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

const elasticsearch = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  ...(process.env.ELASTICSEARCH_USERNAME &&
  process.env.ELASTICSEARCH_PASSWORD
    ? {
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD,
        },
      }
    : {}),
});

export default elasticsearch;
