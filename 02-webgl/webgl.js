'use strict';

$(function() {

    /**
     * Initialize the canvas.
     * @param {String} canvas jQuery selector for the canvas object
     * @return initialized WebGL object
     */
    var initGl = function(canvas) {
        // canvas expects width/height attributes
        $(canvas).attr('width', $(window).width());
        $(canvas).attr('height', $(window).height());

        try {
            var gl = $(canvas).get(0).getContext('experimental-webgl');
        } catch(e) {
            console.log('Could not initialize webgl');
            return null;
        }

        gl.viewportWidth = $(canvas).width();
        gl.viewportHeight = $(canvas).height();

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.enable(gl.DEPTH_TEST);

        return gl;
    }

    /**
     * Create a shader from the text content of a script tag. The script tag
     * must have a type attribute containing either: x-shader/x-vertex or
     * x-shader/x-fragment.
     * @param {String} selector script tag selector for the glsl code
     */
    var getShaderGlsl = function(selector) {
        var definition = $(selector).text();
        var type = $(selector).attr('type');

        var shader;
        if (type === 'x-shader/x-vertex') {
            shader = gl.createShader(gl.VERTEX_SHADER);

        } else if (type === 'x-shader/x-fragment') {
            shader = gl.createShader(gl.FRAGMENT_SHADER);

        } else {
            console.log('Unsupported shader type');
            return null;
        }

        gl.shaderSource(shader, definition);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.log('Unable to compile shader: ', selector, definition);
            return null;
        }

        return shader;
    };

    /**
     * Create a program and attach the vertex and fragment shaders to it.
     * Shader variables are attached to the program.
     * @param {Object} vertexShader the vertex shader
     * @param {Object} fragmentShader the fragment shader
     * @return the initialized program
     */
    var initShaders = function(vertexShader, fragmentShader) {
        var program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.log('Unable to initialize shaders');
        }

        gl.useProgram(program);

        program.vertexPositionAttribute = gl.getAttribLocation(program, 'aVertexPosition');
        program.vertexColorAttribute = gl.getAttribLocation(program, 'aVertexColor');
        program.textureCoordAttribute = gl.getAttribLocation(program, 'aTextureCoord');
        gl.enableVertexAttribArray(program.vertexPositionAttribute);
        gl.enableVertexAttribArray(program.vertexColorAttribute);
        gl.enableVertexAttribArray(program.textureCoordAttribute);

        program.perspectiveMatrixUniform = gl.getUniformLocation(program, 'uPerspectiveMatrix');
        program.movementMatrixUniform = gl.getUniformLocation(program, 'uMovementMatrix');
        program.samplerUniform = gl.getUniformLocation(program, 'uSampler');
        program.useTextureUniform = gl.getUniformLocation(program, 'uUseTexture');

        return program;
    }

    /**
     * Get a texture from a URL.
     */
    var getTexture = function(url) {
        var texture = gl.createTexture();
        texture.image = new Image();
        texture.image.onload = function() {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.bindTexture(gl.TEXTURE_2D, null);
        };
        texture.image.src = url;
        return texture;
    };

    /**
     * Push the current movement matrix onto the stack.
     */
    var pushMovementMatrix = function() {
        var copy = mat4.create();
        mat4.set(movementMatrix, copy);
        movementMatrixStack.push(copy);
    };

    /**
     * Pop the previous movement matrix from the stack.
     */
    var popMovementMatrix = function() {
        movementMatrix = movementMatrixStack.pop();
    };

    /**
     * Convert from degrees to radians.
     * @param {Float} degrees the degrees
     * @return {Float} the radians
     */
    var degreesToRadians = function(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Update the buffered position and perspective matrix uniforms.
     */
    var setMatrixUniforms = function(program, perspectiveMatrix, movementMatrix) {
        gl.uniformMatrix4fv(program.perspectiveMatrixUniform, false, perspectiveMatrix);
        gl.uniformMatrix4fv(program.movementMatrixUniform, false, movementMatrix);
    };

    /**
     * Create a triangle.
     */
    var Triangle = function(position) {
        var positions = [
             0.0,  1.0,  0.0,
            -1.0, -1.0,  0.0,
             1.0, -1.0,  0.0,
        ];
        var positionsBuffer = gl.createBuffer();
        positionsBuffer.itemSize = 3;
        positionsBuffer.numItems = positions.length / positionsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        var colors = [
             1.0,  0.0,  0.0, 1.0,
             0.0,  1.0,  0.0, 1.0,
             0.0,  0.0,  1.0, 1.0
        ];
        var colorsBuffer = gl.createBuffer();
        colorsBuffer.itemSize = 4;
        colorsBuffer.numItems = colors.length / colorsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        this.position  = position;
        this.positions = positionsBuffer;
        this.colors    = colorsBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, movementMatrix) {
            mat4.translate(movementMatrix, this.position);
            mat4.rotate(movementMatrix, degreesToRadians(this.rotation), [0, 1, 0]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            gl.uniform1i(program.useTextureUniform, false);

            setMatrixUniforms(program, perspectiveMatrix, movementMatrix);
            gl.drawArrays(gl.TRIANGLES, 0, this.positions.numItems);
        };
        this.animate = function(elapsed) {
            this.rotation += (90 * elapsed) / 1000.0;
        };
    };

    /**
     * Create a square.
     */
    var Square = function(position) {
        var positions = [
             1.0,  1.0,  0.0,
            -1.0,  1.0,  0.0,
             1.0, -1.0,  0.0,
            -1.0, -1.0,  0.0
        ];

        var positionsBuffer = gl.createBuffer();
        positionsBuffer.itemSize = 3;
        positionsBuffer.numItems = positions.length / positionsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        var colors = [
             0.5,  0.5,  1.0, 1.0,
             0.5,  0.5,  1.0, 1.0,
             0.5,  0.5,  1.0, 1.0,
             0.5,  0.5,  1.0, 1.0
        ];
        var colorsBuffer = gl.createBuffer();
        colorsBuffer.itemSize = 4;
        colorsBuffer.numItems = colors.length / colorsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        this.position  = position;
        this.positions = positionsBuffer;
        this.colors    = colorsBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, movementMatrix) {
            mat4.translate(movementMatrix, this.position);
            mat4.rotate(movementMatrix, degreesToRadians(this.rotation), [1, 0, 0]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            gl.uniform1i(program.useTextureUniform, false);

            setMatrixUniforms(program, perspectiveMatrix, movementMatrix);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.positions.numItems);
        };
        this.animate = function(elapsed) {
            this.rotation += (75 * elapsed) / 1000.0;
        };
    };

    /**
     * Create a pyramid.
     */
    var Pyramid = function(position) {
        var positions = [
            // Front face
             0.0,  1.0,  0.0,
            -1.0, -1.0,  1.0,
             1.0, -1.0,  1.0,
            // Right face
             0.0,  1.0,  0.0,
             1.0, -1.0,  1.0,
             1.0, -1.0, -1.0,
            // Back face
             0.0,  1.0,  0.0,
             1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            // Left face
             0.0,  1.0,  0.0,
            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0
        ];
        var positionsBuffer = gl.createBuffer();
        positionsBuffer.itemSize = 3;
        positionsBuffer.numItems = positions.length / positionsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        var colors = [
            // Front face
            1.0, 0.0, 0.0, 1.0,
            0.0, 1.0, 0.0, 1.0,
            0.0, 0.0, 1.0, 1.0,
            // Right face
            1.0, 0.0, 0.0, 1.0,
            0.0, 0.0, 1.0, 1.0,
            0.0, 1.0, 0.0, 1.0,
            // Back face
            1.0, 0.0, 0.0, 1.0,
            0.0, 1.0, 0.0, 1.0,
            0.0, 0.0, 1.0, 1.0,
            // Left face
            1.0, 0.0, 0.0, 1.0,
            0.0, 0.0, 1.0, 1.0,
            0.0, 1.0, 0.0, 1.0
        ];
        var colorsBuffer = gl.createBuffer();
        colorsBuffer.itemSize = 4;
        colorsBuffer.numItems = colors.length / colorsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        this.position  = position;
        this.positions = positionsBuffer;
        this.colors    = colorsBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, movementMatrix) {
            mat4.translate(movementMatrix, this.position);
            mat4.rotate(movementMatrix, degreesToRadians(this.rotation), [0, 1, 0]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            setMatrixUniforms(program, perspectiveMatrix, movementMatrix);
            gl.drawArrays(gl.TRIANGLES, 0, this.positions.numItems);

            gl.uniform1i(program.useTextureUniform, false);

            setMatrixUniforms(program, perspectiveMatrix, movementMatrix);
        };
        this.animate = function(elapsed) {
            this.rotation += (90 * elapsed) / 1000.0;
        };
    };

    /**
     * Create a cube.
     */
    var Cube = function(position, texture) {
        var positions = [
            // Front face
            -1.0, -1.0,  1.0,
             1.0, -1.0,  1.0,
             1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,

            // Back face
            -1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,
             1.0,  1.0, -1.0,
             1.0, -1.0, -1.0,

            // Top face
            -1.0,  1.0, -1.0,
            -1.0,  1.0,  1.0,
             1.0,  1.0,  1.0,
             1.0,  1.0, -1.0,

            // Bottom face
            -1.0, -1.0, -1.0,
             1.0, -1.0, -1.0,
             1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,

            // Right face
             1.0, -1.0, -1.0,
             1.0,  1.0, -1.0,
             1.0,  1.0,  1.0,
             1.0, -1.0,  1.0,

            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0, -1.0,
        ];
        var positionsBuffer = gl.createBuffer();
        positionsBuffer.itemSize = 3;
        positionsBuffer.numItems = positions.length / positionsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        var packedColors = [
            [1.0, 0.0, 0.0, 1.0], // Front face
            [1.0, 1.0, 0.0, 1.0], // Back face
            [0.0, 1.0, 0.0, 1.0], // Top face
            [1.0, 0.5, 0.5, 1.0], // Bottom face
            [1.0, 0.0, 1.0, 1.0], // Right face
            [0.0, 0.0, 1.0, 1.0], // Left face
        ];
        // create color, one for each vertex
        var colors = packedColors.map(function(color) {
            return [].concat(color)
                     .concat(color)
                     .concat(color)
                     .concat(color);
        }).reduce(function(memo, color) {
            return memo.concat(color);;
        });

        var colorsBuffer = gl.createBuffer();
        colorsBuffer.itemSize = 4;
        colorsBuffer.numItems = colors.length / colorsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        var textures = [
            // Front face
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,

            // Back face
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,
            0.0, 0.0,

            // Top face
            0.0, 1.0,
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,

            // Bottom face
            1.0, 1.0,
            0.0, 1.0,
            0.0, 0.0,
            1.0, 0.0,

            // Right face
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,
            0.0, 0.0,

            // Left face
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,
        ];

        var texturesBuffer = gl.createBuffer();
        texturesBuffer.itemSize = 2;
        texturesBuffer.numItems = textures.length / texturesBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, texturesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textures), gl.STATIC_DRAW);

        var indexes = [
            0, 1, 2,      0, 2, 3,    // Front face
            4, 5, 6,      4, 6, 7,    // Back face
            8, 9, 10,     8, 10, 11,  // Top face
            12, 13, 14,   12, 14, 15, // Bottom face
            16, 17, 18,   16, 18, 19, // Right face
            20, 21, 22,   20, 22, 23  // Left face
        ];
        var indexesBuffer = gl.createBuffer();
        indexesBuffer.itemSize = 1;
        indexesBuffer.numItems = indexes.length / indexesBuffer.itemSize;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexes), gl.STATIC_DRAW);

        this.position  = position;
        this.texture   = texture;
        this.indexes   = indexesBuffer;
        this.positions = positionsBuffer;
        this.colors    = colorsBuffer;
        this.textures  = texturesBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, movementMatrix) {
            mat4.translate(movementMatrix, this.position);
            mat4.rotate(movementMatrix, degreesToRadians(this.rotation), [1, 1, 1]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.textures);
            gl.vertexAttribPointer(program.textureCoordAttribute, this.textures.itemSize, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(program.samplerUniform, 0);
            gl.uniform1i(program.useTextureUniform, this.texture !== undefined);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexes);

            setMatrixUniforms(program, perspectiveMatrix, movementMatrix);

            gl.drawElements(gl.TRIANGLES, this.indexes.numItems, gl.UNSIGNED_SHORT, 0);
        };
        this.animate = function(elapsed) {
            this.rotation += (90 * elapsed) / 1000.0;
        };
    };

    /**
     * Draw the scene.
     */
    var drawScene = function() {
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        var viewAngle = 45;
        var aspectRatio = gl.viewportWidth / gl.viewportHeight;
        var viewDistanceMin = 0.1;
        var viewDistanceMax = 100.0;

        mat4.perspective(viewAngle, aspectRatio, viewDistanceMin, viewDistanceMax, perspectiveMatrix);
        mat4.identity(movementMatrix);

        objects.forEach(function(object) {
            pushMovementMatrix();
            object.draw(program, perspectiveMatrix, movementMatrix);
            popMovementMatrix();
        });
    };

    var prevTime = new Date().getTime();
    var framesCount = 0;
    var framesTime = 0;

    /**
     * Animate the scene.
     */
    var animate = function() {
        var newTime = new Date().getTime();
        var elapsed = newTime - prevTime;

        objects.forEach(function(object) {
            object.animate(elapsed);
        });

        framesCount++;
        framesTime += elapsed;
        if (framesTime > 1000) {
            $('#fps-counter').text(Math.round( 10000 * framesCount / framesTime) / 10);
            framesCount = 0;
            framesTime = 0;
        }

        prevTime = newTime;
    };

    /**
     * Browser independent function used to request that the browser run the
     * provided callback when it next can. If the tab is out of focus, this
     * should prevent needless utilization of the GPU.
     * @param {function} callback the callback to execute
     */
    var requestAnimFrame = function(callback) {
        window.requestAnimationFrame(callback)
            || window.webkitRequestAnimationFrame(callback)
            || window.mozRequestAnimationFrame(callback)
            || window.oRequestAnimationFrame(callback)
            || window.msRequestAnimationFrame(callback)
            || function(callback) { window.setTimeout(callback, 1000 / 60); };
    }

    /**
     * Draw the scene and execute the animate function. Additionally requeue
     * this function for execution.
     */
    var tick = function() {
        requestAnimFrame(tick);

        drawScene();
        animate();
    };

    var gl = initGl('#canvas');
    var vertexShader   = getShaderGlsl('#2d-shader-vertex');
    var fragmentShader = getShaderGlsl('#2d-shader-fragment');
    var program = initShaders(vertexShader, fragmentShader);

    var perspectiveMatrix = mat4.create();
    var movementMatrix = mat4.create();
    var movementMatrixStack = [];

    var crate = getTexture('crate.gif');

    var objects = [
        new Cube(    [-4.5, -1.5, -10.0], crate),
        new Triangle([-1.5,  1.5, -10.0]),
        new Square(  [ 1.5,  1.5, -10.0]),
        new Pyramid( [-1.5, -1.5, -10.0]),
        new Cube(    [ 1.5, -1.5, -10.0])
    ];

    tick();
});
