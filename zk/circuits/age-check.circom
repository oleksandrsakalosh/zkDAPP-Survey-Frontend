pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

template AgeCheck() {
    signal input currentDate; // verified on-chain
    signal input minAge;
    signal input dobValue;

    component ageCheck = GreaterEqThan(32);
    ageCheck.in[0] <== currentDate - dobValue;
    ageCheck.in[1] <== minAge * 10000;
    ageCheck.out === 1;
}

component main {public [currentDate, minAge]} = AgeCheck();