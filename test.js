

var Vector3 = require('vecmath').Vector3;
var World = require('verlet3d').World;
var Constraint = require('verlet3d').Constraint;
var PointMass = require('verlet3d').PointMass;

var Cloth = require('./lib/Cloth');
var ClothRenderer = require('./lib/ClothRenderer');

var WebGLContext = require('kami').WebGLContext;
var ShaderProgram = require('kami').ShaderProgram;
var Texture = require('kami').Texture;

var domready = require('domready');
var raf = require('raf.js');

var fs = require('fs');

var vert = fs.readFileSync( __dirname + '/lib/test.vert', 'utf8' );
var frag = fs.readFileSync( __dirname + '/lib/test.frag', 'utf8' );

domready(function() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var canvas = document.createElement("canvas");
    document.body.style.margin = "0";
    document.body.style.background = "black";
    document.body.style.overflow = "hidden";
    document.body.appendChild(canvas);


    var context = new WebGLContext(width, height, canvas, {
    	transparent: false,
    	antialias: true
    });


    var mouseInfluence = 15;
    var mouseScale = .25;
    var mouseMaxDist = 20;
    var steps = 60;

    var mouseTearInfluence = 4;
    var gravity = 0;
    var useFloor = false;

    var world = new World(new Vector3(0, 0, 0));
    world.removablePins = true;
    // world.setPinRemoveInfluence(15);

    var cloth = new Cloth(512, 256, { spacing: 8, stiffness: 0.01, });
    world.addPoints(cloth.points);
    
    var mouseDown = false;
    window.addEventListener("mousedown", function(ev) {
    	if (ev.which == 1)
            mouseDown = true;
    });
    window.addEventListener("mouseup", function(ev) {
        if (ev.which == 1)
            mouseDown = false;
    });

    window.addEventListener("keydown", function(ev) {
        if (ev.keyCode === 32) {
            world.points.length = 0;
            cloth.create();
            world.addPoints(cloth.points);
        }
    });

    var texture,
    	renderer,
        noiseTexture;

    var lightZ = .45;


    setupGL();

    function randomNoise() {
        var w = cloth.width,
            h = cloth.height;
        var noise = new Uint8Array(w * h * 4);
        for (var i=0; i<noise.length; i++) {
            noise[i] = Math.floor(Math.random() * 255);
        }

        var noiseTex = new Texture(context, w, h, Texture.Format.RGBA, Texture.DataType.UNSIGNED_BYTE, noise);
        noiseTex.setFilter(Texture.Filter.LINEAR);
        noiseTex.setWrap(Texture.Wrap.REPEAT);
        return noiseTex;
    }

	function setupGL() {
		renderer = new ClothRenderer(context, vert, frag);
		texture = new Texture(context, getURL(), render);
		texture.setFilter(Texture.Filter.LINEAR);
		texture.setWrap(Texture.Wrap.REPEAT);

        noiseTexture = randomNoise();

		renderer.lightPosition.set(0, 0, lightZ);

	}  
    
    function render() {
        requestAnimationFrame(render);
        world.step(0.016);
        
        var gl = context.gl;

        noiseTexture.bind(1);
        texture.bind(0);

        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT);
		
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        renderer.draw(world, cloth.cols, cloth.rows);
    }
    var time = 0;
    window.addEventListener("mousemove", function(ev) {
    	renderer.lightPosition.set(ev.clientX / width, 1 - (ev.clientY/height), lightZ);
    	
    	var z = Math.sin(time += 0.01) * 50;

        if (mouseDown) {
            world.applyTear(ev.clientX, ev.clientY, z, mouseTearInfluence);
            world.applyMotion(ev.clientX, ev.clientY, z, mouseInfluence, mouseScale, mouseMaxDist);
        } else
            world.applyMotion(ev.clientX, ev.clientY, z, mouseInfluence, mouseScale, mouseMaxDist);
    });

    function getURL() {
        return "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    }
});