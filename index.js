const express = require("express");
const bodyParser = require("body-parser");
const { JSONRPCServer } = require("json-rpc-2.0");
const { keccak256 } = require("ethereum-cryptography/keccak");

const seedhash0 = keccak256(
        Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex")
    ).toString("hex");
console.log(`seedhash: ${seedhash0}`);

const server = new JSONRPCServer();

// First parameter is a method name.
// Second parameter is a method itself.
// A method takes JSON-RPC params and returns a result.
// It can also return a promise of the result.
server.addMethod("eth_getWork", () => {
    var result = [
        "0x384525b16fcfda97e6cb019fc9baff53736079f52340ac4bc3a6cad8e63aa546", 
        `0x${seedhash0}`, 
        "0xd1ff1c01710000000000000000000000d1ff1c01710000000000000000000000"
    ];
    console.log(`Requested work, given: ${result}`);
    return result;
});
server.addMethod("eth_submitWork", (work) => {
    console.log(`GOT WORK!!! ${work}`);
    return true;
});

const app = express();
app.use(bodyParser.json());

app.post("/", (req, res) => {
  const jsonRPCRequest = req.body;
  console.log(`req body: ${req.body}`);
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