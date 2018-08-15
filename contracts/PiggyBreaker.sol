pragma solidity ^0.4.24;


/**
* @title SafeMath
* @dev Math operations with safety checks that throw on error
*/
library SafeMath {
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a * b;
    assert(a == 0 || c / a == b);
    return c;
  }

  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}


contract PiggyOwner {

  using SafeMath for uint256;

  address public owner;
  address public farmer;

  constructor() public {
    owner = msg.sender;
    farmer = msg.sender;
  }

  modifier restricted() { require(msg.sender == owner); _; }

  function transferPiggyOwnership(address _newOwner) external restricted {
    if (_newOwner != address(0)) {
      owner = _newOwner;
    }
  }

  function setFarmerAddress(address _newFarmer) external restricted {
    if (_newFarmer != address(0)) {
      farmer = _newFarmer;
    }
  }

}

contract Pausable is PiggyOwner {

  bool public paused = false;

  address public newContractAddress;

  event Pause();
  event Unpause();
  event ContractUpgrade(address newContract);

  modifier whenNotPaused() { require(!paused); _; }

  modifier whenPaused { require(paused); _; }

  function pause() public restricted whenNotPaused returns (bool) {
    paused = true;
    emit Pause();
    return true;
  }

  function unpause() public restricted whenPaused returns (bool) {
    /* require(newContractAddress == address(0)); */
    paused = false;
    emit Unpause();
    return true;
  }

  function setNewAddress(address _v2Address) external restricted whenPaused {
      newContractAddress = _v2Address;
      emit ContractUpgrade(_v2Address);
  }

}

contract Piggies is Pausable {

  struct Piggy {
    uint256 piggyID;
    uint256 value;
    bool open;
    uint256 creationTime;
    uint256 lastContributionTime;
    uint256 brokenTime;
    uint256 brokenBlockNumber;
    uint256[] contributions;
    address winner;
    mapping (address => bool) contributed;
    mapping (uint256 => address) contributors;
  }

  uint256 public nbPiggies = 0;
  uint256 public rateLimit = 10000000000000000;               // E.g. 0.01 ether
  uint256 public rateCurrent = rateLimit;
  uint256 public rateNext = rateLimit;

  uint256 public updatePeriod = 15 * 60;                      // Every 15 minutes, the minimum contribution rate is updated
  uint256 public percentage = 3;                              // The growth percentage of the minimum contribution rate is 100%
                                                              // Example :
                                                              //   - If the contribution frequency increases, the minimum contribution rate will increase by 100% every 15 minutes
                                                              //   - If the contribution frequency decreases, the minimum contribution rate will decrease by 50% every 15 minutes

  uint256 public piggyProtectionTime = 5 * 60;                // The Piggy is protected after each new contribution during piggyProtectionTime
  uint256 public piggyProtectionLimit = 90 * 24 * 60 * 60;    // After the piggyProtectionLimit, the Piggy isn't protected anymore

  uint256 public localContributionsCounter = 0;
  uint256 public lastUpdateDate = now;
  uint256 public lastContributionFrequency = 0;

  mapping (uint256 => Piggy) public piggies;                  // All piggies
  mapping (address => uint256) public pendingReturnValues;    // Earnings of game vistories
  mapping (address => uint256) public pendingReturnDates;     // Timestamps of game victories


  event PiggyCreated(uint256 _piggyID);
  event NewPiggyContribution(uint256 _piggyID, address _player, uint256 _value, uint256 _nbContribution);
  event UpdateRate(uint256 _piggyID, uint256 _rateCurrent, uint256 _rateNext);
  event PiggyBroken(uint256 _piggyID, uint256 _value, uint256 timestamp, uint256 _nbContribution);
  event WinnerRevealed(uint256 _piggyID, address _winner, uint256 _value);
  event Withdrawal(address _player, uint256 _value);

  modifier contributed(address _player) {
    Piggy storage piggy = piggies[nbPiggies];
    bool playerContributed = false;
    if( piggy.contributed[_player] ) {
      playerContributed = true;
    }
    require( playerContributed ); _;
  }

  modifier noPlayerJoinedRecently() {
    Piggy storage piggy = piggies[nbPiggies];
    require( (now > piggy.lastContributionTime.add(piggyProtectionTime) ) || (now > piggy.creationTime.add(piggyProtectionLimit) ) ); _;
  }

  modifier contributionIsHighEnough(uint256 _contribution) {
    require( _contribution >= rateCurrent ); _;
  }

  modifier piggyWinnerIsUnknown(uint256 _piggyID) {
    Piggy storage piggy = piggies[_piggyID];
    require( (!piggy.open) && (piggy.winner==address(0)) ); _;
  }

  modifier blockNumberIsValid(uint256 _currentBlockNumber) {
    Piggy storage piggy = piggies[nbPiggies];
    require( piggy.brokenBlockNumber < _currentBlockNumber ); _;
  }

  // Constructor
  constructor() public {
    createNewPiggy();
  }

  function createNewPiggy() private {
    require(!piggies[nbPiggies].open);

    nbPiggies = nbPiggies.add(1);
    uint256 _piggyID = nbPiggies;
    uint256[] memory _contributions;
    address _winner;

    piggies[_piggyID] = Piggy({
      piggyID: _piggyID,
      value: 0,
      open: true,
      creationTime: now,
      lastContributionTime: now,
      brokenTime: 0,
      brokenBlockNumber: 0,
      contributions: _contributions,
      winner: _winner
    });

    rateCurrent = rateLimit;
    rateNext = rateLimit;

    localContributionsCounter = 0;
    lastUpdateDate = now;
    lastContributionFrequency = 0;

    emit PiggyCreated(_piggyID);
  }

  function contribute() public payable
    contributionIsHighEnough(msg.value)
  {
    Piggy storage piggy = piggies[nbPiggies];
    require(piggy.open);

    // If this is the first contribution, the previous winner needs to be revealed
    if(nbPiggies > 1 && (piggy.value == 0) ) {
      revealPreviousWinner(nbPiggies.sub(1));
    }

    piggy.value = piggy.value.add(msg.value);

    piggy.contributions.push(piggy.value);
    piggy.contributed[msg.sender] = true;
    piggy.contributors[piggy.value] = msg.sender;
    piggy.lastContributionTime = now;

    localContributionsCounter = localContributionsCounter.add(1);
    updateRate();

    emit NewPiggyContribution(nbPiggies, msg.sender, msg.value, getNbContributions(nbPiggies));
  }

  function updateRate() private {
    uint256 timeSinceLastUpdate = now.sub(lastUpdateDate);
    require(rateNext >= rateLimit);

    if ( timeSinceLastUpdate > updatePeriod) {
      // Update current rate (minimum contribution for the current period)
      rateCurrent = rateNext;

      // Calculate next rate (minimum contribution for the next period)
      uint256 decimals = 1000000000;
      uint256 currentContributionFrequency = localContributionsCounter.mul(decimals).div(timeSinceLastUpdate);
      if(currentContributionFrequency >= lastContributionFrequency) {
        rateNext = rateCurrent.mul( percentage.add(100) ).div(100);
      }
      else {
        rateNext = rateCurrent.mul(100).div( percentage.add(100) );
      }

      if (rateNext < rateLimit) {
        rateNext = rateLimit;
      }

      localContributionsCounter = 0;
      lastUpdateDate = now;
      lastContributionFrequency = currentContributionFrequency;
      emit UpdateRate(nbPiggies, rateCurrent, rateNext);

    }
  }


  function breakPiggy() public
    noPlayerJoinedRecently
    contributed(msg.sender)
  {
    Piggy storage piggy = piggies[nbPiggies];
    piggy.brokenTime = now;
    piggy.brokenBlockNumber = block.number;
    piggy.open = false;

    emit PiggyBroken(nbPiggies, piggy.value, now, getNbContributions(nbPiggies));

    createNewPiggy();
  }

  function revealPreviousWinner(uint256 _piggyID) private
    piggyWinnerIsUnknown(_piggyID)
    blockNumberIsValid(block.number)
  {
    Piggy storage piggy = piggies[_piggyID];

    // We need to ensure the element used to define the winner could not be predicted at the time the Piggy was broken (at block #piggy.brokenBlockNumber)
    uint256 nonPredictableBlockNumber = piggy.brokenBlockNumber.add(1);
    uint256 distance = block.number - nonPredictableBlockNumber;
    if( distance > 255 ) {    // Since blockhash() returns 0 if the block is older than 256 blocks, we make sure nonPredictableBlockNumber is not older than 256 blocks.
      nonPredictableBlockNumber = block.number.sub( distance % 255 );
    }
    uint256 winnerNumber = uint256( keccak256(abi.encodePacked(blockhash(nonPredictableBlockNumber))) ) % piggy.value;
    uint256 totalValue = piggy.value;

    if( piggy.contributions.length == 1) {                                      // If only, one player, he can leave without playing the lottery
      piggy.winner = piggy.contributors[piggy.contributions[0]];
    }
    else {
      for (uint256 i = 0; i < piggy.contributions.length; i = i.add(1)) {       // If more than one player, play the lottery
        if( winnerNumber <= piggy.contributions[i] ) {
          piggy.winner = piggy.contributors[piggy.contributions[i]];
          uint256 piggyReparationFee = piggy.value.mul(375).div(10000);
          totalValue = totalValue.sub(piggyReparationFee);
          pendingReturnValues[farmer] = pendingReturnValues[farmer].add(piggyReparationFee);//A new piggy is offered to the farmer to replace the broken one
          break;
        }
      }
    }

    pendingReturnValues[piggy.winner] = pendingReturnValues[piggy.winner].add(totalValue);//The winner receives the reward
    pendingReturnDates[piggy.winner] = now;

    emit WinnerRevealed(_piggyID, piggy.winner, piggy.value);
  }

  function withdraw(address _withDrawalAddress) public {
    require(pendingReturnValues[msg.sender]>0);
    uint256 withdrawalValue = pendingReturnValues[msg.sender];
    pendingReturnValues[msg.sender] = 0;
    _withDrawalAddress.transfer(withdrawalValue);

    emit Withdrawal(msg.sender, withdrawalValue);
  }

  function setRateLimit(uint256 _newRateLimit) public restricted {
    rateLimit = _newRateLimit;
  }

  function setUpdatePeriod(uint256 _newUpdatePeriod) public restricted {
    require(_newUpdatePeriod > 60);
    updatePeriod = _newUpdatePeriod;
  }

  function setPercentage(uint256 _newPercentage) public restricted {
    percentage = _newPercentage;
  }

  function setPiggyProtectionTime(uint256 _piggyProtectionTime) public restricted {
    piggyProtectionTime = _piggyProtectionTime;
  }

  function setPiggyProtectionLimit(uint256 _piggyProtectionLimit) public restricted {
    piggyProtectionLimit = _piggyProtectionLimit;
  }

  function getContributionAmount(uint256 _piggyID, address _player) public view returns(uint256) {
    Piggy storage piggy = piggies[_piggyID];
    uint256 contributionAmount = 0;
    for(uint256 i = 0; i < piggy.contributions.length; i = i.add(1)) {
      if( piggy.contributors[piggy.contributions[i]] == _player ) {
        if(i==0) {
          contributionAmount = contributionAmount.add(piggy.contributions[i]);
        }
        else {
          contributionAmount = contributionAmount.add( piggy.contributions[i].sub(piggy.contributions[i.sub(1)]) );
        }
      }
    }
    return contributionAmount;
  }

  function getNbContributions(uint256 _piggyID) public view returns(uint256) {
    Piggy storage piggy = piggies[_piggyID];
    return piggy.contributions.length;
  }

  function forgottenFundsRecovery(address _playerAddress, address _withDrawalAddress) public restricted {
    uint256 oneYear = 365 * 24 * 60 * 60;
    require(now > oneYear.add(pendingReturnDates[_playerAddress]) );
    uint256 withdrawalValue = pendingReturnValues[_playerAddress];
    pendingReturnValues[_playerAddress] = 0;
    _withDrawalAddress.transfer(withdrawalValue);
  }

}
