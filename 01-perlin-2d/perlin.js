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

    /**
     * Linear interpolation of an individual point on a 2d grid given a source grid of points.
     * @param {Number[][]} source array of rows (min size 2x2)
     * @param {Number} pointX the point defined within the space of the width
     * @param {Number} pointY the point defined within the space of the height
     * @param {Number} width grid width
     * @param {Number} height grid height
     */
    this.linearInterpolateSamplePoints = function(source, pointX, pointY, width, height) {
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

        var interpolatedXT = sampleTL * (1 - relativeX) + sampleTR * relativeX;
        var interpolatedXB = sampleBL * (1 - relativeX) + sampleBR * relativeX;
        var interpolated = interpolatedXT * (1 - relativeY) + interpolatedXB * relativeY;
        return interpolated;
    }

    /**
     * Linear interpolation of an individual point on a 2d grid given a source grid of vectors.
     * @param {Vector[][]} source array of rows (min size 2x2)
     * @param {Number} pointX the point defined within the space of the width
     * @param {Number} pointY the point defined within the space of the height
     * @param {Number} width grid width
     * @param {Number} height grid height
     */
    this.linearInterpolateSampleVectors = function(source, pointX, pointY, width, height) {
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
     * @return 2d array of points on the grid
     */
    this.generatePerlinPoints = function(minFrequency, maxFrequency, amplitudeCalc, width, height) {
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
                    row[x] += amplitudeCalc(frequency) * this.linearInterpolateSamplePoints(sample, x, y, width, height);
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
