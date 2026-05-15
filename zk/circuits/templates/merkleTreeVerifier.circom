pragma circom 2.1.6;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";

template MerkleTree10Leaves() {
    signal input leaf0, leaf1, leaf2, leaf3, leaf4, leaf5, leaf6, leaf7, leaf8, leaf9;
    signal output root;
    
    component hash01 = Poseidon(2);
    hash01.inputs[0] <== leaf0;
    hash01.inputs[1] <== leaf1;
    
    component hash23 = Poseidon(2);
    hash23.inputs[0] <== leaf2;
    hash23.inputs[1] <== leaf3;
    
    component hash45 = Poseidon(2);
    hash45.inputs[0] <== leaf4;
    hash45.inputs[1] <== leaf5;
    
    component hash67 = Poseidon(2);
    hash67.inputs[0] <== leaf6;
    hash67.inputs[1] <== leaf7;
    
    component hash89 = Poseidon(2);
    hash89.inputs[0] <== leaf8;
    hash89.inputs[1] <== leaf9;
    
    component hash0123 = Poseidon(2);
    hash0123.inputs[0] <== hash01.out;
    hash0123.inputs[1] <== hash23.out;
    
    component hash4567 = Poseidon(2);
    hash4567.inputs[0] <== hash45.out;
    hash4567.inputs[1] <== hash67.out;
    
    component hash8989 = Poseidon(2);
    hash8989.inputs[0] <== hash89.out;
    hash8989.inputs[1] <== hash89.out;
    
    component hash01234567 = Poseidon(2);
    hash01234567.inputs[0] <== hash0123.out;
    hash01234567.inputs[1] <== hash4567.out;
    
    component hash89898989 = Poseidon(2);
    hash89898989.inputs[0] <== hash8989.out;
    hash89898989.inputs[1] <== hash8989.out;
    
    component hashRoot = Poseidon(2);
    hashRoot.inputs[0] <== hash01234567.out;
    hashRoot.inputs[1] <== hash89898989.out;
    
    root <== hashRoot.out;
}


template MerkleTreeVerifier() {
    signal input leaves[10];  
    signal input expectedRoot;
    
    component tree = MerkleTree10Leaves();
    tree.leaf0 <== leaves[0];
    tree.leaf1 <== leaves[1];
    tree.leaf2 <== leaves[2];
    tree.leaf3 <== leaves[3];
    tree.leaf4 <== leaves[4];
    tree.leaf5 <== leaves[5];
    tree.leaf6 <== leaves[6];
    tree.leaf7 <== leaves[7];
    tree.leaf8 <== leaves[8];
    tree.leaf9 <== leaves[9];
    
    expectedRoot === tree.root;
}