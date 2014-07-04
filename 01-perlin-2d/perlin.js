'use strict';

var Vector = function() {
    this.x = undefined;
    this.y = undefined;
}

/**
 * Set vector values.
 */
Vector.prototype.set = function(x, y) {
    this.x;
    this.y;
    return this;
}

/**
 * Create a vector pointing within -1 -> 1 range.
 */
Vector.prototype.random = function() {
    this.x = Math.random() * 2 - 1;
    this.y = Math.random() * 2 - 1;
    return this;
}

/**
 * Normalize this vector to length of 1.
 */
Vector.prototype.normalize = function() {
    var length = Math.sqrt(this.x * this.x + this.y * this.y);
    this.x /= length;
    this.y /= length;
    return this;
}

var Perlin = function() {

    this._linear = function(x, y, tl, tr, bl, br) {
        var xt = tl * (1 - x) + tr * x;
        var xb = bl * (1 - x) + br * x;

        return xt * (1 - y) + xb * y;
    }


    this._cubic = function(x, y, tl, tr, bl, br) {
        var cubic = function(offset) {
            console.assert(offset <= 1);
            console.assert(offset >= 0);

            var result = 3 * (offset * offset) - 2 * (offset * offset * offset);

            console.assert(result <= 1, result);
            console.assert(result >= 0, result);
            return result;
        };

        var xt = tl * cubic(1 - x) + tr * cubic(x);
        var xb = bl * cubic(1 - x) + br * cubic(x);

        return xt * cubic(1 - y) + xb * cubic(y);
    };

    /**
     * Interpolation of an individual point on a 2d grid given a source grid of points.
     * @param {Number[][]} source array of rows (min size 2x2)
     * @param {Number} pointX the point defined within the space of the width
     * @param {Number} pointY the point defined within the space of the height
     * @param {Number} width grid width
     * @param {Number} height grid height
     * @param {function} interpolation function (see _linear or _cubic)
     */
    this.interpolateSamplePoints = function(source, pointX, pointY, width, height, interpolator) {
        console.assert(source.length && source[0].length);
        console.assert(pointX >= 0 && pointX <= width);
        console.assert(pointY >= 0 && pointY <= height);

        var sampleRows = source.length;
        var sampleCols = source[0].length;

        var samplesX = pointX / width  * (sampleRows - 1);
        var samplesY = pointY / height * (sampleCols - 1);

        var xFloor = Math.floor(samplesX);
        var yFloor = Math.floor(samplesY);

        var xCeil = Math.ceil(samplesX);
        var yCeil = Math.ceil(samplesY);

        var sampleTL = source[yFloor][xFloor];
        var sampleTR = source[yFloor][xCeil];
        var sampleBL = source[yCeil][xFloor];
        var sampleBR = source[yCeil][xCeil];

        //console.log('Samples: ', sampleTL, sampleTR, sampleBL, sampleBR);

        var relativeX = samplesX - xFloor;
        var relativeY = samplesY - yFloor;

        //console.log('Relative: ', relativeX, relativeY);

        return interpolator(relativeX, relativeY, sampleTL, sampleTR, sampleBL, sampleBR);
    }

    /**
     * Interpolation of an individual point on a 2d grid given a source grid of vectors.
     * @param {Vector[][]} source array of rows (min size 2x2)
     * @param {Number} pointX the point defined within the space of the width
     * @param {Number} pointY the point defined within the space of the height
     * @param {Number} width grid width
     * @param {Number} height grid height
     * @param {function} interpolation function (see _linear or _cubic)
     */
    this.interpolateSampleVectors = function(source, pointX, pointY, width, height, interpolator) {
    }

    /**
     * Generate a random grid of 2d values.
     * @param {Number} width array width
     * @param {Number} height array height
     * @return 2d array of numbers between 0 and 1
     */
    this.generateSamplePoints = function(width, height) {
        var samples = [];
        for (var y = 0; y < height; y++) {
            var sampleRow = [];
            for (var x = 0; x < width; x++) {
                sampleRow.push(Math.random());
            }
            samples.push(sampleRow);
        }
        return samples;
    }

    /**
     * Generate a random grid of 2d normal vectors.
     * @param {Number} width array width
     * @param {Number} height array height
     * @return 2d array of normal Vectors
     */
    this.generateSampleVectors = function(width, height) {
        var samples = [];
        for (var y = 0; y < height; y++) {
            var sampleRow = [];
            for (var x = 0; x < width; x++) {
                var vector = new Vector().random().normalize();
                sampleRow.push(vector);
            }

            samples.push(sampleRow);
        }
        return samples;
    }

    /**
     * Generate Perlin points.
     * @param {Number} minFrequency the minimum frequency
     * @param {Number} maxFrequency the maximum frequency
     * @param {function(frequency)} amplitudeCalc the function that takes a frequency and returns the amplitude to be applied
     * @param {Boolean} truethy value to indicate if we should use linear or cubic interoplation
     * @return 2d array of points on the grid
     */
    this.generatePerlinPoints = function(minFrequency, maxFrequency, amplitudeCalc, width, height, linear) {
        var interpolator = linear ? this._linear : this._cubic;

        var samples = [];
        for (var frequency = minFrequency; frequency <= maxFrequency; frequency *= 2) {
            samples.push(this.generateSamplePoints(frequency, frequency));
        }

        var points = [];
        for (var y = 0; y < height; y++) {
            var row = Array.apply(null, new Array(width)).map(function() { return 0; }); // initialize zeroed array
            for (var x = 0; x < width; x++) {
                for (var i = 0; i < samples.length; i++) {
                    var sample = samples[i];
                    row[x] += amplitudeCalc(frequency) * this.interpolateSamplePoints(sample, x, y, width, height, interpolator);
                }
            }
            points.push(row);
        }

        // normalize
        var max = points.reduce(function(memo, pointRow) {
            return Math.max(memo, Math.max.apply(Math, pointRow));
        }, Number.MIN_VALUE);
        var min = points.reduce(function(memo, pointRow) {
            return Math.min(memo, Math.min.apply(Math, pointRow));
        }, Number.MAX_VALUE);

        points = points.map(function(pointRow) {
            return pointRow.map(function(point) {
                return Math.round((point - min) / (max - min) * 100) / 100;
            });
        });

        return points;
    }

}
