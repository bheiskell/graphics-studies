'use strict';

var Vector = function(x, y) {
    this.x = x;
    this.y = y;
}

/**
 * Create a vector pointing within -1 -> 1 range.
 */
Vector.prototype.random = function() {
    return new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1);
}

/**
 * Normalize this vector to length of 1.
 */
Vector.prototype.normalize = function() {
    var length = Math.sqrt(this.x * this.x + this.y * this.y);

    if ( length === 0 ) {
        return new Vector(0, 0);
    }

    return new Vector(this.x / length, this.y / length);
}

/**
 * Calculate the dot product.
 */
Vector.prototype.dot = function(v) {
    return this.x * v.x + this.y * v.y;
}

/**
 * Subtract.
 */
Vector.prototype.minus = function(x, y) {
    return new Vector(this.x - x, this.y - y);
}

var Perlin = function() {

    this._linear = function(x, y, tl, tr, bl, br) {
        var xt = tl * (1 - x) + tr * x;
        var xb = bl * (1 - x) + br * x;

        return xt * (1 - y) + xb * y;
    }

    this._cubic = function(x, y, tl, tr, bl, br) {
        var cubic = function(offset) {
            //console.assert(offset <= 1);
            //console.assert(offset >= 0);

            var result = 3 * (offset * offset) - 2 * (offset * offset * offset);

            //console.assert(result <= 1, result);
            //console.assert(result >= 0, result);
            return result;
        };

        var xt = tl * cubic(1 - x) + tr * cubic(x);
        var xb = bl * cubic(1 - x) + br * cubic(x);

        return xt * cubic(1 - y) + xb * cubic(y);
    };

    this._linear_vector = function(x, y, tl, tr, bl, br) {
        var xy = new Vector(x, y);
        var xt = tl.dot(xy.minus(0, 0)) * (1 - x) + tr.dot(xy.minus(1, 0)) * x;
        var xb = bl.dot(xy.minus(0, 1)) * (1 - x) + br.dot(xy.minus(1, 1)) * x;

        //console.log('Offset: ', x, y);
        //console.log('Minus: ', xy.minus(0, 0).x, xy.minus(0, 0).y);
        //console.log('Top Left: ', tl.x, tl.y);
        //console.log('Dot: ', tl.dot(xy.minus(0, 0)));
        //console.log('Result: ', xt, xb, xt * (1 - y) + xb * y);

        return xt * (1 - y) + xb * y;
    };

    this._cubic_vector = function(x, y, tl, tr, bl, br) {
        var cubic = function(offset) {
            //console.assert(offset <= 1);
            //console.assert(offset >= 0);

            var result = 3 * (offset * offset) - 2 * (offset * offset * offset);

            //console.assert(result <= 1, result);
            //console.assert(result >= 0, result);
            return result;
        };

        var xy = new Vector(x, y);
        var xt = tl.dot(xy.minus(0, 0)) * cubic(1 - x) + tr.dot(xy.minus(1, 0)) * cubic(x);
        var xb = bl.dot(xy.minus(0, 1)) * cubic(1 - x) + br.dot(xy.minus(1, 1)) * cubic(x);

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
    this.interpolateSamples = function(source, pointX, pointY, width, height, interpolator) {
        //console.assert(source.length && source[0].length);
        //console.assert(pointX >= 0 && pointX <= width);
        //console.assert(pointY >= 0 && pointY <= height);

        var sampleRows = source.length;
        var sampleCols = source[0].length;

        var samplesX = pointX / width  * (sampleRows - 1);
        var samplesY = pointY / height * (sampleCols - 1);

        var xFloor = Math.floor(samplesX);
        var yFloor = Math.floor(samplesY);

        var xCeil = Math.ceil(samplesX);
        var yCeil = Math.ceil(samplesY);

        var relativeX = samplesX - xFloor;
        var relativeY = samplesY - yFloor;

        //console.log('Relative: ', relativeX, relativeY);

        var sampleTL = source[yFloor][xFloor];
        var sampleTR = source[yFloor][xCeil];
        var sampleBL = source[yCeil][xFloor];
        var sampleBR = source[yCeil][xCeil];

        //console.log('Samples: ', sampleTL, sampleTR, sampleBL, sampleBR);

        return interpolator(relativeX, relativeY, sampleTL, sampleTR, sampleBL, sampleBR);
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
     * @param {Boolean} linear truthy value to indicate if we should use linear or cubic interoplation
     * @param {Boolean} vector truthy value to indicate if we should use vectors to represnent the samples
     * @param {Boolean} tile truthy value to indicate if we should make this a repeatable pattern
     * @return 2d array of points on the grid
     */
    this.generatePerlinPoints = function(minFrequency, maxFrequency, amplitudeCalc, width, height, linear, vector, tile) {
        var typeGenerator = vector ? this.generateSampleVectors : this.generateSamplePoints;

        if (vector) {
            var interpolator = linear ? this._linear_vector : this._cubic_vector;
        } else {
            var interpolator = linear ? this._linear : this._cubic;
        }

        var samples = [];
        for (var frequency = minFrequency; frequency <= maxFrequency; frequency *= 2) {
            samples.push(typeGenerator(frequency, frequency));
        }

        var points = [];
        for (var y = 0; y < height; y++) {
            var row = Array.apply(null, new Array(width)).map(function() { return 0; }); // initialize zeroed array
            for (var x = 0; x < width; x++) {
                for (var i = 0; i < samples.length; i++) {
                    var sample = samples[i];
                    if (tile) {
                        var value =
                            this.interpolateSamples(sample,         x,          y, width, height, interpolator) * (width - x) * (height - y) +
                            this.interpolateSamples(sample, width - x,          y, width, height, interpolator) * (        x) * (height - y) +
                            this.interpolateSamples(sample, width - x, height - y, width, height, interpolator) * (        x) * (         y) +
                            this.interpolateSamples(sample,         x, height - y, width, height, interpolator) * (width - x) * (         y);
                    } else {
                        var value = this.interpolateSamples(sample, x, y, width, height, interpolator);
                    }

                    row[x] += amplitudeCalc(frequency) * value;
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
