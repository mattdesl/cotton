
var domready = require('domready');

domready(function() {
    var canvas = document.createElement("canvas"),
        other = document.createElement("canvas");
    document.body.appendChild(canvas);

    var context = canvas.getContext("2d"),
        otherContext = other.getContext("2d");

    var width, height;
    var time = 0;

    var img = new Image();
    img.onload = start;
    img.src = "http://i.imgur.com/GOUB5bO.jpg";

    function start() {
        width = canvas.width = other.width = img.width;
        height = canvas.height = other.height = img.height;
        render();
    } 


    function scramble(context, img, squares) {
        var xSize = width / squares,
            ySize = height / squares;

        context.clearRect(0, 0, width, height);
        var angle = 0;

        for (var i=0; i<squares*squares; i++) {
            var y = Math.floor(i/squares);
            var x = Math.floor(i-squares*y);

            var cs = Math.cos(angle),
                sn = Math.sin(angle);   

            //some animation, for fun
            var anim = (Math.sin(time+x)/2+0.5)*3;

            var xPos = x*xSize+anim,
                yPos = y*ySize;

            context.save();
            context.translate( xPos+xSize/2, yPos+ySize/2 );
            context.rotate( angle );
            context.translate( -xSize/2, -ySize/2 );
            context.drawImage(img, xPos, yPos, xSize, ySize, 0, 0, xSize, ySize);
            context.restore();

            if ((x+y) % 2 == 0) //get some scrambling of our angle here
                angle += Math.PI/2;
        }
    }

    function render() {  
        requestAnimationFrame(render);
        context.clearRect(0, 0, width, height)

        time += 0.1;
        var numPasses = 11,
            squares = 4;

        //for even numbers to work we'd need to add another draw call at the end
        if (numPasses % 2 === 0)
            numPasses++;

        var canvasA = canvas,
            canvasB = other,
            contextA = context,
            contextB = otherContext;

        //first pass, scramble the original image onto the off-screen canvas
        scramble(contextB, img, 2);

        //draw the rest of the passes
        for (var pass=1; pass<numPasses; pass++) {
            scramble(contextA, canvasB, pass+1);

            //ping-pong our canvases
            var t = contextA;
            contextA = contextB;
            contextB = t;

            t = canvasA;
            canvasA = canvasB;
            canvasB = t;
        }

        //now draw the result to the screen...
        context.clearRect(0, 0, width, height);
        context.drawImage(canvasB, 0, 0);
        
    }
})
  