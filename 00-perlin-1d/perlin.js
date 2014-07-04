'use strict';

var Perlin = function(maxSamples) {

    // generate arrays with random samples given the number of desired samples and an amplitude
    var sample = function(numSamples, amplitude) {
        // new Array initializes with undefined, which breaks map
        var initializedArray = Array.apply(null, new Array(numSamples));

        return initializedArray.map(function() {
            return Math.random() * amplitude;
        });
    };

    // basic linear interpolation
    var interpolate = function(first, second, offset) {
        console.assert(offset > 0);
        console.assert(offset < 1);
        return (second - first) * offset + first;
    };

    // given a samples array, populate enough points between the values to get its length up to maxSamples
    var interpolateArray = function(samples) {
        var results = [];

        for (var i = 0; i < maxSamples; i++) {

            // given the sample point, find where in the array this sample falls
            var samplesPosition = i / maxSamples * (samples.length - 1);
            var samplesLow = Math.floor(samplesPosition);
            var samplesHigh = Math.ceil(samplesPosition);


            // if equal, just get the exact value
            if (samplesLow === samplesHigh) {
                results.push(samples[samplesPosition]);

            // otherwise interpolate between the two points
            } else {
                results.push(interpolate(samples[samplesLow], samples[samplesHigh], samplesPosition - samplesLow));
            }

        }

        return results;
    };

    // a decent iteration pattern for perlin is decreasing amplitude as frequency (num samples) increase.
    var iterations = [];
    var amplitude = 2;
    for (var numSamples = maxSamples; numSamples > 2; numSamples /= 2, amplitude *= 2) {
        var samples = sample(numSamples, amplitude);
        //console.log(samples);
        iterations.push(interpolateArray(samples));
    }

    // sum the iterations together
    var rawResults = iterations.reduce(function(memo, iteration) {
        for (var i = 0; i < memo.length; i++) {
            memo[i] += iteration[i];
        }
        return memo;
    });

    // normalize the iterations between 0 and 1
    var max = Math.max.apply(null, rawResults);
    var min = Math.min.apply(null, rawResults);
    var results = rawResults.map(function(value) { return (value - min) / (max - min); });

    //console.log(results);

    return results;
}
