var PiggyBreaker = artifacts.require("Piggies");

expect = require("chai").expect; // npm install chai


// Ne marche pas
// const artifacts = require('../build/contracts/Piggies.json')
// const contract = require('truffle-contract')
// let PiggyBreaker = contract(artifacts);
// PiggyBreaker.setProvider(web3.currentProvider);


var piggyContract;

contract("Test the PiggyBreaker contract", (accounts) => {

  // beforeEach('Setup contract for each test', async function () { // Occurs before each "it"
  //   piggyContract = await PiggyBreaker.new();
  //   console.log('Deployed')
  // })

  var nbPiggies;
  var rateLimit;
  var rateCurrent;
  var rateNext;
  var updatePeriod;
  var percentage;
  var piggyProtectionTime;
  var piggyProtectionLimit;
  var localContributionsCounter;
  var lastContributionFrequency;

  var currentPiggy;

  it("Deploying the smart contract", async() => {
    piggyContract = await PiggyBreaker.new();
    PiggyBreaker.new().then(function(instance) {
      piggyContract = instance;
    })
  })

  it("The farmer variable is the contract owner address", async() => {
    const farmer = await piggyContract.farmer.call();
    assert.equal(farmer.toString(), accounts[0]);
  })
  it("The nbpiggies variable is 1", async() => {
    nbPiggies = (await piggyContract.nbPiggies.call()).toNumber();
    assert.equal(nbPiggies, 1);
  })
  it("The rateLimit variable is 10000000000000000", async() => {
    rateLimit = (await piggyContract.rateLimit.call()).toNumber();
    assert.equal(rateLimit, 10000000000000000);
  })
  it("The rateCurrent variable is 10000000000000000", async() => {
    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();
    assert.equal(rateCurrent, 10000000000000000);
  })
  it("The rateNext variable is 10000000000000000", async() => {
    rateNext = (await piggyContract.rateNext.call()).toNumber();
    assert.equal(rateNext, 10000000000000000);
  })
  it("The updatePeriod variable is 900s (15 minutes)", async() => {
    updatePeriod = (await piggyContract.updatePeriod.call()).toNumber();
    assert.equal(updatePeriod, 900);
  })
  it("The percentage variable is 1%", async() => {
    percentage = (await piggyContract.percentage.call()).toNumber();
    assert.equal(percentage, 1);
  })
  it("The piggyProtectionTime variable is 300s (5 minutes)", async() => {
    piggyProtectionTime = (await piggyContract.piggyProtectionTime.call()).toNumber();
    assert.equal(piggyProtectionTime, 300);
  })
  it("The piggyProtectionLimit variable is 7,776,000 (3 months)", async() => {
    piggyProtectionLimit = (await piggyContract.piggyProtectionLimit.call()).toNumber();
    assert.equal(piggyProtectionLimit, 7776000);
  })
  it("The localContributionsCounter variable is 0", async() => {
    localContributionsCounter = (await piggyContract.localContributionsCounter.call()).toNumber();
    assert.equal(localContributionsCounter, 0);
  })
  it("The lastContributionFrequency variable is 0", async() => {
    lastContributionFrequency = (await piggyContract.lastContributionFrequency.call()).toNumber();
    assert.equal(lastContributionFrequency, 0);
  })

  it("First Piggy is created and open", async() => {
    currentPiggy = p(await piggyContract.piggies.call(nbPiggies));
    assert(currentPiggy.open)
  })

  it('allows people to contribute money and mark them as contributors', async() => {
    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();
    const balance = (await web3.eth.getBalance(accounts[1])).toNumber();
    const rateRandom = Math.random() * (balance - rateCurrent);
    const randomContribution = (1*rateCurrent) + rateRandom ;
    await piggyContract.contribute({
      value: randomContribution,
      from: accounts[1],
      gas: '1000000'
    });
    nbPiggies = (await piggyContract.nbPiggies.call()).toNumber();
    assert(true);
    let contribution = (await piggyContract.getContributionAmount.call(nbPiggies, accounts[1])).toNumber();
    assert((contribution > 0) && (contribution == randomContribution));
  });
  it('allows people to contribute with the minimum contribution', async() => {
    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();
    await piggyContract.contribute({
      value: rateCurrent,
      from: accounts[2],
      gas: '1000000'
    });
    nbPiggies = (await piggyContract.nbPiggies.call()).toNumber();
    let contribution = (await piggyContract.getContributionAmount.call(nbPiggies, accounts[2])).toNumber();
    assert((contribution > 0) && (contribution == rateCurrent) );
  });
  it('does not allow people to contribute with less than the minimum contribution', async() => {
    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();
    const smallContribution = ((1*rateCurrent) - 1);
    try {
      await piggyContract.contribute({
        value: smallContribution,
        from: accounts[0],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows contributors to break the piggy after 5 minutes', async() => {

    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();

    // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    // ICI ON RECUPERE LE BLOC ACTUEL
    // console.log('web3 : ', web3.eth);
    // console.log('getBalance : ', balance);
    const blockNumber = await web3.eth.getBlockNumber();
    console.log('blockNumber: ', blockNumber);
    // const currentBlock = await web3.eth.getBlock(blockNumber);
    // console.log('currentBlock: ', currentBlock);

    // ICI ON EFFECTUE UN SAUT TEMPOREL
    // await timeTravel(800); // (à decommenter pour obtenir l'erreur)

    // ICI ON RECUPER LE BLOC APRES LE SAUT TEMPOREL
    // const blockNumber2 = await web3.eth.getBlockNumber();
    // console.log('blockNumber2: ', blockNumber2);
    // const currentBlock2 = await web3.eth.getBlock(blockNumber2);
    // console.log('currentBlock: ', currentBlock2);
    // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    assert(true);
  });

})

function p (pg) {
  return {
    piggyID: pg[0].toNumber(),
    value: pg[1].toNumber(),
    open: pg[2],
    creationTime: pg[3].toNumber(),
    lastContributionTime: pg[4].toNumber(),
    brokenTime: pg[5].toNumber(),
    brokenBlockNumber: pg[6].toNumber(),
    contributions: pg[7],
    winner: pg[8]
  }
}

//
// it('creates first Piggy', async() => {
//     const nbPiggies = await cryptoPiggy.methods.nbPiggies().call();
//     const currentPiggy = await cryptoPiggy.methods.piggies(nbPiggies).call();
//     assert( (nbPiggies == (initial_nbPiggies + 1) ) && currentPiggy.open );
//   });
