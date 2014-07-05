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
        gl.enableVertexAttribArray(program.vertexPositionAttribute);
        gl.enableVertexAttribArray(program.vertexColorAttribute);

        program.perspectiveMatrixUniform = gl.getUniformLocation(program, 'uPerspectiveMatrix');
        program.movementMatrixUniform = gl.getUniformLocation(program, 'uMovementMatrix');

        return program;
    }

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
    var setMatrixUniforms = function() {
        gl.uniformMatrix4fv(program.perspectiveMatrixUniform, false, perspectiveMatrix);
        gl.uniformMatrix4fv(program.movementMatrixUniform, false, movementMatrix);
    };

    /**
     * Create a triangles vertices.
     */
    var createTriangleVertices = function() {
        var vertices = [
             0.0,  1.0,  0.0,
            -1.0, -1.0,  0.0,
             1.0, -1.0,  0.0,
        ];
        var vertexBuffer = gl.createBuffer();
        vertexBuffer.itemSize = 3;
        vertexBuffer.numItems = vertices.length / vertexBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        return vertexBuffer;
    };

    /**
     * Create a triangles color vertices.
     */
    var createTriangleColorVertices = function() {
        var vertices = [
             1.0,  0.0,  0.0, 1.0,
             0.0,  1.0,  0.0, 1.0,
             0.0,  0.0,  1.0, 1.0
        ];
        var vertexBuffer = gl.createBuffer();
        vertexBuffer.itemSize = 4;
        vertexBuffer.numItems = vertices.length / vertexBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        return vertexBuffer;
    };

    /**
     * Create a squares vertices.
     */
    var createSquareVertices = function() {
        var vertices = [
             1.0,  1.0,  0.0,
            -1.0,  1.0,  0.0,
             1.0, -1.0,  0.0,
            -1.0, -1.0,  0.0
        ];

        var vertexBuffer = gl.createBuffer();
        vertexBuffer.itemSize = 3;
        vertexBuffer.numItems = vertices.length / vertexBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        return vertexBuffer;
    };

    /**
     * Create a squares color vertices.
     */
    var createSquareColorVertices = function() {
        var vertices = [
             0.5,  0.5,  1.0, 1.0,
             0.5,  0.5,  1.0, 1.0,
             0.5,  0.5,  1.0, 1.0,
             0.5,  0.5,  1.0, 1.0
        ];
        var vertexBuffer = gl.createBuffer();
        vertexBuffer.itemSize = 4;
        vertexBuffer.numItems = vertices.length / vertexBuffer.itemSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        return vertexBuffer;
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

        pushMovementMatrix();

        mat4.translate(movementMatrix, [-1.5, 0.0, -7.0]);
        mat4.rotate(movementMatrix, degreesToRadians(rotationTriangle), [0, 1, 0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexBuffer);
        gl.vertexAttribPointer(program.vertexPositionAttribute, triangleVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, triangleColorBuffer);
        gl.vertexAttribPointer(program.vertexColorAttribute, triangleColorBuffer.itemSize, gl.FLOAT, false, 0, 0);
        setMatrixUniforms();
        gl.drawArrays(gl.TRIANGLES, 0, triangleVertexBuffer.numItems);

        popMovementMatrix();
        pushMovementMatrix();

        mat4.translate(movementMatrix, [1.5, 0.0, -7.0]);
        mat4.rotate(movementMatrix, degreesToRadians(rotationSquare), [1, 0, 0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, squareVertexBuffer);
        gl.vertexAttribPointer(program.vertexPositionAttribute, squareVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, squareColorBuffer);
        gl.vertexAttribPointer(program.vertexColorAttribute, squareColorBuffer.itemSize, gl.FLOAT, false, 0, 0);
        setMatrixUniforms();
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, squareVertexBuffer.numItems);

        popMovementMatrix();
    };

    var prevTime = new Date().getTime();

    /**
     * Animate the scene.
     */
    var animate = function() {
        var newTime = new Date().getTime();
        var elapsed = newTime - prevTime;

        rotationTriangle += (90 * elapsed) / 1000.0;
        rotationSquare   += (75 * elapsed) / 1000.0;

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

    var triangleVertexBuffer = createTriangleVertices();
    var triangleColorBuffer = createTriangleColorVertices();
    var rotationTriangle = 0;

    var squareVertexBuffer = createSquareVertices();
    var squareColorBuffer = createSquareColorVertices();
    var rotationSquare = 0;

    tick();
});
