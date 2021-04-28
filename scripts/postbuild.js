"use strict";

/** 
 * Postbuild
 * Ejecutado despues de cada build de typescript pata corregir errores
 */

console.log("Executing postbuild...");

const fs = require("fs");
const path = require("path");

async function writeDI() {
  // (DI = Declaration index), (FN = final)
  let fnStringDI = fs
    .readFileSync(path.join(__dirname, "..", "dist", "index.d.ts"))
    .toString();

  let words = [],
    dcCount = 0;

  fnStringDI.split(" ").forEach((word) => {
    if (word.match(/declare/g) && dcCount === 0) {
      words.push(word.replace("declare", "export"));
      dcCount++;
    } else words.push(word);
  });

  fs.writeFileSync(
    path.join(__dirname, "..", "dist", "index.d.ts"),
    words.join(" "),
    "utf8"
  );
}

(async (callback) => {
  await callback();
})(writeDI);

console.log("Postbuild finished.");
