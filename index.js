const express = require("express");
const bodyParser = require("body-parser");
const { JSONRPCServer, JSONRPCClient } = require("json-rpc-2.0");
const { keccak256 } = require("ethereum-cryptography/keccak");
const web3 = require("web3");
const env = require('env-var');
const Ethash = require('ethashjs');
const ethHashUtil = require('./util.js')

const RATE_DIV = env.get("PR_RATE_DIV").asIntPositive() || 1;
const LOGGING = env.get("PR_LOG").asString() || "minimal";
const level = require('level-mem')

const cacheDB = level();
const ethash = new Ethash(cacheDB);

function debug(msg) {
  if (LOGGING == "debug") {
    console.log(msg);
  }
}

const seedhash0 = keccak256(
        Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex")
    ).toString("hex");
console.log(`seedhash: ${seedhash0}`);
console.log(`rate divider: ${RATE_DIV}`);
console.log(`logging: ${LOGGING}`);

const target = web3.utils.toBN(2).pow(web3.utils.toBN(256)).div(web3.utils.toBN(1000000 * RATE_DIV));

console.log(`target: ${web3.utils.padLeft("0x" + target.toString('hex'), 64)}`);

const server = new JSONRPCServer();

var State = {
  epoch: 187,
  fullSize: 2650796416,
  work: [
    "0x384525b16fcfda97e6cb019fc9baff53736079f52340ac4bc3a6cad8e63aa546",
    `0x${seedhash0}`,
    // this is 2**256 // 1000000, so that solution rate per second will translate directly in MHs
    web3.utils.padLeft("0x" + target.toString('hex'), 64),
  ],
  block: {
    "author":"0xb2930b35844a230f00e51431acae96fe543a0347",
    "difficulty": `0x${web3.utils.toBN(1000000*RATE_DIV).toString('hex')}`,
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
  }
};

State.next = function() {
  let nextBlockNumber = web3.utils.toBN(State.block.number).add(web3.utils.toBN(1));
  State.block.number = "0x" + nextBlockNumber.toString("hex");

  let sealHash = web3.utils.soliditySha3(
    State.block.parentHash,
    State.block.sha3Uncles,
    State.block.author,
    State.block.stateRoot,
    State.block.transactionsRoot,
    State.block.receiptsRoot,
    State.block.logsBloom,
    web3.utils.toBN(State.block.difficulty),
    web3.utils.toBN(State.block.number),
    web3.utils.toBN(State.block.gasLimit),
    web3.utils.toBN(State.block.gasUsed),
    web3.utils.toBN(State.block.timestamp),
    web3.utils.toBN(State.block.nonce)
  );

  let nextEpoch = ethHashUtil.getEpoc(nextBlockNumber);
  if (State.epoch !== nextEpoch) {
    State.epoch = nextEpoch;
    console.log(`Block number: ${nextBlockNumber}`)
    console.log(`Epoch: ${nextEpoch}`)
    ethash.mkcache(nextEpoch, Buffer.alloc(32).fill(0));
    console.log(`Cache: ${web3.utils.toHex(ethash.cache)}`)
    State.fullSize = ethHashUtil.getFullSize(nextEpoch);
    console.log(`Fullsize: ${State.fullSize}`)
  }

  State.work[0] = sealHash;
}

State.next();

State.printNewWork = function() {
  debug("new work: " + JSON.stringify(State.work));
  debug("new block: " + JSON.stringify(State.block));
}

var blocks = [];
var lastLogged = new Date().getTime() / 1000;

server.addMethod("eth_getWork", () => {
  debug(`Requested work: ${JSON.stringify(State.work)}`);

  return State.work;
});

server.addMethod("eth_submitWork", (work) => {
    let submittedWork = JSON.parse(JSON.stringify(work));

    let nonce = submittedWork[0].substring(2);
    let powHash = submittedWork[1].substring(2);
    let mixhashSubmitWork = submittedWork[2].substring(2);
    console.log(`nonce: ${nonce}, powHash: ${powHash}, mixhashSubmitWork: ${mixhashSubmitWork}`)
    console.log(`Block's mixHash ${State.block.mixHash}`)
    let blockTime = new Date().getTime() / 1000;
    blocks.push(blockTime);
    if (blocks.length > 1000) {
      blocks.shift();
    }

    let result = ethash.run(new Buffer(powHash, 'hex'), new Buffer(nonce, 'hex'), State.fullSize);
    let mixHash = result.mix.toString('hex')
    // logging every 5 seconds
    if (lastLogged < (blockTime-5) && blocks.length > 0) {
      lastLogged = blockTime;
      let firstTime = blocks[0];
      let lastTime = blocks[blocks.length-1];
      let solutions = blocks.length;
      let rate = (solutions / (lastTime - firstTime)) * RATE_DIV;
      console.log(`${(new Date()).toISOString()} | Rate ${rate.toFixed(2)}Mh/s`);
    }

    State.next();
    console.log(`mixHash: ${mixHash}`)
    console.log(`mixDigest: ${mixhashSubmitWork}`)
    let validWork = mixHash === mixhashSubmitWork;
    console.log(`validWork: ${validWork}`);
    return validWork;
});

server.addMethod("web3_clientVersion", () => {
  return "pool-rate/0.1";
});

server.addMethod("parity_setAuthor", (p1, p2) => {
});

server.addMethod("parity_setExtraData", (p1)=> {
});

server.addMethod("eth_getBlockByNumber", (p) => State.block);

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

setInterval(() => {
  State.next();
  State.printNewWork();
}, 10000);
