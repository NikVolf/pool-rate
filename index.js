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

server.addMethod("web3_clientVersion", () => {
  return "pool-rate/0.1";
});

server.addMethod("parity_setAuthor", (p1, p2) => {
});

server.addMethod("parity_setExtraData", (p1)=> {
});

server.addMethod("eth_getBlockByNumber", (p) => {
  return {
    "author":"0x9F2E413d79a561893D421AbbfB528Fba67f7d0E0",
    "difficulty":"0xb225a141ca63a",
    "extraData":"0x73656f31",
    "gasLimit":"0x7a121d",
    "gasUsed":"0x7a0417",
    "hash":"0x4d7f183b05cfa2767c6af0a84136e070b38aebb30baebe4eb80931641cfb9a01",
    "logsBloom":"0x000328210280011001601044010201501840d00001120002002221020221c020c80000100004320a4014480800400800020811400008800180098804090000080040080803010001401440084004005010411021802c00080080204000000002000000000e420c000c02414e02080808210002104801a0488c052111102002002020880441300070404460808241c800012398b0004052b60a020004004180e088400020005030150240033910c4c800028008090180045002438040002001000c01000288a000800010003008012010040980018060000800002008220c21108000338084028c300100040c0000a40c01b500040a0004c05120100000002400",
    "miner":"0xb2930b35844a230f00e51431acae96fe543a0347",
    "mixHash":"0x1027e261561dc9cc9c8a47ce76cc993f9740143ee3a9c3f4255f3282c791e2c1",
    "nonce":"0x7a320d001252ee02",
    "number":"0x567f01",
    "parentHash":"0x1f187383e5ed477d786b586d85287ea99bff95825a6767a8c5839fce40d0bca2",
    "receiptsRoot":"0x77e9ac07b8a9f00156c869779e526300688104a65443b214dadbff8eed2d1384",
    "sealFields":[
      "0xa01027e261561dc9cc9c8a47ce76cc993f9740143ee3a9c3f4255f3282c791e2c1",
      "0x887a320d001252ee02"
    ],
    "sha3Uncles":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
    "size":"0x773c",
    "stateRoot":"0xc995a5aff754c9074974932f4bd5512cbcede4b894279b47bb7bfffd5530abf1",
    "timestamp":"0x5b06adfc",
    "totalDifficulty":"0xed1bb9981b3f6f1b09",
    "transactions":[],
    "transactionsRoot":"0x4af111685082b7c4d1cafa003696cd21f673436ed43b5b20622e9da8980f730a",
    "uncles":[]
  };
})

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

app.listen(8545);
