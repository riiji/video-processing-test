import * as express  from "express";
import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as bodyParser from "body-parser";
import * as mime from "mime";
import * as path from "path";
import { exec } from "child_process";

import { Download } from "./download";
import { customAlphabet } from "nanoid";
import { URL } from "url";
import { Ffmpeg } from "./ffmpeg";

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 20);
const downloader = new Download();
const ffmpeg = new Ffmpeg();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET,
  region: process.env.AWS_REGION
});

let s3 = new AWS.S3();

const app = express();
const jsonParser = bodyParser.json();

app.use(jsonParser);

app.post("/video", async (req, res) => {
  const urls = req.body.urls.map(url => new URL(url));
  await Promise.all(urls.map(url => downloader.fromUrl(url)));

  const resultVideoDist = `${nanoid()}.${req.body.outputExtension}`;
  const args = `-y ${urls.map(url => `-i ${path.basename(url.pathname)}`).join(" ")} -filter_complex ${urls.map((url, index) => `[${index}:v][${index}:a]`).join("")}concat=n=${urls.length}:v=1:a=1[out] -map [out] ${resultVideoDist}`.split(" ");

  await ffmpeg.call(args);
  urls.forEach(url => fs.unlink(path.basename(url.pathname), () => {}));

  const rs = fs.createReadStream(resultVideoDist);

  const uploadResult = await s3.upload({
    Bucket: process.env.AWS_S3_BUCKET,
    ACL: "public-read",
    ContentType: mime.getType(resultVideoDist),
    Key: resultVideoDist,
    Body: rs
  }).promise();

  fs.unlink(resultVideoDist, () => {});
  res.send({ url: uploadResult.Location });
});

const server = app.listen(3000);

const shutdownHandler = () => {
  exec("rm *.mp4", () => {});
  server.close();
};

process.on("SIGINT", shutdownHandler);
