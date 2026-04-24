pragma circom 2.1.6;

include "../../../node_modules/circomlib/circuits/comparators.circom";

template HashInLeaves(n) {
    signal input computedHash;
    signal input leaves[n];
    signal output found;
    
    // Compare hash against each leaf
    component equals[n];
    signal matches[n];
    
    for (var i = 0; i < n; i++) {
        equals[i] = IsEqual();
        equals[i].in[0] <== computedHash;
        equals[i].in[1] <== leaves[i];
        matches[i] <== equals[i].out;
    }
    
    signal totalMatches[n];
    totalMatches[0] <== matches[0];
    
    for (var i = 1; i < n; i++) {
        totalMatches[i] <== totalMatches[i-1] + matches[i];
    }
    
    component anyMatch = GreaterThan(8);
    anyMatch.in[0] <== totalMatches[n-1];
    anyMatch.in[1] <== 0;
    
    found <== anyMatch.out;
}