pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../templates/findHashInLeaves.circom";
include "../templates/merkleTreeVerifier.circom";

template MainCheck() {
    
    // === INPUTS ===

    signal input pubKey[2];         // public key (issuer) (from zkp.publicKey)
    signal input signatureR8[2];    // signature (from zkp.signature)
    signal input signatureS;
    signal input merkleRoot;        // signed merkle root (from zkp.merkleRoot)

    signal input leaves[8];

    // = Attribute disclosures =
    signal input dobSalt;
    signal input dobKey;            // "birth_date" (strToBigInt)
    signal input dobValue; 

    // = Requirements (public) =
    signal input currentDate;       // verified on-chain
    signal input minAge;

    // = Enable/disable flags (public) =
    signal input enableAgeCheck;    // 1 = check age, 0 = skip


    // === MANDATORY CHECKS ===

    // 1. Verify issuer signature (over merkleRoot)
    component sigVerifier = EdDSAPoseidonVerifier();
    sigVerifier.Ax <== pubKey[0];
    sigVerifier.Ay <== pubKey[1];
    sigVerifier.S <== signatureS;
    sigVerifier.R8x <== signatureR8[0];
    sigVerifier.R8y <== signatureR8[1];
    sigVerifier.M <== merkleRoot;
    sigVerifier.enabled <== 1;

    // 2. Reconstruct merkle tree


    // == HASH CHECKS ==

    // === Age check

    component dobHasher = Poseidon(3);
    dobHasher.inputs[0] <== dobSalt;
    dobHasher.inputs[1] <== dobKey;
    dobHasher.inputs[2] <== dobValue;

    component dobHashInLeaves = HashInLeaves(8);
    dobHashInLeaves.computedHash <== dobHasher.out;
    dobHashInLeaves.leaves <== leaves;
    signal dobHashValid <== enableAgeCheck * dobHashInLeaves.found + (1 - enableAgeCheck);
    dobHashValid === 1;


    // === ELIGIBILITY CHECKS===

    // === Age check
    component ageCheck = GreaterEqThan(32);
    ageCheck.in[0] <== currentDate - dobValue;
    ageCheck.in[1] <== minAge * 10000;
    signal ageValid <== enableAgeCheck * ageCheck.out + (1 - enableAgeCheck);
    ageValid === 1;

}

component main {public [
    pubKey, 
    merkleRoot, 
    currentDate, 
    minAge,
    enableAgeCheck
]} = MainCheck();


/* INPUT = {
    "pubKey": ["20819777127488100708022598367786075971449507556999841353307206018836784896341", "14004583041878220981011147487899050448009418260081102041065039551201105990467"],
    "signatureR8": ["17997311963968886387652432263165320131054798655874891818154377217403580548237", "17097544178078374739904298299639049597596270367901368805122907614310005299312"],
    "signatureS": "376033356480446684730116482975333370366452964361593072354028520491170031198",
    "merkleRoot": "6112351876996090230370281385329517814180196664822276728239033977880954933347",
    "dobValue": "20041308",
    "currentDate": "20260424",
    "minAge": "20",
    "enableAgeCheck": "1",
    "dobSalt": "3142880700",
    "dobKey": "464737070780541271372901",
    "leaves": [
        "13331374590056957791073832315181254001254964171137729458985776925405813693069", 
        "2998116835741520443103129646414977607278345787773150564073498130281976056205",
        "12314199091909345604383300493443315493715545551338265501595851293100841130985",
        "2006149560056616747781119872902350910533888464982069121833245963953878008009",
        "0",
        "0",
        "0",
        "0"
        ],
    "numLeaves": "4"
} */