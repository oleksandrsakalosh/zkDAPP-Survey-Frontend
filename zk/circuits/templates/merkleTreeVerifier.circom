pragma circom 2.1.6;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";

/template MerkleTree1Leaf() {
    signal input leaf0;
    signal output root;
    
    // Single leaf is the root
    root <== leaf0;
}

template MerkleTree2Leaves() {
    signal input leaf0;
    signal input leaf1;
    signal output root;
    
    // One hash: Poseidon(L0, L1)
    component hash = Poseidon(2);
    hash.inputs[0] <== leaf0;
    hash.inputs[1] <== leaf1;
    
    root <== hash.out;
}

template MerkleTree3Leaves() {
    signal input leaf0;
    signal input leaf1;
    signal input leaf2;
    signal output root;
    
    /*
     * Level 0: [L0, L1, L2]
     * Level 1: [H(L0,L1), L2]
     * Level 2: H(H(L0,L1), L2)
     */
    
    // Level 1
    component hash01 = Poseidon(2);
    hash01.inputs[0] <== leaf0;
    hash01.inputs[1] <== leaf1;
    
    // Level 2
    component hashRoot = Poseidon(2);
    hashRoot.inputs[0] <== hash01.out;
    hashRoot.inputs[1] <== leaf2;
    
    root <== hashRoot.out;
}

template MerkleTree4Leaves() {
    signal input leaf0;
    signal input leaf1;
    signal input leaf2;
    signal input leaf3;
    signal output root;
    
    /*
     * Level 0: [L0, L1, L2, L3]
     * Level 1: [H(L0,L1), H(L2,L3)]
     * Level 2: H(H(L0,L1), H(L2,L3))
     */
    
    // Level 1
    component hash01 = Poseidon(2);
    hash01.inputs[0] <== leaf0;
    hash01.inputs[1] <== leaf1;
    
    component hash23 = Poseidon(2);
    hash23.inputs[0] <== leaf2;
    hash23.inputs[1] <== leaf3;
    
    // Level 2
    component hashRoot = Poseidon(2);
    hashRoot.inputs[0] <== hash01.out;
    hashRoot.inputs[1] <== hash23.out;
    
    root <== hashRoot.out;
}

template MerkleTree5Leaves() {
    signal input leaf0;
    signal input leaf1;
    signal input leaf2;
    signal input leaf3;
    signal input leaf4;
    signal output root;
    
    /*
     * Level 0: [L0, L1, L2, L3, L4]
     * Level 1: [H(L0,L1), H(L2,L3), L4]
     * Level 2: [H(H(L0,L1),H(L2,L3)), L4]
     * Level 3: H(H(H(L0,L1),H(L2,L3)), L4)
     */
    
    // Level 1: Pair leaves
    component hash01 = Poseidon(2);
    hash01.inputs[0] <== leaf0;
    hash01.inputs[1] <== leaf1;
    
    component hash23 = Poseidon(2);
    hash23.inputs[0] <== leaf2;
    hash23.inputs[1] <== leaf3;
    
    // Level 2: Pair first two hashes
    component hash0123 = Poseidon(2);
    hash0123.inputs[0] <== hash01.out;
    hash0123.inputs[1] <== hash23.out;
    
    // Level 3: Pair with L4
    component hashRoot = Poseidon(2);
    hashRoot.inputs[0] <== hash0123.out;
    hashRoot.inputs[1] <== leaf4;
    
    root <== hashRoot.out;
}

template MerkleTree6Leaves() {
    signal input leaf0;
    signal input leaf1;
    signal input leaf2;
    signal input leaf3;
    signal input leaf4;
    signal input leaf5;
    signal output root;
    
    /*
     * Level 0: [L0, L1, L2, L3, L4, L5]
     * Level 1: [H(L0,L1), H(L2,L3), H(L4,L5)]
     * Level 2: [H(H(L0,L1),H(L2,L3)), H(L4,L5)]
     * Level 3: H(H(H(L0,L1),H(L2,L3)), H(L4,L5))
     */
    
    // Level 1: Pair all leaves
    component hash01 = Poseidon(2);
    hash01.inputs[0] <== leaf0;
    hash01.inputs[1] <== leaf1;
    
    component hash23 = Poseidon(2);
    hash23.inputs[0] <== leaf2;
    hash23.inputs[1] <== leaf3;
    
    component hash45 = Poseidon(2);
    hash45.inputs[0] <== leaf4;
    hash45.inputs[1] <== leaf5;
    
    // Level 2: Pair first two hashes
    component hash0123 = Poseidon(2);
    hash0123.inputs[0] <== hash01.out;
    hash0123.inputs[1] <== hash23.out;
    
    // Level 3: Pair with hash45
    component hashRoot = Poseidon(2);
    hashRoot.inputs[0] <== hash0123.out;
    hashRoot.inputs[1] <== hash45.out;
    
    root <== hashRoot.out;
}

template MerkleTree7Leaves() {
    signal input leaf0;
    signal input leaf1;
    signal input leaf2;
    signal input leaf3;
    signal input leaf4;
    signal input leaf5;
    signal input leaf6;
    signal output root;
    
    /*
     * Level 0: [L0, L1, L2, L3, L4, L5, L6]
     * Level 1: [H(L0,L1), H(L2,L3), H(L4,L5), L6]
     * Level 2: [H(H(L0,L1),H(L2,L3)), H(H(L4,L5),L6)]
     * Level 3: H(H(H(L0,L1),H(L2,L3)), H(H(L4,L5),L6))
     */
    
    // Level 1: Pair leaves
    component hash01 = Poseidon(2);
    hash01.inputs[0] <== leaf0;
    hash01.inputs[1] <== leaf1;
    
    component hash23 = Poseidon(2);
    hash23.inputs[0] <== leaf2;
    hash23.inputs[1] <== leaf3;
    
    component hash45 = Poseidon(2);
    hash45.inputs[0] <== leaf4;
    hash45.inputs[1] <== leaf5;
    
    // Level 2: Pair hashes
    component hash0123 = Poseidon(2);
    hash0123.inputs[0] <== hash01.out;
    hash0123.inputs[1] <== hash23.out;
    
    component hash45_6 = Poseidon(2);
    hash45_6.inputs[0] <== hash45.out;
    hash45_6.inputs[1] <== leaf6;
    
    // Level 3: Final pair
    component hashRoot = Poseidon(2);
    hashRoot.inputs[0] <== hash0123.out;
    hashRoot.inputs[1] <== hash45_6.out;
    
    root <== hashRoot.out;
}

template MerkleTree8Leaves() {
    signal input leaf0;
    signal input leaf1;
    signal input leaf2;
    signal input leaf3;
    signal input leaf4;
    signal input leaf5;
    signal input leaf6;
    signal input leaf7;
    signal output root;
    
    /*
     * Level 0: [L0, L1, L2, L3, L4, L5, L6, L7]
     * Level 1: [H(L0,L1), H(L2,L3), H(L4,L5), H(L6,L7)]
     * Level 2: [H(H(L0,L1),H(L2,L3)), H(H(L4,L5),H(L6,L7))]
     * Level 3: H(H(H(L0,L1),H(L2,L3)), H(H(L4,L5),H(L6,L7)))
     */
    
    // Level 1: Pair all leaves
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
    
    // Level 2: Pair hashes
    component hash0123 = Poseidon(2);
    hash0123.inputs[0] <== hash01.out;
    hash0123.inputs[1] <== hash23.out;
    
    component hash4567 = Poseidon(2);
    hash4567.inputs[0] <== hash45.out;
    hash4567.inputs[1] <== hash67.out;
    
    // Level 3: Final pair
    component hashRoot = Poseidon(2);
    hashRoot.inputs[0] <== hash0123.out;
    hashRoot.inputs[1] <== hash4567.out;
    
    root <== hashRoot.out;
}


template MerkleTreeVerifier() {
    signal input leaves[8];       
    signal input numLeaves;        
    signal input expectedRoot;     // Root to verify against
    
    // Instantiate all possible tree sizes
    component tree1 = MerkleTree1Leaf();
    tree1.leaf0 <== leaves[0];
    
    component tree2 = MerkleTree2Leaves();
    tree2.leaf0 <== leaves[0];
    tree2.leaf1 <== leaves[1];
    
    component tree3 = MerkleTree3Leaves();
    tree3.leaf0 <== leaves[0];
    tree3.leaf1 <== leaves[1];
    tree3.leaf2 <== leaves[2];
    
    component tree4 = MerkleTree4Leaves();
    tree4.leaf0 <== leaves[0];
    tree4.leaf1 <== leaves[1];
    tree4.leaf2 <== leaves[2];
    tree4.leaf3 <== leaves[3];
    
    component tree5 = MerkleTree5Leaves();
    tree5.leaf0 <== leaves[0];
    tree5.leaf1 <== leaves[1];
    tree5.leaf2 <== leaves[2];
    tree5.leaf3 <== leaves[3];
    tree5.leaf4 <== leaves[4];
    
    component tree6 = MerkleTree6Leaves();
    tree6.leaf0 <== leaves[0];
    tree6.leaf1 <== leaves[1];
    tree6.leaf2 <== leaves[2];
    tree6.leaf3 <== leaves[3];
    tree6.leaf4 <== leaves[4];
    tree6.leaf5 <== leaves[5];
    
    component tree7 = MerkleTree7Leaves();
    tree7.leaf0 <== leaves[0];
    tree7.leaf1 <== leaves[1];
    tree7.leaf2 <== leaves[2];
    tree7.leaf3 <== leaves[3];
    tree7.leaf4 <== leaves[4];
    tree7.leaf5 <== leaves[5];
    tree7.leaf6 <== leaves[6];
    
    component tree8 = MerkleTree8Leaves();
    tree8.leaf0 <== leaves[0];
    tree8.leaf1 <== leaves[1];
    tree8.leaf2 <== leaves[2];
    tree8.leaf3 <== leaves[3];
    tree8.leaf4 <== leaves[4];
    tree8.leaf5 <== leaves[5];
    tree8.leaf6 <== leaves[6];
    tree8.leaf7 <== leaves[7];
    
    // check which numLeaves value we have
    component is1 = IsEqual();
    is1.in[0] <== numLeaves;
    is1.in[1] <== 1;
    
    component is2 = IsEqual();
    is2.in[0] <== numLeaves;
    is2.in[1] <== 2;
    
    component is3 = IsEqual();
    is3.in[0] <== numLeaves;
    is3.in[1] <== 3;
    
    component is4 = IsEqual();
    is4.in[0] <== numLeaves;
    is4.in[1] <== 4;
    
    component is5 = IsEqual();
    is5.in[0] <== numLeaves;
    is5.in[1] <== 5;
    
    component is6 = IsEqual();
    is6.in[0] <== numLeaves;
    is6.in[1] <== 6;
    
    component is7 = IsEqual();
    is7.in[0] <== numLeaves;
    is7.in[1] <== 7;
    
    component is8 = IsEqual();
    is8.in[0] <== numLeaves;
    is8.in[1] <== 8;

    // select the correct root (broken into steps)
    signal roots[8];
    roots[0] <== is1.out * tree1.root;
    roots[1] <== is2.out * tree2.root;
    roots[2] <== is3.out * tree3.root;
    roots[3] <== is4.out * tree4.root;
    roots[4] <== is5.out * tree5.root;
    roots[5] <== is6.out * tree6.root;
    roots[6] <== is7.out * tree7.root;
    roots[7] <== is8.out * tree8.root;
    
    signal partial[7];
    partial[0] <== roots[0] + roots[1];
    partial[1] <== partial[0] + roots[2];
    partial[2] <== partial[1] + roots[3];
    partial[3] <== partial[2] + roots[4];
    partial[4] <== partial[3] + roots[5];
    partial[5] <== partial[4] + roots[6];
    partial[6] <== partial[5] + roots[7];
    
    signal computedRoot <== partial[6];
    
    expectedRoot === computedRoot;
}