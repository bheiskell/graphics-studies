'use strict';

$(function() {

    /**
     * Initialize the canvas.
     * @param {String} canvas jQuery selector for the canvas object
     * @return initialized WebGL object
     */
    var initGl = function(canvas) {
        // canvas expects width/height attributes
        $(canvas).attr('width', $(canvas).width());
        $(canvas).attr('height', $(window).height());

        try {
            var gl = $(canvas).get(0).getContext('webgl');
        } catch(e) {
            console.log('Could not initialize webgl');
            return null;
        }

        gl.viewportWidth = $(canvas).width();
        gl.viewportHeight = $(canvas).height();

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.enable(gl.DEPTH_TEST);

        gl.depthFunc(gl.LESS);

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        //console.log('Antialiasing:', gl.getParameter(gl.SAMPLES));

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
            console.log(gl.getShaderInfoLog(shader));
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
            console.log(gl.getProgramInfoLog(program));
        }

        gl.useProgram(program);

        program.vertexPositionAttribute = gl.getAttribLocation(program, 'aVertexPosition');
        program.vertexNormalAttribute = gl.getAttribLocation(program, 'aVertexNormal');
        program.vertexColorAttribute    = gl.getAttribLocation(program, 'aVertexColor');
        program.textureCoordAttribute   = gl.getAttribLocation(program, 'aTextureCoord');
        gl.enableVertexAttribArray(program.vertexPositionAttribute);
        gl.enableVertexAttribArray(program.vertexNormalAttribute);
        gl.enableVertexAttribArray(program.vertexColorAttribute);
        gl.enableVertexAttribArray(program.textureCoordAttribute);

        program.perspectiveMatrixUniform = gl.getUniformLocation(program, 'uPerspectiveMatrix');
        program.modelViewMatrixUniform = gl.getUniformLocation(program, 'uModelViewMatrix');
        program.normalMatrixUniform = gl.getUniformLocation(program, 'uNormalMatrix');
        program.samplerUniform = gl.getUniformLocation(program, 'uSampler');
        program.samplerNormalUniform = gl.getUniformLocation(program, 'uSamplerNormal');
        program.useTextureUniform = gl.getUniformLocation(program, 'uUseTexture');
        program.useNormalTextureUniform = gl.getUniformLocation(program, 'uUseNormalTexture');

        program.useLightingUniform = gl.getUniformLocation(program, 'uUseLighting');
        program.ambientColorUniform = gl.getUniformLocation(program, 'uAmbientColor');

        program.useDirectionalLightingUniform = gl.getUniformLocation(program, 'uUseDirectionalLighting');
        program.directionalLightingUniform = gl.getUniformLocation(program, 'uDirectionalLighting');
        program.directionalColorUniform = gl.getUniformLocation(program, 'uDirectionalColor');

        program.usePointLightingUniform = gl.getUniformLocation(program, 'uUsePointLighting');
        program.useSpecularLightingUniform = gl.getUniformLocation(program, 'uUseSpecularLighting');
        program.pointLightingUniform = gl.getUniformLocation(program, 'uPointLighting');
        program.pointDiffuseColorUniform = gl.getUniformLocation(program, 'uPointDiffuseColor');
        program.pointSpecularColorUniform = gl.getUniformLocation(program, 'uPointSpecularColor');

        program.usePerFragmentLighting = gl.getUniformLocation(program, 'uUsePerFragmentLighting');

        program.useBlendingUniform = gl.getUniformLocation(program, 'uUseBlending');
        program.alphaUniform = gl.getUniformLocation(program, 'uAlpha');

        return program;
    }

    /**
     * Get a texture from a URL.
     */
    var getTexture = function(url, magFilter, minFilter) {
        var texture = gl.createTexture();
        texture.image = new Image();
        texture.image.onload = function() {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
            gl.generateMipmap(gl.TEXTURE_2D);

            gl.bindTexture(gl.TEXTURE_2D, null);
        };
        texture.image.src = url;
        return texture;
    };

    /**
     * Push the current modelView matrix onto the stack.
     */
    var pushModelViewMatrix = function() {
        var copy = mat4.create();
        mat4.set(modelViewMatrix, copy);
        modelViewMatrixStack.push(copy);
    };

    /**
     * Pop the previous modelView matrix from the stack.
     */
    var popModelViewMatrix = function() {
        modelViewMatrix = modelViewMatrixStack.pop();
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
    var setMatrixUniforms = function(program, perspectiveMatrix, modelViewMatrix) {
        gl.uniformMatrix4fv(program.perspectiveMatrixUniform, false, perspectiveMatrix);
        gl.uniformMatrix4fv(program.modelViewMatrixUniform, false, modelViewMatrix);
    };

    /**
     * Update the normal uniform. This should only be called with the rotation
     * of the object. Otherwise, the scene rotation will be taken into account,
     * which will make the light appear fixed regardless of scene rotation.
     */
    var setNormalUniform = function(program, modelViewMatrix) {
        var normalMatrix = mat3.create();
        mat4.toInverseMat3(modelViewMatrix, normalMatrix);
        mat3.transpose(normalMatrix);
        gl.uniformMatrix3fv(program.normalMatrixUniform, false, normalMatrix);
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

        var normals = [
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0
        ];
        var normalsBuffer = gl.createBuffer();
        normalsBuffer.itemSize = 3;
        normalsBuffer.numItems = normals.length / normalsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

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
        this.normals   = normalsBuffer;
        this.colors    = colorsBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, modelViewMatrix) {
            var rotationOnly = mat4.create();
            mat4.set(modelViewMatrix, rotationOnly);
            mat4.rotate(rotationOnly, degreesToRadians(this.rotation), [0, 1, 0]);
            setNormalUniform(program, rotationOnly);

            mat4.translate(modelViewMatrix, this.position);
            mat4.rotate(modelViewMatrix, degreesToRadians(this.rotation), [0, 1, 0]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
            gl.vertexAttribPointer(program.vertexNormalAttribute, this.normals.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            gl.uniform1i(program.useTextureUniform, false);

            setMatrixUniforms(program, perspectiveMatrix, modelViewMatrix);
            gl.drawArrays(gl.TRIANGLES, 0, this.positions.numItems);
        };
        this.animate = function(elapsed) {
            this.rotation += (90 * elapsed) / 5000.0;
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

        var normals = [
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0
        ];
        var normalsBuffer = gl.createBuffer();
        normalsBuffer.itemSize = 3;
        normalsBuffer.numItems = normals.length / normalsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

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
        this.normals   = normalsBuffer;
        this.colors    = colorsBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, modelViewMatrix) {
            var rotationOnly = mat4.create();
            mat4.set(modelViewMatrix, rotationOnly);
            mat4.rotate(rotationOnly, degreesToRadians(this.rotation), [1, 0, 0]);
            setNormalUniform(program, rotationOnly);

            mat4.translate(modelViewMatrix, this.position);
            mat4.rotate(modelViewMatrix, degreesToRadians(this.rotation), [1, 0, 0]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
            gl.vertexAttribPointer(program.vertexNormalAttribute, this.normals.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            gl.uniform1i(program.useTextureUniform, false);

            setMatrixUniforms(program, perspectiveMatrix, modelViewMatrix);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.positions.numItems);
        };
        this.animate = function(elapsed) {
            this.rotation += (75 * elapsed) / 5000.0;
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

        var normals = [
            // Front face
             0.0,    0.707,  0.707,
             0.0,    0.707,  0.707,
             0.0,    0.707,  0.707,
            // Right face
             0.707,  0.707,  0.0,
             0.707,  0.707,  0.0,
             0.707,  0.707,  0.0,
            // Back face
             0.0,    0.707, -0.707,
             0.0,    0.707, -0.707,
             0.0,    0.707, -0.707,
            // Left face
            -0.707,  0.707,  0.0,
            -0.707,  0.707,  0.0,
            -0.707,  0.070,  0.0
        ];
        var normalsBuffer = gl.createBuffer();
        normalsBuffer.itemSize = 3;
        normalsBuffer.numItems = normals.length / normalsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

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
        this.normals   = normalsBuffer;
        this.colors    = colorsBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, modelViewMatrix) {
            var rotationOnly = mat4.create();
            mat4.set(modelViewMatrix, rotationOnly);
            mat4.rotate(rotationOnly, degreesToRadians(this.rotation), [0, 1, 0]);
            setNormalUniform(program, rotationOnly);

            mat4.translate(modelViewMatrix, this.position);
            mat4.rotate(modelViewMatrix, degreesToRadians(this.rotation), [0, 1, 0]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
            gl.vertexAttribPointer(program.vertexNormalAttribute, this.normals.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            setMatrixUniforms(program, perspectiveMatrix, modelViewMatrix);
            gl.drawArrays(gl.TRIANGLES, 0, this.positions.numItems);

            gl.uniform1i(program.useTextureUniform, false);

            setMatrixUniforms(program, perspectiveMatrix, modelViewMatrix);
        };
        this.animate = function(elapsed) {
            this.rotation += (90 * elapsed) / 5000.0;
        };
    };

    /**
     * Create a cube.
     */
    var Cube = function(position, textureArray, normalTexture) {
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

        var normals = [
            // Front face
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,

            // Back face
             0.0,  0.0, -1.0,
             0.0,  0.0, -1.0,
             0.0,  0.0, -1.0,
             0.0,  0.0, -1.0,

            // Top face
             0.0,  1.0,  0.0,
             0.0,  1.0,  0.0,
             0.0,  1.0,  0.0,
             0.0,  1.0,  0.0,

            // Bottom face
             0.0, -1.0,  0.0,
             0.0, -1.0,  0.0,
             0.0, -1.0,  0.0,
             0.0, -1.0,  0.0,

            // Right face
             1.0,  0.0,  0.0,
             1.0,  0.0,  0.0,
             1.0,  0.0,  0.0,
             1.0,  0.0,  0.0,

            // Left face
            -1.0,  0.0,  0.0,
            -1.0,  0.0,  0.0,
            -1.0,  0.0,  0.0,
            -1.0,  0.0,  0.0,
        ];
        var normalsBuffer = gl.createBuffer();
        normalsBuffer.itemSize = 3;
        normalsBuffer.numItems = normals.length / normalsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

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
        this.texture   = 0;
        this.indexes   = indexesBuffer;
        this.positions = positionsBuffer;
        this.normals   = normalsBuffer;
        this.colors    = colorsBuffer;
        this.textures  = texturesBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, modelViewMatrix) {
            var rotationOnly = mat4.create();
            mat4.set(modelViewMatrix, rotationOnly);
            mat4.rotate(rotationOnly, degreesToRadians(this.rotation), [1, 1, 1]);
            setNormalUniform(program, rotationOnly);

            mat4.translate(modelViewMatrix, this.position);
            mat4.rotate(modelViewMatrix, degreesToRadians(this.rotation), [1, 1, 1]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
            gl.vertexAttribPointer(program.vertexNormalAttribute, this.normals.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.textures);
            gl.vertexAttribPointer(program.textureCoordAttribute, this.textures.itemSize, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textureArray !== undefined ? textureArray[this.texture] : null);
            gl.uniform1i(program.samplerUniform, 0);
            gl.uniform1i(program.useTextureUniform, textureArray !== undefined);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, normalTexture);
            gl.uniform1i(program.samplerNormalUniform, 1);
            gl.uniform1i(program.useNormalTextureUniform, normalTexture !== undefined);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexes);

            setMatrixUniforms(program, perspectiveMatrix, modelViewMatrix);

            gl.drawElements(gl.TRIANGLES, this.indexes.numItems, gl.UNSIGNED_SHORT, 0);
        };
        this.animate = function(elapsed) {
            this.rotation += (90 * elapsed) / 5000.0;
        };
        this.keypress = function(type, input) {
            if (input === 'U') {
                this.texture = (this.texture + 1) % 3;
            }
        };
    };

    /**
     * Create a star.
     */
    var Star = function(position, texture) {
        var positions = [
            -1.0,  1.0,  0.0,
             1.0,  1.0,  0.0,
             1.0, -1.0,  0.0,
            -1.0, -1.0,  0.0
        ];
        var positionsBuffer = gl.createBuffer();
        positionsBuffer.itemSize = 3;
        positionsBuffer.numItems = positions.length / positionsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        var normals = [
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0
        ];
        var normalsBuffer = gl.createBuffer();
        normalsBuffer.itemSize = 3;
        normalsBuffer.numItems = normals.length / normalsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        var colors = [
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0
        ];

        var colorsBuffer = gl.createBuffer();
        colorsBuffer.itemSize = 4;
        colorsBuffer.numItems = colors.length / colorsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        var textures = [
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0
        ];

        var texturesBuffer = gl.createBuffer();
        texturesBuffer.itemSize = 2;
        texturesBuffer.numItems = textures.length / texturesBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, texturesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textures), gl.STATIC_DRAW);

        var indexes = [
            0, 1, 2,      0, 2, 3,
        ];
        var indexesBuffer = gl.createBuffer();
        indexesBuffer.itemSize = 1;
        indexesBuffer.numItems = indexes.length / indexesBuffer.itemSize;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexes), gl.STATIC_DRAW);

        this.position  = position;
        this.texture   = 0;
        this.indexes   = indexesBuffer;
        this.positions = positionsBuffer;
        this.normals   = normalsBuffer;
        this.colors    = colorsBuffer;
        this.textures  = texturesBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, modelViewMatrix) {
            var rotationOnly = mat4.create();
            mat4.set(modelViewMatrix, rotationOnly);
            mat4.rotate(rotationOnly, degreesToRadians(this.rotation), [0, 0, 1]);
            setNormalUniform(program, rotationOnly);

            mat4.translate(modelViewMatrix, this.position);
            mat4.rotate(modelViewMatrix, degreesToRadians(this.rotation), [0, 0, 1]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
            gl.vertexAttribPointer(program.vertexNormalAttribute, this.normals.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.textures);
            gl.vertexAttribPointer(program.textureCoordAttribute, this.textures.itemSize, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(program.samplerUniform, 0);
            gl.uniform1i(program.useTextureUniform, texture !== undefined);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexes);

            setMatrixUniforms(program, perspectiveMatrix, modelViewMatrix);

            gl.drawElements(gl.TRIANGLES, this.indexes.numItems, gl.UNSIGNED_SHORT, 0);
        };
        this.animate = function(elapsed) {
            this.rotation += (90 * elapsed) / 5000.0;
            this.position = [ Math.sin(this.rotation / 100.0), Math.cos(this.rotation / 100.0), this.position[2] ];
        };
    };

    /**
     * Create a sphere.
     */
    var Sphere = function(position, texture) {
        var positions = [
        ];
        var normals = [
        ];
        var colors = [
        ];
        var textures = [
        ];
        var indexes = [
        ];

        var latitudes = 30;  // north / south
        var longitudes = 30; // east / west

        var i = 0;
        for (var longitude = 0; longitude <= longitudes; longitude++) {
            for (var latitude = 0; latitude <= latitudes; latitude++) {

                var longRatio = longitude / longitudes;
                var latRatio  = latitude  / latitudes;

                var longRadian = Math.PI * longRatio * 2;
                var latRadian  = Math.PI * latRatio - Math.PI / 2;

                var vector = [
                    Math.cos(latRadian) * Math.cos(longRadian),
                    Math.sin(latRadian),
                    Math.cos(latRadian) * Math.sin(longRadian),
                ];

                positions.push.apply(positions, vector);
                normals  .push.apply(normals,   vector);

                colors  .push.apply(colors,   [ longRatio, latRatio, 1.0, 1.0 ]);
                textures.push.apply(textures, [ longRatio, latRatio ]);
            }
        }
        for (var longitude = 0; longitude < longitudes; longitude++) {
            for (var latitude = 0; latitude < latitudes; latitude++) {
                var curr = (longitude * (latitudes + 1)) + latitude;
                var next = (curr + latitudes + 1) % ((longitudes + 1) * (latitudes + 1));

                indexes.push.apply(indexes, [curr, curr + 1, next]);
                indexes.push.apply(indexes, [curr + 1, next + 1, next]);

            }
        }

        var positionsBuffer = gl.createBuffer();
        positionsBuffer.itemSize = 3;
        positionsBuffer.numItems = positions.length / positionsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        var normalsBuffer = gl.createBuffer();
        normalsBuffer.itemSize = 3;
        normalsBuffer.numItems = normals.length / normalsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        var colorsBuffer = gl.createBuffer();
        colorsBuffer.itemSize = 4;
        colorsBuffer.numItems = colors.length / colorsBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        var texturesBuffer = gl.createBuffer();
        texturesBuffer.itemSize = 2;
        texturesBuffer.numItems = textures.length / texturesBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, texturesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textures), gl.STATIC_DRAW);

        var indexesBuffer = gl.createBuffer();
        indexesBuffer.itemSize = 1;
        indexesBuffer.numItems = indexes.length / indexesBuffer.itemSize;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexes), gl.STATIC_DRAW);

        this.position  = position;
        this.indexes   = indexesBuffer;
        this.positions = positionsBuffer;
        this.normals   = normalsBuffer;
        this.colors    = colorsBuffer;
        this.textures  = texturesBuffer;
        this.rotation  = 0;

        this.draw = function(program, perspectiveMatrix, modelViewMatrix) {
            var rotationOnly = mat4.create();
            mat4.set(modelViewMatrix, rotationOnly);
            mat4.rotate(rotationOnly, degreesToRadians(this.rotation), [0, 1, 0]);
            setNormalUniform(program, rotationOnly);

            mat4.translate(modelViewMatrix, this.position);
            mat4.rotate(modelViewMatrix, degreesToRadians(this.rotation), [0, 1, 0]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
            gl.vertexAttribPointer(program.vertexPositionAttribute, this.positions.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
            gl.vertexAttribPointer(program.vertexNormalAttribute, this.normals.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
            gl.vertexAttribPointer(program.vertexColorAttribute, this.colors.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.textures);
            gl.vertexAttribPointer(program.textureCoordAttribute, this.textures.itemSize, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(program.samplerUniform, 0);
            gl.uniform1i(program.useTextureUniform, texture !== undefined);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexes);

            setMatrixUniforms(program, perspectiveMatrix, modelViewMatrix);

            gl.drawElements(gl.TRIANGLES, this.indexes.numItems, gl.UNSIGNED_SHORT, 0);
        };
        this.animate = function(elapsed) {
            this.rotation += (90 * elapsed) / 5000.0;
        };
    };

    /**
     * Draw the scene.
     */
    var drawScene = function(scene, settings) {
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        var viewAngle = 45;
        var aspectRatio = gl.viewportWidth / gl.viewportHeight;
        var viewDistanceMin = 0.1;
        var viewDistanceMax = 100.0;

        gl.uniform1i(program.useLightingUniform, settings.useLighting);
        gl.uniform1i(program.useDirectionalLightingUniform, settings.useDirectionalLighting);
        gl.uniform1i(program.usePointLightingUniform, settings.usePointLighting);
        gl.uniform1i(program.useSpecularLightingUniform, settings.useSpecularLighting);

        gl.uniform1i(program.useBlendingUniform, settings.useBlending);
        gl.uniform1i(program.usePerFragmentLighting, settings.usePerFragmentLighting);
        gl.uniform1f(program.alphaUniform, settings.alpha);

        lights.forEach(function(light, index) {
            var lightColor = vec3.create();
            vec3.set([settings[light.color + 'R'], settings[light.color + 'G'], settings[light.color + 'B']], lightColor);
            gl.uniform3fv(program[light.uniform], lightColor);

            if (settings.useBlending) {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                gl.disable(gl.DEPTH_TEST);
            } else {
                if (index == 0) {
                    gl.disable(gl.BLEND);
                    gl.depthFunc(gl.LESS);
                    // we don't need to turn off depth because we later use EQUAL - leaving as a reminder
                    //gl.depthMask(true);
                } else {
                    if (!settings.useLighting) {
                        // so hack. if we're on the second loop and we're not using lighting, skip
                        return;
                    }
                    gl.enable(gl.BLEND);
                    gl.depthFunc(gl.EQUAL);
                    //gl.depthMask(false);
                }
                gl.blendFunc(gl.ONE, gl.ONE);
                gl.enable(gl.DEPTH_TEST);
            }

            mat4.perspective(viewAngle, aspectRatio, viewDistanceMin, viewDistanceMax, perspectiveMatrix);
            mat4.identity(modelViewMatrix);

            pushModelViewMatrix();

            mat4.rotate(modelViewMatrix, degreesToRadians(-scene.pitch), [1, 0, 0]);
            mat4.rotate(modelViewMatrix, degreesToRadians(-scene.yaw), [0, 1, 0]);
            mat4.rotate(modelViewMatrix, degreesToRadians(-scene.roll), [0, 0, 1]);

            mat4.translate(modelViewMatrix, [-scene.x, -scene.y, -scene.z]);

            var cameraRotation = mat4.create();
            mat4.identity(cameraRotation);
            mat4.rotate(cameraRotation, degreesToRadians(-scene.pitch), [1, 0, 0]);
            mat4.rotate(cameraRotation, degreesToRadians(-scene.yaw), [0, 1, 0]);
            mat4.rotate(cameraRotation, degreesToRadians(-scene.roll), [0, 0, 1]);

            var directionalLighting = vec3.create();
            mat4.multiplyVec3(cameraRotation, [settings.directionalX, settings.directionalY, settings.directionalZ], directionalLighting);
            vec3.normalize(directionalLighting);
            vec3.scale(directionalLighting, -1); // normal calculation is with the inverted value of the light's direction
            gl.uniform3fv(program.directionalLightingUniform, directionalLighting);

            var pointLighting = vec3.create();
            mat4.multiplyVec3(modelViewMatrix, [settings.pointX, settings.pointY, settings.pointZ], pointLighting);
            gl.uniform3fv(program.pointLightingUniform, pointLighting);

            objects.forEach(function(object) {
                pushModelViewMatrix();
                object.draw(program, perspectiveMatrix, modelViewMatrix);
                popModelViewMatrix();
            });

            popModelViewMatrix();

            vec3.normalize([0.0, 0.0, 0.0, 0.0], lightColor);
            gl.uniform3fv(program[light.uniform], lightColor);
        });

        gl.uniform1i(program.useLightingUniform, false);
        gl.uniform1i(program.useBlendingUniform, true);
        gl.uniform1f(program.alphaUniform, 1.0);

        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);

        alphaObjects.forEach(function(object) {
            pushModelViewMatrix();
            object.draw(program, perspectiveMatrix, modelViewMatrix);
            popModelViewMatrix();
        });

    };

    var prevTime = new Date().getTime();
    var framesCount = 0;
    var framesTime = 0;

    var round2 = function(num) { return Math.round(100 * num) / 100; }

    /**
     * Animate the scene.
     */
    var animate = function(scene, settings, currentKeys) {
        var newTime = new Date().getTime();
        var elapsed = newTime - prevTime;

        objects.forEach(function(object) {
            if (settings.animate) {
                object.animate(elapsed);
            }
        });

        alphaObjects.forEach(function(object) {
            if (settings.animate) {
                object.animate(elapsed);
            }
        });

        framesCount++;
        framesTime += elapsed;
        if (framesTime > 1000) {
            $('#fps-counter').text('' +
                round2(1000 * framesCount / framesTime) + ' (' +
                round2(scene.x) + ', ' +
                round2(scene.y) + ', ' +
                round2(scene.z) + ') (' +
                round2(scene.pitch) + ', ' +
                round2(scene.yaw) + ')' +
                '');
            framesCount = 0;
            framesTime = 0;
        }

        if (currentKeys[32]) { // up
            scene.y += 0.01 * elapsed;
        } else if (currentKeys[16]) { // down
            scene.y -= 0.01 * elapsed;
        }

        if (currentKeys[33]) { // lookup
            scene.pitch += 0.1 * elapsed;
        } else if (currentKeys[34]) { // lookdown
            scene.pitch -= 0.1 * elapsed;
        }

        if (currentKeys[222]) { // turn left
            scene.yaw += 0.1 * elapsed;
        } else if (currentKeys[190]) { // turn right
            scene.yaw -= 0.1 * elapsed;
        }

        var speed = 0;
        if (currentKeys[188]) { // forward
            speed = 1;
        } else if (currentKeys[79]) { // backwards
            speed = -1;
        }

        var strafeSpeed = 0;
        if (currentKeys[65]) { // left
            strafeSpeed = 1;
        } else if (currentKeys[69]) { // right
            strafeSpeed = -1;
        }

        scene.x -= 0.01 * elapsed * Math.sin(degreesToRadians(scene.yaw)) * speed;
        scene.z -= 0.01 * elapsed * Math.cos(degreesToRadians(scene.yaw)) * speed;

        scene.x -= 0.01 * elapsed * Math.sin(degreesToRadians(scene.yaw + 90)) * strafeSpeed;
        scene.z -= 0.01 * elapsed * Math.cos(degreesToRadians(scene.yaw + 90)) * strafeSpeed;

        prevTime = newTime;

        // Move camera around the origin in a circle
        //settings.pointX = 10 * Math.cos(prevTime/1000);
        //settings.pointZ = 10 * Math.sin(prevTime/1000);
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

        drawScene(scene, settings);
        animate(scene, settings, currentKeys);
    };

    var currentKeys = {};

    /**
     * Dispatch input events to object event handlers.
     * @param {Object} event the event to handle
     */
    var handleInput = function(type, event) {
        if (type === 'down' && currentKeys[event.keyCode] === true) {
            return;
        }

        objects.forEach(function(object) {
            if (object.keypress) {
                object.keypress(type, String.fromCharCode(event.keyCode));
            }
        });

        currentKeys[event.keyCode] = type === 'down';
    };

    var mouseDown = false;
    var lastX = -1;
    var lastY = -1;

    /**
     * Mouse event handler.
     */
    var handleMouse = function(type, event) {
        if (!mouseDown || type != 'move') {
            mouseDown = type == 'down';

            if (mouseDown) {
                canvas.requestPointerLock =
                    canvas.requestPointerLock ||
                    canvas.mozRequestPointerLock ||
                    canvas.webkitRequestPointerLock;
                canvas.requestPointerLock();
            } else {
                document.exitPointerLock=
                    document.exitPointerLock ||
                    document.mozExitPointerLock ||
                    document.webkitExitPointerLock;
                document.exitPointerLock();
                lastX = -1;
                lastY = -1;
            }
            return;
        }

        var x = event.originalEvent.movementX
             || event.originalEvent.mozMovementX
             || event.originalEvent.webkitMovementX
             || (event.pageX - lastX);
        var y = event.originalEvent.movementY
             || event.originalEvent.mozMovementY
             || event.originalEvent.webkitMovementY
             || (event.pageY - lastY);

        if (lastX != -1 && lastY !== -1) {
            scene.pitch -= y / 5;
            scene.yaw -= x / 5;
        }

        lastX = event.pageX;
        lastY = event.pageY;
    };

    var gl = initGl('#canvas');
    var vertexShader   = getShaderGlsl('#2d-shader-vertex');
    var fragmentShader = getShaderGlsl('#2d-shader-fragment');
    var program = initShaders(vertexShader, fragmentShader);

    var perspectiveMatrix = mat4.create();
    var modelViewMatrix = mat4.create();
    var modelViewMatrixStack = [];

    var scene = {
        x:   0.0,
        y:   0.0,
        z:  10.0,

        pitch: 0.0,
        yaw: 0.0,
        roll: 0.0,
    };

    var crateTextures = [
        getTexture('crate.gif', gl.LINEAR,  gl.LINEAR_MIPMAP_NEAREST),
        getTexture('crate.gif', gl.NEAREST, gl.NEAREST),
        getTexture('crate.gif', gl.LINEAR,  gl.LINEAR)
    ];
    var starTexture = getTexture('star.gif', gl.LINEAR,  gl.LINEAR_MIPMAP_NEAREST);
    var moonTexture = getTexture('moon.gif', gl.LINEAR,  gl.LINEAR_MIPMAP_NEAREST);
    var clothTexture = getTexture('cloth.png', gl.LINEAR,  gl.LINEAR_MIPMAP_NEAREST)
    var clothNormal = getTexture('cloth_normal.png', gl.LINEAR,  gl.LINEAR_MIPMAP_NEAREST)

    var objects = [
        new Cube(    [-4.5, -1.5, 0.0], crateTextures),
        new Triangle([-1.5,  1.5, 0.0]),
        new Square(  [ 1.5,  1.5, 0.0]),
        new Pyramid( [-1.5, -1.5, 0.0]),
        new Cube(    [ 4.5, -1.5, 0.0]),
        new Sphere(  [ 1.5, -1.5, 0.0], moonTexture),
        new Cube(    [-4.5,  1.5, 0.0], [clothTexture], clothNormal),
        new Cube(    [-7.5,  1.5, 0.0], [clothTexture])
    ];

    var lights = [
        {
            uniform: 'directionalColorUniform',
            color: 'directional',
        },
        {
            uniform: 'ambientColorUniform',
            color: 'ambient',
        },
        {
            uniform: 'pointDiffuseColorUniform',
            color: 'diffuse',
        },
        {
            uniform: 'pointSpecularColorUniform',
            color: 'specular',
        },
    ];

    var alphaObjects = [
        new Star([0.0, 0.0, -25.0], starTexture)
    ];

    $(document).keydown(function(e) { handleInput('down', e); });
    $(document).keyup(function(e)   { handleInput('up', e); });
    $('#canvas').mousedown(function(e)  { handleMouse('down', e); });
    $('#canvas').mouseup(function(e)    { handleMouse('up', e); });
    $('#canvas').mouseleave(function(e) { handleMouse('up', e); });
    $('#canvas').mousemove(function(e)  { handleMouse('move', e); });
    $('#canvas').on('pointerlockchange', function(e)  { handleMouse('move', e); });
    $('#canvas').on('mozpointerlockchange', function(e)  { handleMouse('move', e); });
    $('#canvas').on('webkitpointerlockchange', function(e)  { handleMouse('move', e); });

    tick();
});
