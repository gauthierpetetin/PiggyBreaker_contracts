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

contract Piggies {

  function withdraw(address _withDrawalAddress) public {}

}

/**
 * @title PiggySplit
 * @dev Base contract that supports multiple payees claiming funds sent to this contract
 * according to the proportion they own.
 */
contract PiggySplit {
  using SafeMath for uint256;

  Piggies piggyContract;

  uint256 public totalShares = 0;
  uint256 public totalReleased = 0;

  mapping(address => uint256) public shares;
  mapping(address => uint256) public released;
  address[] public payees;

  /**
   * @dev Constructor
   * Anthony, David, Gauthier, Matthis, Pablo, Raphael, Sylvain
   * ["0xb5747835141b46f7c472393b31f8f5a57f74a44f", "0x53799fa918c8b4c3e207f684575873e9c5f1b00c", "0xc6f0410a667a5bea528d6bc9efbe10270089bb11", "0xa1ee07042c67e2a0391ba2a418c8fd19522ba130", "0xed9f644c1228644e62a8e3911ca20afb48029e70", "0xc050ca762d1913ba642a8bec6220710667c34f9b", "0x158af3e880835664c396f5d28dab7ee9b73c206f"],["5000", "5000", "26500", "6750", "16750", "26500", "13500"]
   */
  constructor(address _piggyContractAddress, address[] _payees, uint256[] _shares) public payable {
    require(_payee != address(0));
    require(_payees.length == _shares.length);
    require(_payees.length > 0);

    for (uint256 i = 0; i < _payees.length; i++) {
      addPayee(_payees[i], _shares[i]);
    }

    piggyContract = Piggies(_piggyContractAddress);
  }

  /**
   * @dev Update PiggyBreaker contract address.
   */
  function updateGameAddress(address _newPiggyContractAddress) public {

    require(_newPiggyContractAddress != address(0));

    piggyContract = Piggies(_newPiggyContractAddress);

  }

  /**
   * @dev payable fallback
   */
  function () external payable {}

  /**
   * @dev Collect PiggyBreaker benefits (farmer account).
   */
  function pullGameBenefits() public {

    piggyContract.withdraw(address(this));

  }


  /**
   * @dev Claim your share of the balance.
   */
  function claim() public {
    address payee = msg.sender;

    require(shares[payee] > 0);

    uint256 totalReceived = address(this).balance.add(totalReleased);
    uint256 payment = totalReceived.mul(shares[payee]).div(totalShares).sub(released[payee]);

    require(payment != 0);
    assert(address(this).balance >= payment);

    released[payee] = released[payee].add(payment);
    totalReleased = totalReleased.add(payment);

    payee.transfer(payment);
  }

  /**
   * @dev Add a new payee to the contract.
   * @param _payee The address of the payee to add.
   * @param _shares The number of shares owned by the payee.
   */
  function addPayee(address _payee, uint256 _shares) internal {
    require(_payee != address(0));
    require(_shares > 0);
    require(shares[_payee] == 0);

    payees.push(_payee);
    shares[_payee] = _shares;
    totalShares = totalShares.add(_shares);
  }

  function changeAddress(address _newAddress) external {
    require (_newAddress != address(0));
    require(shares[msg.sender] != 0);
    require(shares[_newAddress] == 0);

    for(uint256 i = 0; i < payees.length; i = i.add(1)) {
      if( msg.sender == payees[i] ) {
        payees[i] = _newAddress;
      }
    }

    shares[_newAddress] = shares[msg.sender];
    shares[msg.sender] = 0;

    released[_newAddress] = released[msg.sender];
    released[msg.sender] = 0;
  }

  function getShares() public view
    returns (uint256 payeeShares)
  {
    require(shares[msg.sender] != 0);
    payeeShares = shares[msg.sender].div(totalShares);
  }

  function getFunds() public view
    returns (uint256 payeeFunds)
  {
    require(shares[msg.sender] != 0);
    uint256 totalReceived = address(this).balance.add(totalReleased);
    payeeFunds = totalReceived.mul(shares[msg.sender]).div(totalShares).sub(released[msg.sender]);
  }

}
