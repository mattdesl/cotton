

var Vector2 = require('vecmath').Vector2;
var World = require('knit.js').World;
var Constraint = require('knit.js').Constraint;
var PointMass = require('knit.js').PointMass;

var Cloth = require('./lib/Cloth');
var ClothRenderer = require('./lib/ClothRenderer');

var WebGLContext = require('kami').WebGLContext;
var ShaderProgram = require('kami').ShaderProgram;
var Texture = require('kami').Texture;

var domready = require('domready');


var fs = require('fs');

var vert = fs.readFileSync( __dirname + '/lib/test.vert', 'utf8' );
var frag = fs.readFileSync( __dirname + '/lib/test.frag', 'utf8' );

domready(function() {
    var width = 500;
    var height = 300;
    var canvas = document.createElement("canvas");
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.body.appendChild(canvas);


    var context = new WebGLContext(width, height, canvas, {
    	transparent: false,
    	antialias: true
    });


    var mouseInfluence = 15;
    var mouseScale = .5;
    var mouseMaxDist = 20;
    var steps = 60;

    var mouseTearInfluence = 3;
    var gravity = 0;
    var useFloor = false;

    var world = new World(new Vector2(0, gravity));
    world.removablePins = true;
    world.setPinRemoveInfluence(15);

    var cloth = new Cloth(250, 250, { spacing: 5, stiffness: 0.01, });
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

    var texture,
    	renderer;

    var lightZ = .15;


	setupGL();

	function setupGL() {
		renderer = new ClothRenderer(context, vert, frag);
		texture = new Texture(context, "img/grass.png", render);

		renderer.lightPosition.set(0, 0, lightZ);

	}  
    
    function render() {
        requestAnimationFrame(render);
        world.step(0.016);
        
        var gl = context.gl;

        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT);
		
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        renderer.draw(world);
    }



    function render2D(context) {
        context.clearRect(0, 0, canvas.width, canvas.height);

        world.step(0.016);

        context.fillStyle = "black";
        context.strokeStyle = 'black';
        // context.globalCompositeOperation = 'source-over';
        //context.shadowColor = 'rgba(255,255,200, 0.7)';

        context.globalAlpha = 1;
		context.imageSmoothingEnabled = true;

		// context.lineJoin = 'round';
		context.lineWidth = 1;
        //context.beginPath(); //for line rendering
        
        for (var i=0; i<world.points.length; i++) {
            var p = world.points[i];

            if (p.constraints.length >= 2) {
            	drawTriangle(context, p, i/world.points.length);
            }

            // for (var j=0; j<p.constraints.length; j++) {
            //     var c = p.constraints[j];
            //     // context.strokeStyle = 'hsl(0, 25%, '+ ~~(Math.random()*100) +'%)';
            //     context.beginPath();
            //     context.moveTo(c.p1.position.x, c.p1.position.y);
            //     context.lineTo(c.p2.position.x, c.p2.position.y);
            //     context.stroke();
            // }
        }
    };

    function drawTriangle(context, point, a) {
		var c = point.constraints;
        var botLeft = c[0].p2;
        var topRight = c[1].p2;

		// context.beginPath();
  //       context.moveTo(point.position.x, point.position.y);
  //       context.lineTo(c[0].p1.position.x, c[0].p1.position.y);
  //       context.lineTo(c[1].p1.position.x, c[1].p1.position.y);
  //       context.closePath();
  //       context.fill();


  		var alphaOff = 0;

  		var v = ~~(a*255);
  		context.fillStyle = context.strokeStyle = "rgb(" + v + "," + v +"," + v + ")";

	  	//draw first triangle
		// context.globalAlpha = a;
		context.beginPath();
        context.moveTo(point.position.x, point.position.y);     
        context.lineTo(botLeft.position.x, botLeft.position.y);  
        context.lineTo(topRight.position.x, topRight.position.y);  
        context.closePath();
        context.fill();
       	context.stroke();
		  

        if (topRight.constraints.length > 0) {
        	c = topRight.constraints;
        	var other = c[0].p2;

        	//draw second triangle
			context.beginPath();
	        context.moveTo(other.position.x, other.position.y);     
	        context.lineTo(botLeft.position.x, botLeft.position.y+alphaOff);  
	        context.lineTo(topRight.position.x+alphaOff, topRight.position.y);  
	        context.closePath();
	        context.fill();
	        context.stroke();
        }
    }

    window.addEventListener("mousemove", function(ev) {
    	renderer.lightPosition.set(ev.clientX / width, 1 - (ev.clientY/height), lightZ);
    	
        if (mouseDown) {
            world.applyTear(ev.clientX, ev.clientY, mouseTearInfluence);
            world.applyMotion(ev.clientX, ev.clientY, mouseInfluence, mouseScale, mouseMaxDist);
        } else
            world.applyMotion(ev.clientX, ev.clientY, mouseInfluence, mouseScale, mouseMaxDist);
    });

}

);