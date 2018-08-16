var PiggyBreaker = artifacts.require("Piggies");

expect = require("chai").expect; // npm install chai

// ---------- Module to accelerate time -----------------------
const jsonrpc = '2.0'
const id = 0
const send = (method, params = []) =>
  web3.currentProvider.send({ id, jsonrpc, method, params })
const timeTravel = async seconds => {
  await send('evm_increaseTime', [seconds])
  await send('evm_mine')
}
// ---------- Module to accelerate time (end)------------------


var gameContract;
var splitContract;

contract("Test the PiggyBreaker contract", (accounts) => {

  // beforeEach('Setup contract for each test', async function () { // Occurs before each "it"
  //   gameContract = await PiggyBreaker.new();
  //   console.log('Deployed')
  // })

  var owner;
  var farmer;
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
  var previousPiggy;

  var winner;
  var loser;

  it("Deploying the Piggy Breaker smart contract", async() => {
    gameContract = await PiggyBreaker.new();
    // PiggyBreaker.new().then(function(instance) {
    //   gameContract = instance;
    // })
  })
  it("The owner variable is the contract owner address", async() => {
    owner = await gameContract.owner.call();
    assert.equal(owner.toString(), accounts[0]);
  })
  it("The farmer variable is the contract owner address", async() => {
    farmer = await gameContract.farmer.call();
    assert.equal(farmer.toString(), accounts[0]);
  })
  it("The nbpiggies variable is 1", async() => {
    nbPiggies = (await gameContract.nbPiggies.call()).toNumber();
    assert.equal(nbPiggies, 1);
  })
  it("The rateLimit variable is 10000000000000000", async() => {
    rateLimit = (await gameContract.rateLimit.call()).toNumber();
    assert.equal(rateLimit, 10000000000000000);
  })
  it("The rateCurrent variable is 10000000000000000", async() => {
    rateCurrent = (await gameContract.rateCurrent.call()).toNumber();
    assert.equal(rateCurrent, 10000000000000000);
  })
  it("The rateNext variable is 10000000000000000", async() => {
    rateNext = (await gameContract.rateNext.call()).toNumber();
    assert.equal(rateNext, 10000000000000000);
  })
  it("The updatePeriod variable is 900s (15 minutes)", async() => {
    updatePeriod = (await gameContract.updatePeriod.call()).toNumber();
    assert.equal(updatePeriod, 900);
  })
  it("The percentage variable is 3%", async() => {
    percentage = (await gameContract.percentage.call()).toNumber();
    assert.equal(percentage, 3);
  })
  it("The piggyProtectionTime variable is 300s (5 minutes)", async() => {
    piggyProtectionTime = (await gameContract.piggyProtectionTime.call()).toNumber();
    assert.equal(piggyProtectionTime, 300);
  })
  it("The piggyProtectionLimit variable is 7,776,000 (3 months)", async() => {
    piggyProtectionLimit = (await gameContract.piggyProtectionLimit.call()).toNumber();
    assert.equal(piggyProtectionLimit, 7776000);
  })
  it("The localContributionsCounter variable is 0", async() => {
    localContributionsCounter = (await gameContract.localContributionsCounter.call()).toNumber();
    assert.equal(localContributionsCounter, 0);
  })
  it("The lastContributionFrequency variable is 0", async() => {
    lastContributionFrequency = (await gameContract.lastContributionFrequency.call()).toNumber();
    assert.equal(lastContributionFrequency, 0);
  })

  it("First Piggy is created and open", async() => {
    currentPiggy = p(await gameContract.piggies.call(nbPiggies));
    assert(currentPiggy.open)
  })

  it('allows people to contribute money and mark them as contributors', async() => {
    rateCurrent = (await gameContract.rateCurrent.call()).toNumber();
    const balance = (await web3.eth.getBalance(accounts[1])).toNumber();
    const rateRandom = Math.random() * (balance - rateCurrent);
    const randomContribution = (1*rateCurrent) + rateRandom ;
    await gameContract.contribute({
      value: randomContribution,
      from: accounts[1],
      gas: '1000000'
    });
    nbPiggies = (await gameContract.nbPiggies.call()).toNumber();
    let contribution = (await gameContract.getContributionAmount.call(nbPiggies, accounts[1])).toNumber();

    // currentPiggy = p(await gameContract.piggies.call(nbPiggies));
    // console.log('Piggy value 1 : ', currentPiggy.value);

    assert((contribution > 0) && (contribution == randomContribution));
  });
  it('allows people to contribute with the minimum contribution', async() => {
    rateCurrent = (await gameContract.rateCurrent.call()).toNumber();
    await gameContract.contribute({
      value: rateCurrent,
      from: accounts[2],
      gas: '1000000'
    });
    nbPiggies = (await gameContract.nbPiggies.call()).toNumber();
    let contribution = (await gameContract.getContributionAmount.call(nbPiggies, accounts[2])).toNumber();

    // currentPiggy = p(await gameContract.piggies.call(nbPiggies));
    // console.log('Piggy value 2 : ', currentPiggy.value);

    assert((contribution > 0) && (contribution == rateCurrent) );
  });
  it('does not allow people to contribute with less than the minimum contribution', async() => {
    rateCurrent = (await gameContract.rateCurrent.call()).toNumber();
    const smallContribution = ((1*rateCurrent) - 1);
    try {
      await gameContract.contribute({
        value: smallContribution,
        from: accounts[0],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('does not allow people to break before 5 minutes', async() => {
    try {
      await gameContract.breakPiggy({
        from: accounts[1],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('does not allow people to break (afer 5 minutes) if they did not contribute', async() => {

    // ----------------Récupération du bloc-------------------------------------
    // const blockNumber = web3.eth.blockNumber;
    // console.log('blockNumber: ', blockNumber);
    // const currentBlock = await web3.eth.getBlock(blockNumber);
    // console.log('currentBlock: ', currentBlock.timestamp);
    // ----------------Récupération du bloc-------------------------------------
    // Wait for 5 minutes
    await timeTravel(5*60 + 1);

    // Try to break the Piggy (without being a contributor)
    try {
      await gameContract.breakPiggy({
        from: accounts[3],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }

  });
  it('allows contributors to break the piggy after 5 minutes', async() => {
    let nbPiggies1 = (await gameContract.nbPiggies.call()).toNumber();

    // Try to break the Piggy (while being a contributor)
    await gameContract.breakPiggy({
      from: accounts[1],
      gas: '1000000'
    });
    let nbPiggies2 = (await gameContract.nbPiggies.call()).toNumber();

    assert( (nbPiggies1 + 1) == nbPiggies2 );
  });
  it('does not allow player 1 to withdraw before results are known', async() => {
    try {
      await gameContract.withdraw(accounts[1], {
        from: accounts[1],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('does not player 2 to withdraw before results are known', async() => {
    try {
      await gameContract.withdraw(accounts[2], {
        from: accounts[2],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('does not allow loser to withdraw once results are known', async() => {

    // Contribute to reveal the previous winner
    rateCurrent = (await gameContract.rateCurrent.call()).toNumber();
    await gameContract.contribute({
      value: (3*rateCurrent),
      from: accounts[3],
      gas: '1000000'
    });

    // Identify the previous winner
    nbPiggies = (await gameContract.nbPiggies.call()).toNumber();
    previousPiggy = p(await gameContract.piggies.call(nbPiggies - 1));
    currentPiggy = p(await gameContract.piggies.call(nbPiggies));
    winner = previousPiggy.winner;
    if (accounts[1] != winner) {
      loser = accounts[1];
    } else {
      loser = accounts[2];
    }

    try {
      await gameContract.withdraw(loser, {
        from: loser,
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows winner to withdraw once results are known', async() => {

    // Identify the previous winner
    nbPiggies = (await gameContract.nbPiggies.call()).toNumber();
    let previousPiggy = p(await gameContract.piggies.call(nbPiggies - 1));
    currentPiggy = p(await gameContract.piggies.call(nbPiggies));

    winner = previousPiggy.winner;
    const previousBalance = (await web3.eth.getBalance(winner)).toNumber();
    await gameContract.withdraw(winner, {
      from: winner,
      gas: '1000000'
    });
    const newBalance = (await web3.eth.getBalance(winner)).toNumber();
    var difference = (previousPiggy.value * (10000 - 375) / 10000) - (newBalance - previousBalance);

    // Verify the transaction cost is less than 0.01 ETH
    // console.log('difference : ', difference);
    assert( difference < 10000000000000000);
  });
  it('does not allow owner to recover funds before one year', async() => {

    // Wait for 5 minutes
    await timeTravel(5*60 + 1);
    // Break Piggy
    await gameContract.breakPiggy({
      from: accounts[3],
      gas: '1000000'
    });

    // Contribute again to reveal winner
    // let contribution1 = (await gameContract.pendingReturnValues.call(accounts[3])).toNumber();
    // console.log('pendingReturnValues1 : ', contribution1);
    rateCurrent = (await gameContract.rateCurrent.call()).toNumber();
    await gameContract.contribute({
      value: (4*rateCurrent),
      from: accounts[4],
      gas: '1000000'
    });
    // let contribution2 = (await gameContract.pendingReturnValues.call(accounts[3])).toNumber();
    // console.log('pendingReturnValues2 : ', contribution2);

    try {
      await gameContract.forgottenFundsRecovery(accounts[3], owner, {
        from: owner,
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows owner to recover funds', async() => {
    // Wait for 5 minutes
    await timeTravel(365*24*60*60 + 1);
    let pendingReturn1 = (await gameContract.pendingReturnValues.call(accounts[3])).toNumber();
    const ownerPreviousBalance = (await web3.eth.getBalance(owner)).toNumber();
    await gameContract.forgottenFundsRecovery(accounts[3], owner, {
      from: owner,
      gas: '1000000'
    });
    let pendingReturn2 = (await gameContract.pendingReturnValues.call(accounts[3])).toNumber();
    const ownerNewBalance = (await web3.eth.getBalance(owner)).toNumber();

    var difference = ownerPreviousBalance + pendingReturn1 - ownerNewBalance;

    // Verify the transaction cost is less than 0.01 ETH
    assert( (difference < 10000000000000000) && (pendingReturn2 == 0) );

  });
  it('does not allow people to break (before 5 minutes) before 90 days', async() => {
    // Break Piggy to start a new one
    await gameContract.breakPiggy({
      from: accounts[4],
      gas: '1000000'
    });
    rateCurrent = (await gameContract.rateCurrent.call()).toNumber();
    await gameContract.contribute({
      value: (5*rateCurrent),
      from: accounts[5],
      gas: '1000000'
    });

    // Wait for 89 days
    await timeTravel(89 * 24 * 60 * 60);

    rateCurrent = (await gameContract.rateCurrent.call()).toNumber();
    await gameContract.contribute({
      value: (5*rateCurrent),
      from: accounts[5],
      gas: '1000000'
    });

    // Try to break the Piggy (without being a contributor)
    try {
      await gameContract.breakPiggy({
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }

  });
  it('allows people to break (before 5 minutes) after 90 days', async() => {
    // Wait for 1 more day
    await timeTravel(1 * 24 * 60 * 60 + 1);

    rateCurrent = (await gameContract.rateCurrent.call()).toNumber();
    await gameContract.contribute({
      value: (6*rateCurrent),
      from: accounts[6],
      gas: '1000000'
    });

    let nbPiggies1 = (await gameContract.nbPiggies.call()).toNumber();
    // Try to break the Piggy (while being a contributor)
    await gameContract.breakPiggy({
      from: accounts[6],
      gas: '1000000'
    });
    let nbPiggies2 = (await gameContract.nbPiggies.call()).toNumber();
    assert( (nbPiggies1 + 1) == nbPiggies2 );
  });
  it('increases the rate when frequency increases', async() => {
    var rateInitial = (await gameContract.rateNext.call()).toNumber();
    console.log('Initial rate 1: ', rateInitial);

    for (var i = 0; i < 16; i++) { // frequency: 3 contrbutions per minute
      for (var j = 0; j < 3; j++) {
        await gameContract.contribute({
          value: (7*rateCurrent),
          from: accounts[7],
          gas: '1000000'
        });
      }
      await timeTravel(60);
      rateNext = (await gameContract.rateNext.call()).toNumber();
      lastContributionFrequency = (await gameContract.lastContributionFrequency.call()).toNumber();
      console.log('Minute: ', i,' rate: ', rateNext, 'frequency: ', lastContributionFrequency);
    }
    assert(rateInitial < rateNext);
  });
  it('decreases the rate when frequency decreases', async() => {
    var rateInitial = (await gameContract.rateNext.call()).toNumber();
    console.log('Initial rate 2: ', rateInitial);
    for (var i = 0; i < 16; i++) { // frequency: 1 contrbution per minute
      for (var j = 0; j < 2; j++) {
        await gameContract.contribute({
          value: (7*rateCurrent),
          from: accounts[7],
          gas: '1000000'
        });
      }
      await timeTravel(60);
      rateNext = (await gameContract.rateNext.call()).toNumber();
      lastContributionFrequency = (await gameContract.lastContributionFrequency.call()).toNumber();
      console.log('Minute: ', i,' rate: ', rateNext, 'frequency: ', lastContributionFrequency);
    }
    assert(rateInitial > rateNext);
  });
  it('doesnt decrease further than the minimum rate', async() => {
    var rateInitial = (await gameContract.rateNext.call()).toNumber();
    console.log('Initial rate 3: ', rateInitial);
    for (var i = 0; i < 16; i++) { // frequency: 1 contrbution per minute
      await gameContract.contribute({
        value: (7*rateCurrent),
        from: accounts[7],
        gas: '1000000'
      });
      await timeTravel(60);
      rateNext = (await gameContract.rateNext.call()).toNumber();
      lastContributionFrequency = (await gameContract.lastContributionFrequency.call()).toNumber();
      console.log('Minute: ', i,' rate: ', rateNext, 'frequency: ', lastContributionFrequency);
    }

    await timeTravel(5*60);
    await gameContract.breakPiggy({ // Useful for next test
      from: accounts[7],
      gas: '1000000'
    });

    rateLimit = (await gameContract.rateLimit.call()).toNumber();
    assert(rateNext == rateLimit);
  });
  it('tests the 255 blocks limit', async() => {
    console.log('Block1 : ', web3.eth.blockNumber);
    for (var i = 0; i < 260; i++) {
      await timeTravel(1);
    }
    console.log('Block2 : ', web3.eth.blockNumber);
    await gameContract.contribute({
      value: (8*rateCurrent),
      from: accounts[8],
      gas: '1000000'
    });
    // Identify the previous winner
    nbPiggies = (await gameContract.nbPiggies.call()).toNumber();
    previousPiggy = p(await gameContract.piggies.call(nbPiggies - 1));
    assert(previousPiggy.winner != '0x0000000000000000000000000000000000000000');
  });
  it('does not allow random player to set rate limit', async() => {
    try {
      await gameContract.setRateLimit(10000000000000001, {
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows owner to set rate limit', async() => {
    let rateLimit1 = (await gameContract.rateLimit.call()).toNumber();
    await gameContract.setRateLimit(20000000000000000, {
      from: owner,
      gas: '1000000'
    });
    let rateLimit2 = (await gameContract.rateLimit.call()).toNumber();
    assert(rateLimit2 == 20000000000000000);
  });
  it('does not allow random player to set update period', async() => {
    try {
      await gameContract.setUpdatePeriod((16 * 60), { // Au lieu de 15*60
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows owner to set update period', async() => {
    let updatePeriod1 = (await gameContract.updatePeriod.call()).toNumber();
    await gameContract.setUpdatePeriod((16*60), {
      from: owner,
      gas: '1000000'
    });
    let updatePeriod2 = (await gameContract.updatePeriod.call()).toNumber();
    assert(updatePeriod2 == (16*60));
  });
  it('does not allow random player to set percentage', async() => {
    try {
      await gameContract.setPercentage(2, { // Au lieu de 15*60
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows owner to set percentage', async() => {
    let percentage1 = (await gameContract.percentage.call()).toNumber();
    await gameContract.setPercentage(2, {
      from: owner,
      gas: '1000000'
    });
    let percentage2 = (await gameContract.percentage.call()).toNumber();
    assert(percentage2 == 2);
  });
  it('does not allow random player to set piggy protection time', async() => {
    try {
      await gameContract.setPiggyProtectionTime((7*60), { // Au lieu de 15*60
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows owner to set rate piggy protection time', async() => {
    let piggyProtectionTime1 = (await gameContract.piggyProtectionTime.call()).toNumber();
    await gameContract.setPiggyProtectionTime((7*60), {
      from: owner,
      gas: '1000000'
    });
    let piggyProtectionTime2 = (await gameContract.piggyProtectionTime.call()).toNumber();
    assert(piggyProtectionTime2 == (7*60));
  });
  it('does not allow random player to set piggy protection limit', async() => {
    try {
      await gameContract.setPiggyProtectionLimit((91 * 24 * 60 * 60), { // Au lieu de 15*60
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows owner to set rate piggy protection limit', async() => {
    let piggyProtectionLimit1 = (await gameContract.piggyProtectionLimit.call()).toNumber();
    await gameContract.setPiggyProtectionLimit((91 * 24 * 60 * 60), {
      from: owner,
      gas: '1000000'
    });
    let piggyProtectionLimit2 = (await gameContract.piggyProtectionLimit.call()).toNumber();
    assert(piggyProtectionLimit2 == (91 * 24 * 60 * 60));
  });
  it("allows to transfer piggy ownership", async() => {
    initialOwner = (await gameContract.owner.call()).toString();
    await gameContract.transferPiggyOwnership(accounts[9], {
      from: initialOwner,
      gas: '1000000'
    });
    newOwner = (await gameContract.owner.call()).toString();
    await gameContract.transferPiggyOwnership(initialOwner, {
      from: accounts[9],
      gas: '1000000'
    });
    owner = (await gameContract.owner.call()).toString();
    assert( (newOwner == accounts[9]) && (owner == initialOwner) );
  })
  it("allows to set a new farmer address", async() => {
    owner = (await gameContract.owner.call()).toString();
    initialFarmer = (await gameContract.farmer.call()).toString();
    await gameContract.setFarmerAddress(accounts[8], {
      from: owner,
      gas: '1000000'
    });
    newFarmer = (await gameContract.farmer.call()).toString();
    await gameContract.setFarmerAddress(initialFarmer, {
      from: accounts[8],
      gas: '1000000'
    });
    assert( (newFarmer == accounts[8]) && (owner == initialFarmer) );
  })
  it("does not allow owner to set new contract address when not paused", async() => {
    owner = (await gameContract.owner.call()).toString();
    try {
      await gameContract.setNewAddress(accounts[5], {
        from: owner,
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  })
  it("does not allows random player to pause contract", async() => {
    try {
      await gameContract.pause({
        from: accounts[2],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  })
  it("allows owner to pause contract", async() => {
    owner = (await gameContract.owner.call()).toString();
    await gameContract.pause({
      from: owner,
      gas: '1000000'
    });
    try {
      await gameContract.contribute({
        value: (2*rateCurrent),
        from: accounts[2],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  })
  it("does not allow random player to set new contract address when paused", async() => {
    try {
      await gameContract.setNewAddress(accounts[5], {
        value: (2*rateCurrent),
        from: accounts[2],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  })
  it("allows owner to set new contract address when paused", async() => {
    owner = (await gameContract.owner.call()).toString();
    await gameContract.setNewAddress(accounts[5], {
      from: owner,
      gas: '1000000'
    });
    var newContractAddress = (await gameContract.newContractAddress.call()).toString();
    assert(newContractAddress == accounts[5]);
  })
  it("does not allow random player to unpause contract", async() => {
    try {
      await gameContract.unpause({
        from: accounts[2],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  })
  it("allows owner to unpause contract", async() => {
    var paused1 = await gameContract.paused.call();
    owner = (await gameContract.owner.call()).toString();
    await gameContract.unpause({
      from: owner,
      gas: '1000000'
    });
    var paused2 = await gameContract.paused.call();
    assert(paused1 && (!paused2))
  })
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
    winner: pg[7]
  }
}

//
// it('creates first Piggy', async() => {
//     const nbPiggies = await cryptoPiggy.methods.nbPiggies().call();
//     const currentPiggy = await cryptoPiggy.methods.piggies(nbPiggies).call();
//     assert( (nbPiggies == (initial_nbPiggies + 1) ) && currentPiggy.open );
//   });
