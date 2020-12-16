const express = require("express");
const bodyParser = require("body-parser");
const { JSONRPCServer } = require("json-rpc-2.0");
const { keccak256 } = require("ethereum-cryptography/keccak");

const seedhash0 = keccak256(
        Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex")
    ).toString("hex");
console.log(`seedhash: ${seedhash0}`);

const server = new JSONRPCServer();

var blocks = [];
var lastLogged = new Date().getTime() / 1000;

// First parameter is a method name.
// Second parameter is a method itself.
// A method takes JSON-RPC params and returns a result.
// It can also return a promise of the result.
server.addMethod("eth_getWork", () => {
    var result = [
        "0x384525b16fcfda97e6cb019fc9baff53736079f52340ac4bc3a6cad8e63aa546",
        `0x${seedhash0}`,
        // this is 2**256 // 1000000, so that solution rate per second will translate directly in MHs
        "0x000010c6f7a0b5ed8d36b4c7f34938583621fafc8b0079a2834d26fa3fcc9ea9"
    ];
    return result;
});
server.addMethod("eth_submitWork", (work) => {
    var blockTime = new Date().getTime() / 1000;
    blocks.push(blockTime);
    if (blocks.length > 1000) {
      blocks.shift();
    }

    // logging every 5 seconds
    if (lastLogged < (blockTime-5) && blocks.length > 0) {
      lastLogged = blockTime;
      let firstTime = blocks[0];
      let lastTime = blocks[blocks.length-1];
      let solutions = blocks.length;
      let rate = solutions / (lastTime - firstTime);
      console.log(`${(new Date()).toISOString()} | Rate ${rate.toFixed(2)}Mh/s`);
    }

    return true;
});

const app = express();
app.use(bodyParser.json());

app.post("/", (req, res) => {
  const jsonRPCRequest = req.body;
  // server.receive takes a JSON-RPC request and returns a promise of a JSON-RPC response.
  server.receive(jsonRPCRequest).then(jsonRPCResponse => {
    if (jsonRPCResponse) {
      res.json(jsonRPCResponse);
    } else {
      // If response is absent, it was a JSON-RPC notification method.
      // Respond with no content status (204).
      res.sendStatus(204);
    }
  });
});

app.listen(80);
