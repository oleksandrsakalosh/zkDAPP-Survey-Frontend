pragma circom 2.1.6;

include "../../../node_modules/circomlib/circuits/comparators.circom";

template MatchAnyOf(maxOptions) {
    signal input disclosedValue;
    signal input allowedValues[maxOptions];
    
    signal output matched;
    
    component checks[maxOptions];
    signal isMatch[maxOptions];
    
    for (var i = 0; i < maxOptions; i++) {
        checks[i] = IsEqual();
        checks[i].in[0] <== disclosedValue;
        checks[i].in[1] <== allowedValues[i];
        isMatch[i] <== checks[i].out;
    }
    
    // Sum matches
    signal sumMatches;
    var temp = isMatch[0];
    for (var i = 1; i < maxOptions; i++) {
        temp = temp + isMatch[i];
    }
    sumMatches <== temp;
    
    // at least one match
    component hasMatch = GreaterThan(8);
    hasMatch.in[0] <== sumMatches;
    hasMatch.in[1] <== 0;
    
    matched <== hasMatch.out;
}