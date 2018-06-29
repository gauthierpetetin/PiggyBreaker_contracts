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


var piggyContract;

contract("Test the PiggyBreaker contract", (accounts) => {

  // beforeEach('Setup contract for each test', async function () { // Occurs before each "it"
  //   piggyContract = await PiggyBreaker.new();
  //   console.log('Deployed')
  // })

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

  it("Deploying the smart contract", async() => {
    piggyContract = await PiggyBreaker.new();
    PiggyBreaker.new().then(function(instance) {
      piggyContract = instance;
    })

    // piggyContract.Test1().watch(function(error, result){
    //   if (!error) {
    //     console.log('Test1', result);
    //   } else {
    //     console.log(error);
    //   }
    // });
    // piggyContract.Test2().watch(function(error, result){
    //   if (!error) {
    //     console.log('Test2',  result);
    //   } else {
    //     console.log(error);
    //   }
    // });
  })

  it("The farmer variable is the contract owner address", async() => {
    farmer = await piggyContract.farmer.call();
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
  it("The percentage variable is 3%", async() => {
    percentage = (await piggyContract.percentage.call()).toNumber();
    assert.equal(percentage, 3);
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
    let contribution = (await piggyContract.getContributionAmount.call(nbPiggies, accounts[1])).toNumber();

    // currentPiggy = p(await piggyContract.piggies.call(nbPiggies));
    // console.log('Piggy value 1 : ', currentPiggy.value);

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

    // currentPiggy = p(await piggyContract.piggies.call(nbPiggies));
    // console.log('Piggy value 2 : ', currentPiggy.value);

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
  it('does not allow people to break before 5 minutes', async() => {
    try {
      await piggyContract.breakPiggy({
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
    await timeTravel(5*60);

    // Try to break the Piggy (without being a contributor)
    try {
      await piggyContract.breakPiggy({
        from: accounts[3],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }

  });
  it('allows contributors to break the piggy after 5 minutes', async() => {
    let nbPiggies1 = (await piggyContract.nbPiggies.call()).toNumber();
    // Try to break the Piggy (while being a contributor)
    await piggyContract.breakPiggy({
      from: accounts[1],
      gas: '1000000'
    });
    let nbPiggies2 = (await piggyContract.nbPiggies.call()).toNumber();
    assert( (nbPiggies1 + 1) == nbPiggies2 );
  });
  it('does not allow player 1 to withdraw before results are known', async() => {
    try {
      await piggyContract.withdraw(accounts[1], {
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
      await piggyContract.withdraw(accounts[2], {
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
    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();
    await piggyContract.contribute({
      value: (3*rateCurrent),
      from: accounts[3],
      gas: '1000000'
    });

    // Identify the previous winner
    nbPiggies = (await piggyContract.nbPiggies.call()).toNumber();
    previousPiggy = p(await piggyContract.piggies.call(nbPiggies - 1));
    currentPiggy = p(await piggyContract.piggies.call(nbPiggies));
    winner = previousPiggy.winner;
    if (accounts[1] != winner) {
      loser = accounts[1];
    } else {
      loser = accounts[2];
    }

    try {
      await piggyContract.withdraw(loser, {
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
    nbPiggies = (await piggyContract.nbPiggies.call()).toNumber();
    let previousPiggy = p(await piggyContract.piggies.call(nbPiggies - 1));
    currentPiggy = p(await piggyContract.piggies.call(nbPiggies));

    winner = previousPiggy.winner;
    const previousBalance = (await web3.eth.getBalance(winner)).toNumber();
    await piggyContract.withdraw(winner, {
      from: winner,
      gas: '1000000'
    });
    const newBalance = (await web3.eth.getBalance(winner)).toNumber();
    var difference = (previousPiggy.value * (10000 - 375) / 10000) - (newBalance - previousBalance);

    // Verify the transaction cost is less than 0.01 ETH
    // console.log('difference : ', difference);
    assert( difference < 10000000000000000);
  });
  it('does not allow farmer to recover funds before one year', async() => {

    // Wait for 5 minutes
    await timeTravel(5*60);
    // Break Piggy
    await piggyContract.breakPiggy({
      from: accounts[3],
      gas: '1000000'
    });

    // Contribute again to reveal winner
    // let contribution1 = (await piggyContract.pendingReturnValues.call(accounts[3])).toNumber();
    // console.log('pendingReturnValues1 : ', contribution1);
    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();
    await piggyContract.contribute({
      value: (4*rateCurrent),
      from: accounts[4],
      gas: '1000000'
    });
    // let contribution2 = (await piggyContract.pendingReturnValues.call(accounts[3])).toNumber();
    // console.log('pendingReturnValues2 : ', contribution2);

    try {
      await piggyContract.forgottenFundsRecovery(accounts[3], farmer, {
        from: farmer,
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows farmer to recover funds', async() => {
    // Wait for 5 minutes
    await timeTravel(365*24*60*60);
    let pendingReturn1 = (await piggyContract.pendingReturnValues.call(accounts[3])).toNumber();
    const farmerPreviousBalance = (await web3.eth.getBalance(farmer)).toNumber();
    await piggyContract.forgottenFundsRecovery(accounts[3], farmer, {
      from: farmer,
      gas: '1000000'
    });
    let pendingReturn2 = (await piggyContract.pendingReturnValues.call(accounts[3])).toNumber();
    const farmerNewBalance = (await web3.eth.getBalance(farmer)).toNumber();

    var difference = farmerPreviousBalance + pendingReturn1 - farmerNewBalance;

    // Verify the transaction cost is less than 0.01 ETH
    assert( (difference < 10000000000000000) && (pendingReturn2 == 0) );

  });
  it('does not allow people to break (before 5 minutes) before 90 days', async() => {
    // Break Piggy to start a new one
    await piggyContract.breakPiggy({
      from: accounts[4],
      gas: '1000000'
    });
    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();
    await piggyContract.contribute({
      value: (5*rateCurrent),
      from: accounts[5],
      gas: '1000000'
    });

    // Wait for 89 days
    await timeTravel(89 * 24 * 60 * 60);

    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();
    await piggyContract.contribute({
      value: (5*rateCurrent),
      from: accounts[5],
      gas: '1000000'
    });

    // Try to break the Piggy (without being a contributor)
    try {
      await piggyContract.breakPiggy({
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
    await timeTravel(1 * 24 * 60 * 60);

    rateCurrent = (await piggyContract.rateCurrent.call()).toNumber();
    await piggyContract.contribute({
      value: (6*rateCurrent),
      from: accounts[6],
      gas: '1000000'
    });

    let nbPiggies1 = (await piggyContract.nbPiggies.call()).toNumber();
    // Try to break the Piggy (while being a contributor)
    await piggyContract.breakPiggy({
      from: accounts[6],
      gas: '1000000'
    });
    let nbPiggies2 = (await piggyContract.nbPiggies.call()).toNumber();
    assert( (nbPiggies1 + 1) == nbPiggies2 );
  });
  it('increases the rate when frequency increases', async() => {
    var rateInitial = (await piggyContract.rateNext.call()).toNumber();
    console.log('Initial rate 1: ', rateInitial);

    for (var i = 0; i < 16; i++) { // frequency: 3 contrbutions per minute
      for (var j = 0; j < 3; j++) {
        await piggyContract.contribute({
          value: (7*rateCurrent),
          from: accounts[7],
          gas: '1000000'
        });
      }
      await timeTravel(60);
      rateNext = (await piggyContract.rateNext.call()).toNumber();
      lastContributionFrequency = (await piggyContract.lastContributionFrequency.call()).toNumber();
      console.log('Minute: ', i,' rate: ', rateNext, 'frequency: ', lastContributionFrequency);
    }
    assert(rateInitial < rateNext);
  });
  it('decreases the rate when frequency decreases', async() => {
    var rateInitial = (await piggyContract.rateNext.call()).toNumber();
    console.log('Initial rate 2: ', rateInitial);
    for (var i = 0; i < 16; i++) { // frequency: 1 contrbution per minute
      for (var j = 0; j < 2; j++) {
        await piggyContract.contribute({
          value: (7*rateCurrent),
          from: accounts[7],
          gas: '1000000'
        });
      }
      await timeTravel(60);
      rateNext = (await piggyContract.rateNext.call()).toNumber();
      lastContributionFrequency = (await piggyContract.lastContributionFrequency.call()).toNumber();
      console.log('Minute: ', i,' rate: ', rateNext, 'frequency: ', lastContributionFrequency);
    }
    assert(rateInitial > rateNext);
  });
  it('doesnt decrease further than the minimum rate', async() => {
    var rateInitial = (await piggyContract.rateNext.call()).toNumber();
    console.log('Initial rate 3: ', rateInitial);
    for (var i = 0; i < 16; i++) { // frequency: 1 contrbution per minute
      await piggyContract.contribute({
        value: (7*rateCurrent),
        from: accounts[7],
        gas: '1000000'
      });
      await timeTravel(60);
      rateNext = (await piggyContract.rateNext.call()).toNumber();
      lastContributionFrequency = (await piggyContract.lastContributionFrequency.call()).toNumber();
      console.log('Minute: ', i,' rate: ', rateNext, 'frequency: ', lastContributionFrequency);
    }

    await timeTravel(5*60);
    await piggyContract.breakPiggy({ // Useful for next test
      from: accounts[7],
      gas: '1000000'
    });

    rateLimit = (await piggyContract.rateLimit.call()).toNumber();
    assert(rateNext == rateLimit);
  });
  it('tests the 255 blocks limit', async() => {
    console.log('Block1 : ', web3.eth.blockNumber);
    for (var i = 0; i < 260; i++) {
      await timeTravel(1);
    }
    console.log('Block2 : ', web3.eth.blockNumber);
    await piggyContract.contribute({
      value: (8*rateCurrent),
      from: accounts[8],
      gas: '1000000'
    });
    // Identify the previous winner
    nbPiggies = (await piggyContract.nbPiggies.call()).toNumber();
    previousPiggy = p(await piggyContract.piggies.call(nbPiggies - 1));
    assert(previousPiggy.winner != '0x0000000000000000000000000000000000000000');
  });
  it('does not allow random player to set rate limit', async() => {
    try {
      await piggyContract.setRateLimit(10000000000000001, {
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows farmer to set rate limit', async() => {
    let rateLimit1 = (await piggyContract.rateLimit.call()).toNumber();
    await piggyContract.setRateLimit(20000000000000000, {
      from: farmer,
      gas: '1000000'
    });
    let rateLimit2 = (await piggyContract.rateLimit.call()).toNumber();
    assert(rateLimit2 == 20000000000000000);
  });
  it('does not allow random player to set update period', async() => {
    try {
      await piggyContract.setUpdatePeriod((16 * 60), { // Au lieu de 15*60
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows farmer to set update period', async() => {
    let updatePeriod1 = (await piggyContract.updatePeriod.call()).toNumber();
    await piggyContract.setUpdatePeriod((16*60), {
      from: farmer,
      gas: '1000000'
    });
    let updatePeriod2 = (await piggyContract.updatePeriod.call()).toNumber();
    assert(updatePeriod2 == (16*60));
  });
  it('does not allow random player to set percentage', async() => {
    try {
      await piggyContract.setPercentage(2, { // Au lieu de 15*60
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows farmer to set percentage', async() => {
    let percentage1 = (await piggyContract.percentage.call()).toNumber();
    await piggyContract.setPercentage(2, {
      from: farmer,
      gas: '1000000'
    });
    let percentage2 = (await piggyContract.percentage.call()).toNumber();
    assert(percentage2 == 2);
  });
  it('does not allow random player to set piggy protection time', async() => {
    try {
      await piggyContract.setPiggyProtectionTime((7*60), { // Au lieu de 15*60
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows farmer to set rate piggy protection time', async() => {
    let piggyProtectionTime1 = (await piggyContract.piggyProtectionTime.call()).toNumber();
    await piggyContract.setPiggyProtectionTime((7*60), {
      from: farmer,
      gas: '1000000'
    });
    let piggyProtectionTime2 = (await piggyContract.piggyProtectionTime.call()).toNumber();
    assert(piggyProtectionTime2 == (7*60));
  });
  it('does not allow random player to set piggy protection limit', async() => {
    try {
      await piggyContract.setPiggyProtectionLimit((91 * 24 * 60 * 60), { // Au lieu de 15*60
        from: accounts[5],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('allows farmer to set rate piggy protection limit', async() => {
    let piggyProtectionLimit1 = (await piggyContract.piggyProtectionLimit.call()).toNumber();
    await piggyContract.setPiggyProtectionLimit((91 * 24 * 60 * 60), {
      from: farmer,
      gas: '1000000'
    });
    let piggyProtectionLimit2 = (await piggyContract.piggyProtectionLimit.call()).toNumber();
    assert(piggyProtectionLimit2 == (91 * 24 * 60 * 60));
  });
  it("allows to transfer tavern ownership", async() => {
    initialFarmer = (await piggyContract.farmer.call()).toString();
    await piggyContract.transferFarmOwnership(accounts[9], {
      from: initialFarmer,
      gas: '1000000'
    });
    newFarmer = (await piggyContract.farmer.call()).toString();
    await piggyContract.transferFarmOwnership(initialFarmer, {
      from: accounts[9],
      gas: '1000000'
    });
    farmer = (await piggyContract.farmer.call()).toString();
    // console.log('initialFarmer', initialFarmer);
    // console.log('newFarmer', newFarmer);
    // console.log('farmer', farmer);
    assert( (newFarmer == accounts[9]) && (farmer == initialFarmer) );
  })
  it("does not allow farmer to set new contract address when not paused", async() => {
    farmer = (await piggyContract.farmer.call()).toString();
    try {
      await piggyContract.setNewAddress(accounts[5], {
        from: farmer,
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  })
  it("does not allows random player to pause contract", async() => {
    try {
      await piggyContract.pause({
        from: accounts[2],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  })
  it("allows farmer to pause contract", async() => {
    farmer = (await piggyContract.farmer.call()).toString();
    await piggyContract.pause({
      from: farmer,
      gas: '1000000'
    });
    try {
      await piggyContract.contribute({
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
      await piggyContract.setNewAddress(accounts[5], {
        value: (2*rateCurrent),
        from: accounts[2],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  })
  it("allows farmer to set new contract address when paused", async() => {
    farmer = (await piggyContract.farmer.call()).toString();
    await piggyContract.setNewAddress(accounts[5], {
      from: farmer,
      gas: '1000000'
    });
    var newContractAddress = (await piggyContract.newContractAddress.call()).toString();
    assert(newContractAddress == accounts[5]);
  })
  it("does not allow random player to unpause contract", async() => {
    try {
      await piggyContract.unpause({
        from: accounts[2],
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  })
  it("allows farmer to unpause contract", async() => {
    var paused1 = await piggyContract.paused.call();
    farmer = (await piggyContract.farmer.call()).toString();
    await piggyContract.unpause({
      from: farmer,
      gas: '1000000'
    });
    var paused2 = await piggyContract.paused.call();
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
