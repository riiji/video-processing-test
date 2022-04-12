import * as fs from "fs";
import { spawn } from "child_process";

export class Ffmpeg {
  call(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", args);

      ffmpeg.stdout.on("data", data => {
        console.log(data.toString());
      });

      ffmpeg.stderr.on("data", data => {
        console.error(data.toString());
      });

      ffmpeg.on("data", data => {
        console.log(data.toString());
      });

      ffmpeg.on("close", () => {
        ffmpeg.kill();
        resolve();
      });

      ffmpeg.on("finish", () => {
        ffmpeg.kill();
        resolve();
      });

      ffmpeg.on("error", () => {
        ffmpeg.kill();
        fs.unlink(args[args.length - 1], () => {});
        reject();
      });
    });
  }
}

