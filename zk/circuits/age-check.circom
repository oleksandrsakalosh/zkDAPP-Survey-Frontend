pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

template AgeCheck() {
    signal input currentDate; // verified on-chain
    signal input minAge;
    // signal input dobHashPayload; // from payload[_sd]
    
    // signal input dobSalt;
    // signal input dobName;
    signal input dobValue;

    // TODO: when poseidon in Issuer will be done
    // 1. Check hash 

    // component disclosureHash = Poseidon(3);
    // disclosureHash.inputs[0] <== dobSalt;
    // disclosureHash.inputs[1] <== dobName;
    // disclosureHash.inputs[2] <== dobValue;
    // disclosureHash.out === dobHashPayload;
    
    // 2. Check age
    component ageCheck = GreaterEqThan(32);
    ageCheck.in[0] <== currentDate - dobValue;
    ageCheck.in[1] <== minAge * 10000;
    ageCheck.out === 1;
}

// TODO: public dobHashPayload
component main {public [currentDate, minAge]} = AgeCheck();