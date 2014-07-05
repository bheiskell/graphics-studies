'use strict';

$(function() {

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
        gl.enableVertexAttribArray(program.vertexPositionAttribute);

        program.perspectiveMatrixUniform = gl.getUniformLocation(program, 'uPerspectiveMatrix');
        program.movementMatrixUniform = gl.getUniformLocation(program, 'uMovementMatrix');

        return program;
    }


    var setMatrixUniforms = function() {
        gl.uniformMatrix4fv(program.perspectiveMatrixUniform, false, perspectiveMatrix);
        gl.uniformMatrix4fv(program.movementMatrixUniform, false, movementMatrix);
    };

    var drawTriangle = function() {
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

    var drawSquare = function() {
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

    var drawScene = function() {
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        var viewAngle = 45;
        var aspectRatio = gl.viewportWidth / gl.viewportHeight;
        var viewDistanceMin = 0.1;
        var viewDistanceMax = 100.0;

        mat4.perspective(viewAngle, aspectRatio, viewDistanceMin, viewDistanceMax, perspectiveMatrix);
        mat4.identity(movementMatrix);

        mat4.translate(movementMatrix, [-1.5, 0.0, -7.0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexBuffer);
        gl.vertexAttribPointer(program.vertexPositionAttribute, triangleVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
        setMatrixUniforms();
        gl.drawArrays(gl.TRIANGLES, 0, triangleVertexBuffer.numItems);

        mat4.translate(movementMatrix, [3.0, 0.0, 0.0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, squareVertexBuffer);
        gl.vertexAttribPointer(program.vertexPositionAttribute, squareVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
        setMatrixUniforms();
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, squareVertexBuffer.numItems);
    };

    var gl = initGl('#canvas');
    var vertexShader = getShaderGlsl('#2d-shader-vertex');
    var fragmentShader = getShaderGlsl('#2d-shader-fragment');
    var program = initShaders(vertexShader, fragmentShader);

    var perspectiveMatrix = mat4.create();
    var movementMatrix = mat4.create();

    var triangleVertexBuffer = drawTriangle();
    var squareVertexBuffer = drawSquare();

    drawScene();
});
