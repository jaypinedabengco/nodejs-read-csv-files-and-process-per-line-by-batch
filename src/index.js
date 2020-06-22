var parseStream = require("fast-csv").parseStream;
var fs = require("fs");

var http = require("http");

////
const base = __dirname;
///

//create a server object:
http
  .createServer(async function(req, res) {
    await logic(req, res);
    res.end(); //end the response
  })
  .listen(8080); //the server object listens on port 8080

/**
 *
 */
async function logic(req, res) {
  try {
    const result = await parseCsvAndProcessByBatch(
      "sample.csv",
      data => {
        return _simulateAsyncProcess(data);
      },
      { returnResult: true, batchCount: 1 }
    );
    res.write(JSON.stringify(result, null, 1));
  } catch (err) {
    // res.status(500);
    console.error(err);
    res.write("error");
  }
}

/**
 *
 */
async function parseCsvAndProcessByBatch(
  filename,
  doToEach,
  { location = `${base}/files`, batchCount = 4, returnResult = false } = {}
) {
  if (doToEach instanceof Function === false) {
    throw new Error(`function is required on 2nd argument`);
  }
  // loop through the stream & stop when totalFieldCount is 0.
  return new Promise((resolve, reject) => {
    try {
      let batchProcessContainer = [];
      let rowCount = 0;
      let batchResults = [];

      const stream = fs.createReadStream(`${location}/${filename}`);

      parseStream(stream, { headers: true })
        .transform(async (data, callback) => {
          /********************************************
           * This part is important,
           * as here we control when
           * the next process will trigger by batch.
           *********************************************/

          // register rowCount
          rowCount++;

          // register what to do here
          batchProcessContainer.push(doToEach(data));

          // if has batchCount && if row count is divisible by set batch count, then
          // wait for all to finish
          if (!!batchCount && rowCount % batchCount === 0) {
            console.log(
              `Waiting for batch #${Math.ceil(
                rowCount / batchCount
              )} to finish`,
              ` | batchCount: ${batchCount}, saveResult : ${returnResult}`
            );
            // wait for all to finish
            const result = await Promise.all(batchProcessContainer);
            if (returnResult) {
              batchResults.push(...result);
            }
            // set batchProcessContainer to empty
            batchProcessContainer.length = 0;
          }

          // move to next step...
          return callback(null, data);
        })
        .on("error", error => {
          console.log("error", error);
          return reject(error);
        })
        .on("data", row => {})
        .on("end", async rowTotalCount => {
          // As we will only know when we finished & total Field
          // on this part, then we need to rewrite
          // to wait batch & save result here :(
          // The idea is if we still have ongoing
          // batch processes, then wait here....
          if (batchProcessContainer.length) {
            // wait for all to finish
            const result = await Promise.all(batchProcessContainer);
            if (returnResult) {
              batchResults.push(...result);
            }
            // set batchProcessContainer to empty
            batchProcessContainer.length = 0;
          }

          // close stream
          stream.close();
          return resolve({
            rowTotalCount,
            returnResult,
            result: batchResults
          });
        });
    } catch (err) {
      return reject(err);
    }
  });
}

/**
 *
 */
async function _simulateAsyncProcess(data, delay = 100) {
  return new Promise(resolve => {
    setTimeout(() => resolve({ ...data, timestamp: Date.now() }), delay);
  });
}
